import type { Question, QuestionType } from "./question-bank";

export type ExamStatus = "active" | "paused" | "reviewing" | "completed";
export type ExamViewMode = "paper" | "focus";
export type AnswerAssetKind = "photo" | "canvas";
export type ExamAssetRef = {
  id: string;
  kind: AnswerAssetKind;
  name: string;
  mimeType: string;
  previewUrl?: string;
  remote?: boolean;
};
export type StrokePoint = { x: number; y: number; pressure: number };
export type InkStroke = {
  id: string;
  tool: "pen" | "highlighter" | "eraser";
  color: string;
  width: number;
  points: StrokePoint[];
};
export type HandwritingPage = {
  id: string;
  background: "blank" | "grid";
  strokes: InkStroke[];
};
export type AiAnalysis = {
  id?: string;
  provider: "openai" | "qwen" | "deepseek";
  model: string;
  transcript: string;
  suggestedRubricIds: string[];
  warnings: string[];
  createdAt: string;
};
export type ExamAnswer = {
  text: string;
  assets: ExamAssetRef[];
  handwriting: HandwritingPage[];
  analysis?: AiAnalysis;
};
export type PaperSlot = {
  questionId: number;
  page: number;
  column: 1 | 2;
  order: number;
  section: QuestionType;
};
export type ExamDraft = {
  id: string;
  scope: string;
  questionIds: number[];
  answers: Record<number, ExamAnswer>;
  selfChecks: Record<number, string[]>;
  reviewedSubjective: number[];
  currentIndex: number;
  durationSeconds: number;
  remainingSeconds: number;
  deadlineAt: string | null;
  status: ExamStatus;
  startedAt: string;
  viewMode: ExamViewMode;
  paperLayout: PaperSlot[];
  resultVisible?: boolean;
};

export function emptyExamAnswer(): ExamAnswer {
  return { text: "", assets: [], handwriting: [] };
}
export function examAnswerText(answer: ExamAnswer | string | undefined) {
  return typeof answer === "string" ? answer : (answer?.text ?? "");
}
export function hasExamAnswer(answer: ExamAnswer | string | undefined) {
  if (typeof answer === "string") return Boolean(answer.trim());
  return Boolean(
    answer &&
    (answer.text.trim() ||
      answer.assets.length ||
      answer.handwriting.some((page) => page.strokes.length)),
  );
}

const typeOrder: QuestionType[] = [
  "选择题",
  "填空/计算题",
  "汇编编程题",
  "综合设计题",
];
const typeRatio: Record<QuestionType, number> = {
  选择题: 0.55,
  "填空/计算题": 0.175,
  汇编编程题: 0.15,
  综合设计题: 0.125,
};
function shuffled<T>(items: T[], random = Math.random) {
  return [...items].sort(() => random() - 0.5);
}

export function selectExamQuestions(
  pool: Question[],
  size: number,
  random = Math.random,
) {
  const target = Math.min(Math.max(1, size), pool.length);
  const selected: Question[] = [];
  const selectedIds = new Set<number>();
  const exact = typeOrder.map((type) => ({
    type,
    exact: target * typeRatio[type],
  }));
  const quotas = new Map(
    exact.map(({ type, exact: value }) => [type, Math.floor(value)]),
  );
  let remainder =
    target - [...quotas.values()].reduce((sum, value) => sum + value, 0);
  for (const item of [...exact].sort((a, b) => (b.exact % 1) - (a.exact % 1))) {
    if (!remainder) break;
    quotas.set(item.type, (quotas.get(item.type) ?? 0) + 1);
    remainder -= 1;
  }
  for (const type of typeOrder) {
    for (const question of shuffled(
      pool.filter((item) => item.type === type),
      random,
    ).slice(0, quotas.get(type) ?? 0)) {
      selected.push(question);
      selectedIds.add(question.id);
    }
  }
  for (const question of shuffled(
    pool.filter((item) => !selectedIds.has(item.id)),
    random,
  )) {
    if (selected.length >= target) break;
    selected.push(question);
  }
  return selected.sort(
    (a, b) =>
      typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type) || a.id - b.id,
  );
}

function questionUnits(question: Question) {
  const base =
    question.type === "选择题"
      ? 3
      : question.type === "填空/计算题"
        ? 4
        : question.type === "汇编编程题"
          ? 8
          : 10;
  return Math.min(14, base + Math.floor(question.prompt.length / 90));
}

export function buildPaperLayout(questionIds: number[], bank: Question[]) {
  const byId = new Map(bank.map((question) => [question.id, question]));
  let page = 1;
  let column: 1 | 2 = 1;
  let used = 0;
  const layout: PaperSlot[] = [];
  questionIds.forEach((questionId, order) => {
    const question = byId.get(questionId);
    if (!question) return;
    const units = questionUnits(question);
    if (used && used + units > 16) {
      if (column === 1) column = 2;
      else {
        page += 1;
        column = 1;
      }
      used = 0;
    }
    layout.push({ questionId, page, column, order, section: question.type });
    used += units;
  });
  return layout;
}

export function upgradeExamDraft(
  raw: unknown,
  bank: Question[],
): ExamDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const draft = raw as Partial<ExamDraft> & {
    answers?: Record<number, ExamAnswer | string>;
  };
  const questionIds = Array.isArray(draft.questionIds)
    ? draft.questionIds.map(Number).filter(Number.isInteger)
    : [];
  if (!draft.id || !questionIds.length) return null;
  const answers: Record<number, ExamAnswer> = {};
  for (const [id, answer] of Object.entries(draft.answers ?? {})) {
    const questionId = Number(id);
    if (typeof answer === "string")
      answers[questionId] = { ...emptyExamAnswer(), text: answer };
    else
      answers[questionId] = {
        text: answer?.text ?? "",
        assets: Array.isArray(answer?.assets) ? answer.assets : [],
        handwriting: Array.isArray(answer?.handwriting)
          ? answer.handwriting
          : [],
        ...(answer?.analysis ? { analysis: answer.analysis } : {}),
      };
  }
  return {
    id: String(draft.id),
    scope: String(draft.scope ?? "全部章节"),
    questionIds,
    answers,
    selfChecks: draft.selfChecks ?? {},
    reviewedSubjective: draft.reviewedSubjective ?? [],
    currentIndex: Math.min(
      questionIds.length - 1,
      Math.max(0, Number(draft.currentIndex) || 0),
    ),
    durationSeconds: Math.max(60, Number(draft.durationSeconds) || 1800),
    remainingSeconds: Math.max(0, Number(draft.remainingSeconds) || 0),
    deadlineAt: draft.deadlineAt ?? null,
    status: draft.status ?? "active",
    startedAt: draft.startedAt ?? new Date().toISOString(),
    viewMode: draft.viewMode ?? "paper",
    paperLayout: draft.paperLayout?.length
      ? draft.paperLayout
      : buildPaperLayout(questionIds, bank),
    resultVisible: Boolean(draft.resultVisible),
  };
}

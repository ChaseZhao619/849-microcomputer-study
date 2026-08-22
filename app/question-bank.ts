export type QuestionType = "选择题" | "填空/计算题" | "汇编编程题" | "综合设计题";
export type Difficulty = "基础" | "强化" | "综合";
export type RubricItem = { id: string; label: string; points: number };
export type Question = {
  id: number;
  chapter: string;
  section: string;
  type: QuestionType;
  difficulty: Difficulty;
  prompt: string;
  options?: string[];
  answer: string;
  accepted?: string[];
  explanation: string;
  keypoint: string;
  scoring: "auto" | "rubric";
  points: number;
  rubric?: RubricItem[];
};

import rawQuestions from "./question-bank.json";

export const questions = rawQuestions as Question[];

function normalize(value: string) {
  return value.toLowerCase().replace(/[，。、“”‘’（）()：:；;,.!?！？\\s]+/g, " ").trim();
}

export function searchQuestions(query: string, limit = 30): Question[] {
  const normalized = normalize(query);
  if (!normalized) return [];
  const tokens = normalized.split(" ").filter(Boolean);
  return questions
    .map((question) => {
      const id = String(question.id);
      const prompt = normalize(question.prompt);
      const metadata = normalize([question.chapter, question.section, question.type, question.keypoint].join(" "));
      const searchable = id + " " + prompt + " " + metadata;
      if (!tokens.every((token) => searchable.includes(token))) return null;
      const score = id === normalized ? 100 : prompt.startsWith(normalized) ? 70 : prompt.includes(normalized) ? 50 : 20;
      return { question, score };
    })
    .filter((item): item is { question: Question; score: number } => Boolean(item))
    .sort((a, b) => b.score - a.score || a.question.id - b.question.id)
    .slice(0, limit)
    .map((item) => item.question);
}


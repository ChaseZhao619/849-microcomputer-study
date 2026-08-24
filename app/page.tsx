"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { questions, searchQuestions, type Question } from "./question-bank";
import {
  buildHeatmapDays,
  completePlanQuestion,
  remainingAt,
  resumeDeadline,
  rubricScore,
  serializeExamDraft,
} from "./study-logic";
import { AnalyticsView } from "./components/AnalyticsView";
import { ExamActiveWorkspace } from "./components/ExamActiveWorkspace";
import { SubjectiveAnswerTools } from "./components/SubjectiveAnswerTools";
import { type AnalyticsEvent, type ExamLike } from "./analytics";
import { deleteExamLocalDrafts } from "./ink-storage";
import {
  buildPaperLayout,
  emptyExamAnswer,
  examAnswerText,
  hasExamAnswer,
  selectExamQuestions,
  upgradeExamDraft,
  type ExamAnswer,
  type ExamDraft,
} from "./exam-model";

const chapterGroups = [
  {
    name: "微型计算机基础",
    code: "01",
    sections: ["数制与编码", "补码运算", "系统组成", "总线基础"],
    source: "第一章讲义 · 有效周练",
    target: 18,
  },
  {
    name: "8086 CPU结构",
    code: "02",
    sections: [
      "BIU 与 EU",
      "寄存器组",
      "存储器分段",
      "引脚与工作模式",
      "总线时序",
    ],
    source: "第二章讲义 · 第7–15周练习",
    target: 24,
  },
  {
    name: "寻址与指令系统",
    code: "03",
    sections: [
      "寻址方式",
      "数据传送指令",
      "算术与逻辑指令",
      "串操作指令",
      "控制转移指令",
    ],
    source: "第三章讲义 · 指令简表 · 周练",
    target: 28,
  },
  {
    name: "汇编语言程序设计",
    code: "04",
    sections: [
      "伪指令与段定义",
      "DOS 功能调用",
      "分支与循环",
      "子程序与堆栈",
      "程序分析",
    ],
    source: "第四章讲义 · 编程题总结课",
    target: 14,
  },
  {
    name: "存储器系统",
    code: "05",
    sections: [
      "RAM 与 ROM",
      "地址译码",
      "容量与位扩展",
      "系统连接",
      "Cache 基础",
    ],
    source: "第五章讲义 · 习题讲解",
    target: 18,
  },
  {
    name: "I/O接口技术",
    code: "06",
    sections: ["I/O 编址", "程序查询", "中断传送", "DMA", "接口设计"],
    source: "第六章讲义 · 习题讲解",
    target: 13,
  },
  {
    name: "8255A并行接口",
    code: "07",
    sections: ["三种工作方式", "方式控制字", "端口地址", "初始化编程"],
    source: "第六章讲义 · 编程题总结课",
    target: 18,
  },
  {
    name: "中断系统与8259A",
    code: "08",
    sections: ["中断向量", "中断响应流程", "8259A 结构", "级联", "ICW 与 OCW"],
    source: "第八章作业 · 有效周练",
    target: 18,
  },
  {
    name: "8253/8254定时器",
    code: "09",
    sections: ["六种工作方式", "计数初值", "控制字", "初始化编程", "应用设计"],
    source: "第七章讲义 · 编程题总结课",
    target: 18,
  },
  {
    name: "串行通信与8251A",
    code: "10",
    sections: ["同步与异步", "波特率与帧格式", "控制字", "初始化编程"],
    source: "第九章讲义 · 章节作业",
    target: 13,
  },
  {
    name: "A/D与D/A转换",
    code: "11",
    sections: ["采样量化编码", "DAC0832", "ADC0809", "接口编程", "波形生成"],
    source: "第十章讲义 · 章节作业",
    target: 18,
  },
];

const navItems = [
  { id: "home", label: "学习首页", icon: "⌂" },
  { id: "practice", label: "章节刷题", icon: "◎" },
  { id: "mastery", label: "题库目录", icon: "◫" },
  { id: "analytics", label: "学习数据", icon: "▥" },
  { id: "plan", label: "学习计划", icon: "▤" },
  { id: "exam", label: "组卷考试", icon: "◈" },
  { id: "mistakes", label: "错题复测", icon: "↻" },
] as const;

type View = (typeof navItems)[number]["id"];
type FontSize = "small" | "standard" | "large" | "xlarge";
type ProgressStatus = "mastered" | "unsure" | "mistake";
type StoredProgress = Record<number, ProgressStatus>;
type ReviewRecord = {
  stage: number;
  nextReviewAt: string | null;
  attempts: number;
  correctAttempts: number;
};
type StoredReviews = Record<number, ReviewRecord>;
type AccountSummary = {
  displayName: string;
  baseDisplayName: string;
  email: string;
  studyId: string;
  bio: string;
};
type PlanItem = {
  id?: number;
  localKey?: string;
  planDate: string;
  chapter: string;
  targetQuestions: number;
  completedQuestions: number;
  completedIds?: number[];
  status: string;
};
type ActivityCounts = Record<string, number>;
type AccountPayload = {
  user: AccountSummary;
  profile?: {
    nickname?: string;
    studyId?: string;
    bio?: string;
    dailyGoal?: number;
    examDate?: string;
  };
  progress?: Array<{
    questionId: number;
    status: ProgressStatus;
    reviewStage: number;
    nextReviewAt: string | null;
    attempts: number;
    correctAttempts: number;
  }>;
  plans?: PlanItem[];
  exams?: ExamLike[];
  activity?: Array<{ date: string; count: number }>;
};

const fontSizes: Array<{ id: FontSize; label: string }> = [
  { id: "small", label: "小" },
  { id: "standard", label: "标准" },
  { id: "large", label: "大" },
  { id: "xlarge", label: "特大" },
];

const heatLevelLabels = [
  "无作答",
  "1–4 次",
  "5–9 次",
  "10–19 次",
  "20 次以上",
] as const;

function shanghaiDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function isCorrect(question: Question, answer: string) {
  return [question.answer, ...(question.accepted ?? [])].some(
    (expected) =>
      expected.replace(/\s/g, "").toUpperCase() ===
      answer.replace(/\s/g, "").toUpperCase(),
  );
}

function useFocusTrap(
  open: boolean,
  onClose: () => void,
  initialRef?: RefObject<HTMLElement | null>,
) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex='-1'])",
        ) ?? [],
      );
    queueMicrotask(() =>
      (initialRef?.current ?? focusable()[0] ?? dialog)?.focus(),
    );
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = previousOverflow;
      queueMicrotask(() => opener?.focus());
    };
  }, [open, onClose, initialRef]);
  return dialogRef;
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [dark, setDark] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("standard");
  const [selectedChapter, setSelectedChapter] = useState("全部章节");
  const [difficulty, setDifficulty] = useState("全部难度");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [searchCursor, setSearchCursor] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [attemptRecorded, setAttemptRecorded] = useState(false);
  const [progress, setProgress] = useState<StoredProgress>({});
  const [reviews, setReviews] = useState<StoredReviews>({});
  const [activity, setActivity] = useState<ActivityCounts>({});
  const [localEvents, setLocalEvents] = useState<AnalyticsEvent[]>([]);
  const [examHistory, setExamHistory] = useState<ExamLike[]>([]);
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsNickname, setSettingsNickname] = useState("");
  const [settingsStudyId, setSettingsStudyId] = useState("");
  const [settingsBio, setSettingsBio] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const settingsErrorRef = useRef<HTMLParagraphElement>(null);
  const [syncState, setSyncState] = useState<
    "loading" | "synced" | "local" | "error"
  >("loading");
  const [dailyGoal, setDailyGoal] = useState(20);
  const [examDate, setExamDate] = useState("2026-12-19");
  const [planChapter, setPlanChapter] = useState(chapterGroups[0].name);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [activePlanKey, setActivePlanKey] = useState<string | null>(null);
  const [examChapter, setExamChapter] = useState("全部章节");
  const [examSize, setExamSize] = useState(20);
  const [examMinutes, setExamMinutes] = useState(30);
  const [exam, setExam] = useState<ExamDraft | null>(null);
  const [reviewFilter, setReviewFilter] = useState<
    "all" | "wrong" | "unanswered" | "subjective"
  >("all");
  const [notice, setNotice] = useState("");
  const [resultBusy, setResultBusy] = useState(false);
  const resultTitleRef = useRef<HTMLHeadingElement>(null);

  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const searchDialogRef = useFocusTrap(searchOpen, closeSearch, searchInputRef);
  const settingsDialogRef = useFocusTrap(settingsOpen, closeSettings);
  const modalOpen = searchOpen || settingsOpen;

  useEffect(() => {
    const savedProgress = localStorage.getItem("micro849-progress");
    const savedReviews = localStorage.getItem("micro849-reviews");
    const savedPlans = localStorage.getItem("micro849-plans");
    const savedActivity = localStorage.getItem("micro849-activity-v2");
    const savedEvents = localStorage.getItem("micro849-answer-events-v1");
    const savedExam = localStorage.getItem("micro849-exam-v2");
    queueMicrotask(() => {
      setCurrentTime(Date.now());
      try {
        if (savedProgress) setProgress(JSON.parse(savedProgress));
      } catch {
        localStorage.removeItem("micro849-progress");
      }
      try {
        if (savedReviews) setReviews(JSON.parse(savedReviews));
      } catch {
        localStorage.removeItem("micro849-reviews");
      }
      try {
        if (savedPlans) setPlanItems(JSON.parse(savedPlans));
      } catch {
        localStorage.removeItem("micro849-plans");
      }
      try {
        if (savedActivity) setActivity(JSON.parse(savedActivity));
      } catch {
        localStorage.removeItem("micro849-activity-v2");
      }
      try {
        if (savedEvents) setLocalEvents(JSON.parse(savedEvents));
      } catch {
        localStorage.removeItem("micro849-answer-events-v1");
      }
      try {
        if (savedExam) {
          const parsed = upgradeExamDraft(JSON.parse(savedExam), questions);
          if (!parsed) throw new Error("invalid exam");
          if (parsed.status === "active" && parsed.deadlineAt) {
            parsed.remainingSeconds = remainingAt(
              parsed.deadlineAt,
              Date.now(),
              parsed.remainingSeconds,
            );
          }
          setExam(parsed);
        }
      } catch {
        localStorage.removeItem("micro849-exam-v2");
      }
      setDark(localStorage.getItem("micro849-theme") === "dark");
      const savedFont = localStorage.getItem(
        "micro849-font-size",
      ) as FontSize | null;
      if (savedFont && fontSizes.some((item) => item.id === savedFont))
        setFontSize(savedFont);
      setSidebarCollapsed(
        localStorage.getItem("micro849-sidebar") === "collapsed",
      );
    });

    fetch("/api/account", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          setSyncState("local");
          return null;
        }
        if (!response.ok) throw new Error("sync failed");
        return response.json() as Promise<AccountPayload>;
      })
      .then((data) => {
        if (!data) return;
        setAccount(data.user);
        setSettingsNickname(data.profile?.nickname ?? "");
        setSettingsStudyId(data.profile?.studyId ?? "");
        setSettingsBio(data.profile?.bio ?? "");
        setDailyGoal(data.profile?.dailyGoal ?? 20);
        setExamDate(data.profile?.examDate ?? "2026-12-19");
        const syncedProgress: StoredProgress = {};
        const syncedReviews: StoredReviews = {};
        for (const item of data.progress ?? []) {
          if (!questions.some((question) => question.id === item.questionId))
            continue;
          syncedProgress[item.questionId] = item.status;
          syncedReviews[item.questionId] = {
            stage: item.reviewStage,
            nextReviewAt: item.nextReviewAt,
            attempts: item.attempts,
            correctAttempts: item.correctAttempts,
          };
        }
        setProgress((local) => ({ ...local, ...syncedProgress }));
        setReviews((local) => ({ ...local, ...syncedReviews }));
        setPlanItems(data.plans ?? []);
        setExamHistory(data.exams ?? []);
        setActivity((local) => ({
          ...local,
          ...Object.fromEntries(
            (data.activity ?? []).map(
              (item: { date: string; count: number }) => [
                item.date,
                Number(item.count),
              ],
            ),
          ),
        }));
        setSyncState("synced");
        return fetch("/api/exams", { cache: "no-store" });
      })
      .then(async (response) => {
        if (!response?.ok) return;
        const data = (await response.json()) as {
          sessions?: Array<Record<string, unknown>>;
        };
        const session = data.sessions?.[0] as
          | {
              id: string;
              scope: string;
              questionIdsJson: string;
              answersJson: string;
              selfScoresJson: string;
              currentIndex: number;
              durationSeconds: number;
              remainingSeconds: number;
              deadlineAt: string | null;
              status: ExamDraft["status"];
              startedAt: string;
            }
          | undefined;
        if (!session) return;
        const savedSelfScores = JSON.parse(session.selfScoresJson) as
          | {
              checks?: Record<number, string[]>;
              reviewed?: number[];
              viewMode?: ExamDraft["viewMode"];
              paperLayout?: ExamDraft["paperLayout"];
              resultVisible?: boolean;
            }
          | Record<number, string[]>;
        const hasReviewEnvelope = "checks" in savedSelfScores;
        const serverExam = upgradeExamDraft(
          {
            id: session.id,
            scope: session.scope,
            questionIds: JSON.parse(session.questionIdsJson),
            answers: JSON.parse(session.answersJson),
            selfChecks: hasReviewEnvelope
              ? (savedSelfScores.checks ?? {})
              : (savedSelfScores as Record<number, string[]>),
            reviewedSubjective: hasReviewEnvelope
              ? (savedSelfScores.reviewed ?? [])
              : [],
            currentIndex: session.currentIndex,
            durationSeconds: session.durationSeconds,
            remainingSeconds: session.remainingSeconds,
            deadlineAt: session.deadlineAt,
            status: session.status,
            startedAt: session.startedAt,
            viewMode: hasReviewEnvelope ? savedSelfScores.viewMode : undefined,
            paperLayout: hasReviewEnvelope
              ? savedSelfScores.paperLayout
              : undefined,
            resultVisible: hasReviewEnvelope
              ? savedSelfScores.resultVisible
              : undefined,
          },
          questions,
        );
        if (serverExam) setExam(serverExam);
      })
      .catch(() => setSyncState("error"));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("micro849-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
    localStorage.setItem("micro849-font-size", fontSize);
  }, [fontSize]);
  useEffect(() => {
    localStorage.setItem(
      "micro849-sidebar",
      sidebarCollapsed ? "collapsed" : "expanded",
    );
  }, [sidebarCollapsed]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (settingsError) queueMicrotask(() => settingsErrorRef.current?.focus());
  }, [settingsError]);

  const examId = exam?.id;
  const examStatus = exam?.status;
  const examDeadline = exam?.deadlineAt;
  const examResultVisible = exam?.resultVisible;
  useEffect(() => {
    if (examStatus !== "completed" || !examResultVisible) return;
    requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
      resultTitleRef.current?.focus();
    });
  }, [examStatus, examResultVisible]);
  useEffect(() => {
    if (!examId || examStatus !== "active") return;
    const timer = window.setInterval(() => {
      if (!examDeadline) return;
      const remaining = remainingAt(examDeadline, Date.now(), 0);
      setCurrentTime(Date.now());
      setExam((current) =>
        current
          ? {
              ...current,
              remainingSeconds: remaining,
              ...(remaining === 0
                ? { status: "reviewing" as const, deadlineAt: null }
                : {}),
            }
          : current,
      );
      if (remaining === 300 || remaining === 60)
        setNotice(remaining === 300 ? "考试还剩5分钟" : "考试还剩1分钟");
      if (remaining === 0) {
        setNotice("考试时间到，已自动交卷");
        window.setTimeout(() => setNotice(""), 2200);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [examId, examStatus, examDeadline]);

  useEffect(() => {
    if (!exam) {
      localStorage.removeItem("micro849-exam-v2");
      return;
    }
    localStorage.setItem("micro849-exam-v2", serializeExamDraft(exam));
    if (!account) return;
    const timer = window.setTimeout(() => {
      const action =
        exam.status === "paused"
          ? "pause"
          : exam.status === "reviewing"
            ? "submit"
            : exam.status === "completed"
              ? "selfScore"
              : "save";
      fetch("/api/exams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          id: exam.id,
          scope: exam.scope,
          questionIds: exam.questionIds,
          answers: exam.answers,
          selfScores: {
            checks: exam.selfChecks,
            reviewed: exam.reviewedSubjective,
            viewMode: exam.viewMode,
            paperLayout: exam.paperLayout,
            resultVisible: exam.resultVisible,
          },
          currentIndex: exam.currentIndex,
          durationSeconds: exam.durationSeconds,
          remainingSeconds: exam.remainingSeconds,
          deadlineAt: exam.deadlineAt,
          startedAt: exam.startedAt,
          score: examScore(exam),
          total: examTotal(exam),
        }),
      }).catch(() => setSyncState("error"));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [exam, account]);

  const searchResults = useMemo(
    () => searchQuestions(searchQuery),
    [searchQuery],
  );
  const filteredQuestions = useMemo(() => {
    const base = searchFilter ? searchQuestions(searchFilter, 200) : questions;
    return base.filter(
      (question) =>
        (view !== "mistakes" ||
          (progress[question.id] === "mistake" &&
            (!reviews[question.id]?.nextReviewAt ||
              new Date(reviews[question.id].nextReviewAt as string).getTime() <=
                currentTime))) &&
        (selectedChapter === "全部章节" ||
          question.chapter === selectedChapter) &&
        (difficulty === "全部难度" || question.difficulty === difficulty),
    );
  }, [
    searchFilter,
    selectedChapter,
    difficulty,
    view,
    progress,
    reviews,
    currentTime,
  ]);
  const currentQuestion =
    filteredQuestions.find((question) => question.id === activeQuestionId) ??
    filteredQuestions[0];
  const currentQuestionIndex = currentQuestion
    ? filteredQuestions.findIndex(
        (question) => question.id === currentQuestion.id,
      )
    : -1;
  const mastered = Object.values(progress).filter(
    (value) => value === "mastered",
  ).length;
  const dueReviews = questions.filter(
    (question) =>
      progress[question.id] === "mistake" &&
      (!reviews[question.id]?.nextReviewAt ||
        new Date(reviews[question.id].nextReviewAt as string).getTime() <=
          currentTime),
  ).length;
  const accuracy = Object.keys(progress).length
    ? Math.round((mastered / Object.keys(progress).length) * 100)
    : 0;
  const daysLeft = currentTime
    ? Math.max(
        0,
        Math.ceil(
          (new Date(examDate + "T08:30:00+08:00").getTime() - currentTime) /
            86400000,
        ),
      )
    : null;
  const activePlan = planItems.find(
    (item) => String(item.id ?? item.localKey) === activePlanKey,
  );

  const heatDays = useMemo(() => {
    return buildHeatmapDays(activity, shanghaiDate()).map((day) => ({
      ...day,
      label: new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "long",
        day: "numeric",
        weekday: "short",
      }).format(new Date(`${day.key}T12:00:00+08:00`)),
    }));
  }, [activity]);

  function switchView(next: View) {
    setView(next);
    setSidebarOpen(false);
    if (next === "mistakes") {
      setSelectedChapter("全部章节");
      setDifficulty("全部难度");
      setSearchFilter("");
    }
  }

  function returnHome() {
    switchView("home");
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }

  function resetQuestionState(id: number | null = null) {
    setActiveQuestionId(id);
    setSelectedAnswer("");
    setRevealed(false);
    setAttemptRecorded(false);
  }

  function beginChapter(chapter: string) {
    setActivePlanKey(null);
    setSearchFilter("");
    setSelectedChapter(chapter);
    setDifficulty("全部难度");
    resetQuestionState();
    switchView("practice");
  }

  function beginPlan(item: PlanItem) {
    setActivePlanKey(String(item.id ?? item.localKey));
    setSearchFilter("");
    setSelectedChapter(item.chapter);
    setDifficulty("全部难度");
    resetQuestionState();
    switchView("practice");
  }

  function chooseSearchResult(question: Question) {
    setSearchFilter(searchQuery.trim());
    setSelectedChapter("全部章节");
    setDifficulty("全部难度");
    resetQuestionState(question.id);
    setSearchOpen(false);
    switchView("practice");
  }

  async function postAccount(payload: Record<string, unknown>) {
    if (!account) return null;
    const response = await fetch("/api/account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("sync failed");
    setSyncState("synced");
    return response.json() as Promise<{ plan?: PlanItem }>;
  }

  function setLocalActivity(amount = 1) {
    const key = shanghaiDate();
    setActivity((current) => {
      const next = { ...current, [key]: (current[key] ?? 0) + amount };
      localStorage.setItem("micro849-activity-v2", JSON.stringify(next));
      return next;
    });
  }

  function appendLocalEvent(event: AnalyticsEvent) {
    setLocalEvents((current) => {
      if (current.some((item) => item.id === event.id)) return current;
      const next = [...current, event].slice(-3000);
      localStorage.setItem("micro849-answer-events-v1", JSON.stringify(next));
      return next;
    });
  }

  async function recordAttempt(
    question: Question,
    correct: boolean,
    source: "practice" | "review" | "exam",
    eventId = crypto.randomUUID(),
  ) {
    const old = reviews[question.id] ?? {
      stage: 0,
      nextReviewAt: null,
      attempts: 0,
      correctAttempts: 0,
    };
    let status: ProgressStatus =
      question.scoring === "rubric"
        ? "unsure"
        : correct
          ? "mastered"
          : "mistake";
    let stage = old.stage;
    let nextReviewAt: string | null =
      question.scoring === "rubric"
        ? new Date(Date.now() + 3 * 86400000).toISOString()
        : correct
          ? null
          : new Date(Date.now() + 86400000).toISOString();
    if (source === "review" && correct) {
      stage += 1;
      if (stage < 5) {
        status = "mistake";
        nextReviewAt = new Date(
          Date.now() + [1, 3, 7, 15, 30][stage] * 86400000,
        ).toISOString();
      }
    }
    const nextProgress = { ...progress, [question.id]: status };
    const nextReviews = {
      ...reviews,
      [question.id]: {
        stage,
        nextReviewAt,
        attempts: old.attempts + 1,
        correctAttempts: old.correctAttempts + (correct ? 1 : 0),
      },
    };
    setProgress(nextProgress);
    setReviews(nextReviews);
    localStorage.setItem("micro849-progress", JSON.stringify(nextProgress));
    localStorage.setItem("micro849-reviews", JSON.stringify(nextReviews));
    setLocalActivity();
    const answeredAt = new Date().toISOString();
    appendLocalEvent({
      id: eventId,
      questionId: question.id,
      source,
      correct,
      answeredAt,
      activityDate: shanghaiDate(),
      earnedPoints:
        question.scoring === "auto" ? (correct ? question.points : 0) : null,
      possiblePoints: question.points,
    });
    const plan =
      activePlan && activePlan.chapter === question.chapter ? activePlan : null;
    if (plan && !account) {
      const completion = completePlanQuestion(
        plan.completedIds ?? [],
        question.id,
        plan.targetQuestions,
      );
      const updated = { ...plan, ...completion };
      setPlanItems((items) => {
        const next = items.map((item) =>
          String(item.id ?? item.localKey) === activePlanKey ? updated : item,
        );
        localStorage.setItem("micro849-plans", JSON.stringify(next));
        return next;
      });
    }
    try {
      const result = await postAccount({
        action: "progress",
        eventId,
        questionId: question.id,
        status,
        correct,
        reviewStage: stage,
        nextReviewAt,
        source,
        answeredAt,
        planId: plan?.id,
        earnedPoints:
          question.scoring === "auto" ? (correct ? question.points : 0) : null,
        possiblePoints: question.points,
      });
      const savedPlan = result?.plan;
      if (savedPlan)
        setPlanItems((items) =>
          items.map((item) => (item.id === savedPlan.id ? savedPlan : item)),
        );
    } catch {
      setSyncState("error");
    }
  }

  async function submitPractice() {
    if (!currentQuestion || !selectedAnswer.trim() || attemptRecorded) return;
    const correct =
      currentQuestion.scoring === "auto"
        ? isCorrect(currentQuestion, selectedAnswer)
        : false;
    setRevealed(true);
    setAttemptRecorded(true);
    await recordAttempt(
      currentQuestion,
      correct,
      view === "mistakes" ? "review" : "practice",
    );
  }

  function setMasteryStatus(status: ProgressStatus) {
    if (!currentQuestion) return;
    const old = reviews[currentQuestion.id] ?? {
      stage: 0,
      nextReviewAt: null,
      attempts: 0,
      correctAttempts: 0,
    };
    const nextReviewAt =
      status === "mistake"
        ? new Date(Date.now() + 86400000).toISOString()
        : status === "unsure"
          ? new Date(Date.now() + 3 * 86400000).toISOString()
          : null;
    const nextProgress = { ...progress, [currentQuestion.id]: status };
    const nextReviews = {
      ...reviews,
      [currentQuestion.id]: { ...old, nextReviewAt },
    };
    setProgress(nextProgress);
    setReviews(nextReviews);
    localStorage.setItem("micro849-progress", JSON.stringify(nextProgress));
    localStorage.setItem("micro849-reviews", JSON.stringify(nextReviews));
    postAccount({
      action: "status",
      questionId: currentQuestion.id,
      status,
      reviewStage: old.stage,
      nextReviewAt,
    }).catch(() => setSyncState("error"));
    setNotice(
      status === "mastered"
        ? "已标记为掌握"
        : status === "unsure"
          ? "已安排3天后复习"
          : "已加入错题复测",
    );
    window.setTimeout(() => setNotice(""), 1800);
  }

  function nextQuestion(direction = 1) {
    if (!filteredQuestions.length) return;
    const next =
      (currentQuestionIndex + direction + filteredQuestions.length) %
      filteredQuestions.length;
    resetQuestionState(filteredQuestions[next].id);
  }

  async function savePlan() {
    const planDate = shanghaiDate();
    const chapterCount = questions.filter(
      (question) => question.chapter === planChapter,
    ).length;
    const targetQuestions = Math.min(dailyGoal, chapterCount);
    const localKey = planDate + "-" + planChapter;
    const item: PlanItem = {
      localKey,
      planDate,
      chapter: planChapter,
      targetQuestions,
      completedQuestions: 0,
      completedIds: [],
      status: "pending",
    };
    setPlanItems((items) => {
      const next = [
        item,
        ...items.filter(
          (plan) =>
            !(plan.planDate === planDate && plan.chapter === planChapter),
        ),
      ];
      localStorage.setItem("micro849-plans", JSON.stringify(next));
      return next;
    });
    try {
      await postAccount({ action: "profile", dailyGoal, examDate });
      const result = await postAccount({ action: "plan", ...item });
      const savedPlan = result?.plan;
      if (savedPlan)
        setPlanItems((items) => [
          savedPlan,
          ...items.filter(
            (plan) =>
              !(plan.planDate === planDate && plan.chapter === planChapter),
          ),
        ]);
    } catch {
      setSyncState("error");
    }
    setNotice("今日计划已生成，完成题目后会自动回填");
    window.setTimeout(() => setNotice(""), 2200);
  }

  function newExam() {
    const pool = questions.filter(
      (question) =>
        examChapter === "全部章节" || question.chapter === examChapter,
    );
    const selected = selectExamQuestions(pool, examSize);
    const durationSeconds = Math.max(5, examMinutes) * 60;
    const startedAt = new Date().toISOString();
    const draft: ExamDraft = {
      id: crypto.randomUUID(),
      scope: examChapter,
      questionIds: selected.map((question) => question.id),
      answers: {},
      selfChecks: {},
      reviewedSubjective: [],
      currentIndex: 0,
      durationSeconds,
      remainingSeconds: durationSeconds,
      deadlineAt: new Date(Date.now() + durationSeconds * 1000).toISOString(),
      status: "active",
      startedAt,
      viewMode: window.matchMedia("(max-width: 560px)").matches
        ? "focus"
        : "paper",
      paperLayout: buildPaperLayout(
        selected.map((question) => question.id),
        questions,
      ),
      resultVisible: false,
    };
    setExam(draft);
    setReviewFilter("all");
    if (account)
      fetch("/api/exams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          ...draft,
          selfScores: {
            checks: {},
            reviewed: [],
            viewMode: draft.viewMode,
            paperLayout: draft.paperLayout,
            resultVisible: false,
          },
        }),
      }).catch(() => setSyncState("error"));
  }

  async function discardExam() {
    if (!exam) return;
    if (account) {
      try {
        await fetch(`/api/exams?id=${encodeURIComponent(exam.id)}`, {
          method: "DELETE",
        });
      } catch {
        setSyncState("error");
      }
    }
    await deleteExamLocalDrafts(
      exam.id,
      exam.questionIds,
      Object.values(exam.answers).flatMap((answer) =>
        answer.assets.filter((asset) => !asset.remote).map((asset) => asset.id),
      ),
    ).catch(() => {});
    setExam(null);
  }

  function examScore(draft: ExamDraft) {
    return draft.questionIds.reduce((total, id) => {
      const question = questions.find((item) => item.id === id);
      if (!question) return total;
      if (question.scoring === "auto")
        return (
          total +
          (isCorrect(question, examAnswerText(draft.answers[id]))
            ? question.points
            : 0)
        );
      const checked = draft.selfChecks[id] ?? [];
      return total + rubricScore(question.rubric ?? [], checked);
    }, 0);
  }

  function examTotal(draft: ExamDraft) {
    return draft.questionIds.reduce(
      (total, id) =>
        total + (questions.find((item) => item.id === id)?.points ?? 0),
      0,
    );
  }

  function pauseExam() {
    if (!exam) return;
    const remainingSeconds = remainingAt(
      exam.deadlineAt,
      Date.now(),
      exam.remainingSeconds,
    );
    setExam({ ...exam, status: "paused", remainingSeconds, deadlineAt: null });
  }

  function resumeExam() {
    if (!exam) return;
    setExam({
      ...exam,
      status: "active",
      deadlineAt: resumeDeadline(exam.remainingSeconds, Date.now()),
    });
  }

  function setExamFullAnswer(id: number, answer: ExamAnswer) {
    setExam((current) =>
      current
        ? { ...current, answers: { ...current.answers, [id]: answer } }
        : current,
    );
  }

  function submitExam(auto = false) {
    if (!exam || exam.status !== "active") return;
    const unanswered = exam.questionIds.filter(
      (id) => !hasExamAnswer(exam.answers[id]),
    ).length;
    if (
      !auto &&
      unanswered &&
      !window.confirm("还有" + unanswered + "题未作答，确定交卷吗？")
    )
      return;
    setExam({
      ...exam,
      status: "reviewing",
      remainingSeconds: Math.max(0, exam.remainingSeconds),
      deadlineAt: null,
    });
    setNotice(auto ? "考试时间到，已自动交卷" : "已交卷，请完成逐题复盘");
    window.setTimeout(() => setNotice(""), 2200);
  }

  function toggleRubric(questionId: number, rubricId: string) {
    if (!exam) return;
    const current = exam.selfChecks[questionId] ?? [];
    const next = current.includes(rubricId)
      ? current.filter((id) => id !== rubricId)
      : [...current, rubricId];
    setExam({
      ...exam,
      selfChecks: { ...exam.selfChecks, [questionId]: next },
    });
  }

  function confirmSubjective(questionId: number) {
    if (!exam) return;
    setExam({
      ...exam,
      reviewedSubjective: Array.from(
        new Set([...exam.reviewedSubjective, questionId]),
      ),
    });
  }

  async function finishReview() {
    if (!exam) return;
    const subjectiveIds = exam.questionIds.filter(
      (id) =>
        questions.find((question) => question.id === id)?.scoring === "rubric",
    );
    if (subjectiveIds.some((id) => !exam.reviewedSubjective.includes(id))) {
      setNotice("请先确认所有主观题的量规自评");
      window.setTimeout(() => setNotice(""), 2000);
      return;
    }
    setResultBusy(true);
    const completed = {
      ...exam,
      status: "completed" as const,
      resultVisible: true,
    };
    const nextProgress = { ...progress };
    const nextReviews = { ...reviews };
    let answeredCount = 0;
    for (const id of completed.questionIds) {
      const question = questions.find((item) => item.id === id);
      if (!question || !hasExamAnswer(completed.answers[id])) continue;
      answeredCount += 1;
      const earned =
        question.scoring === "auto"
          ? isCorrect(question, examAnswerText(completed.answers[id]))
            ? question.points
            : 0
          : rubricScore(question.rubric ?? [], completed.selfChecks[id] ?? []);
      const correct = earned === question.points;
      nextProgress[id] = correct ? "mastered" : "mistake";
      const old = nextReviews[id] ?? {
        stage: 0,
        nextReviewAt: null,
        attempts: 0,
        correctAttempts: 0,
      };
      const nextReviewAt = correct
        ? null
        : new Date(Date.now() + 86400000).toISOString();
      nextReviews[id] = {
        stage: 0,
        nextReviewAt,
        attempts: old.attempts + 1,
        correctAttempts: old.correctAttempts + (correct ? 1 : 0),
      };
      const eventId = completed.id + ":" + id;
      const answeredAt = new Date().toISOString();
      appendLocalEvent({
        id: eventId,
        questionId: id,
        source: "exam",
        correct,
        answeredAt,
        activityDate: shanghaiDate(),
        earnedPoints: earned,
        possiblePoints: question.points,
      });
      postAccount({
        action: "progress",
        eventId,
        questionId: id,
        status: nextProgress[id],
        correct,
        reviewStage: 0,
        nextReviewAt,
        source: "exam",
        answeredAt,
        earnedPoints: earned,
        possiblePoints: question.points,
      }).catch(() => setSyncState("error"));
    }
    setProgress(nextProgress);
    setReviews(nextReviews);
    localStorage.setItem("micro849-progress", JSON.stringify(nextProgress));
    localStorage.setItem("micro849-reviews", JSON.stringify(nextReviews));
    setLocalActivity(answeredCount);
    const durationSeconds =
      completed.durationSeconds - completed.remainingSeconds;
    setExamHistory((items) => [
      ...items.filter((item) => item.id !== completed.id),
      {
        id: completed.id,
        score: examScore(completed),
        total: examTotal(completed),
        durationSeconds,
        completedAt: new Date().toISOString(),
      },
    ]);
    postAccount({
      action: "exam",
      id: completed.id,
      scope: completed.scope,
      questionIds: completed.questionIds,
      answers: completed.answers,
      score: examScore(completed),
      total: examTotal(completed),
      durationSeconds,
    }).catch(() => setSyncState("error"));
    window.setTimeout(() => {
      setExam(completed);
      setResultBusy(false);
    }, 240);
  }

  function formatClock(seconds: number) {
    const safe = Math.max(0, seconds);
    return (
      String(Math.floor(safe / 60)).padStart(2, "0") +
      ":" +
      String(safe % 60).padStart(2, "0")
    );
  }

  async function saveAccountSettings() {
    if (!account) return;
    setSettingsSaving(true);
    setSettingsError("");
    try {
      const response = await fetch("/api/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "profile",
          nickname: settingsNickname,
          studyId: settingsStudyId,
          bio: settingsBio,
          dailyGoal,
          examDate,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        profile?: { nickname?: string; studyId: string; bio?: string };
      };
      if (!response.ok) throw new Error(data.error || "保存失败");
      if (!data.profile) throw new Error("账户响应格式无效");
      setAccount({
        ...account,
        displayName: data.profile.nickname || account.baseDisplayName,
        studyId: data.profile.studyId,
        bio: data.profile.bio || "",
      });
      setSettingsOpen(false);
      setNotice("账户设置已保存");
      window.setTimeout(() => setNotice(""), 1800);
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : "保存失败，请稍后重试",
      );
    } finally {
      setSettingsSaving(false);
    }
  }

  function adjustFontSize(direction: -1 | 1) {
    const current = fontSizes.findIndex((size) => size.id === fontSize);
    setFontSize(
      fontSizes[
        Math.min(fontSizes.length - 1, Math.max(0, current + direction))
      ].id,
    );
  }

  const reviewQuestions = exam
    ? exam.questionIds
        .map((id) => questions.find((question) => question.id === id))
        .filter((item): item is Question => Boolean(item))
        .filter((question) => {
          const answer = examAnswerText(exam.answers[question.id]);
          if (reviewFilter === "unanswered")
            return !hasExamAnswer(exam.answers[question.id]);
          if (reviewFilter === "subjective")
            return question.scoring === "rubric";
          if (reviewFilter === "wrong") {
            if (question.scoring === "auto")
              return !isCorrect(question, answer);
            const earned = rubricScore(
              question.rubric ?? [],
              exam.selfChecks[question.id] ?? [],
            );
            return earned < question.points;
          }
          return true;
        })
    : [];
  const examBreakdown = exam
    ? exam.questionIds.reduce(
        (summary, id) => {
          const question = questions.find((item) => item.id === id);
          if (!question) return summary;
          const answered = hasExamAnswer(exam.answers[id]);
          const earned =
            question.scoring === "auto"
              ? isCorrect(question, examAnswerText(exam.answers[id]))
                ? question.points
                : 0
              : rubricScore(question.rubric ?? [], exam.selfChecks[id] ?? []);
          const bucket =
            question.scoring === "auto" ? "objective" : "subjective";
          summary[bucket].earned += earned;
          summary[bucket].possible += question.points;
          if (!answered) summary.unanswered += 1;
          summary.chapterLoss[question.chapter] =
            (summary.chapterLoss[question.chapter] ?? 0) +
            (question.points - earned);
          return summary;
        },
        {
          objective: { earned: 0, possible: 0 },
          subjective: { earned: 0, possible: 0 },
          unanswered: 0,
          chapterLoss: {} as Record<string, number>,
        },
      )
    : null;

  return (
    <div className="app-shell">
      <div
        className={sidebarCollapsed ? "sidebar-collapsed" : ""}
        inert={modalOpen ? true : undefined}
        aria-hidden={modalOpen ? "true" : undefined}
      >
        <aside
          className={"sidebar " + (sidebarOpen ? "sidebar-open" : "")}
          aria-label="学习导航"
        >
          <div className="brand">
            <button
              className="brand-home"
              onClick={returnHome}
              aria-label="返回学习首页"
            >
              <div className="brand-mark" aria-hidden="true">
                <span>8</span>
                <span>49</span>
              </div>
              <div className="brand-copy">
                <strong>微机研习社</strong>
                <small>849 STUDY LAB</small>
              </div>
            </button>
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label={
                sidebarCollapsed ? "展开左侧导航栏" : "收起左侧导航栏"
              }
            >
              {sidebarCollapsed ? "›" : "‹"}
            </button>
          </div>
          <nav className="main-nav" aria-label="主要功能">
            <p className="nav-title">学习工作台</p>
            {navItems.map((item) => (
              <button
                key={item.id}
                className={view === item.id ? "nav-active" : ""}
                onClick={() => switchView(item.id)}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
                {item.id === "mistakes" && <em>{dueReviews}</em>}
              </button>
            ))}
          </nav>
          <div className="chapter-nav">
            <p className="nav-title">知识树 · 11章</p>
            {chapterGroups.map((chapter) => (
              <button
                key={chapter.name}
                onClick={() => beginChapter(chapter.name)}
              >
                <span>{chapter.code}</span>
                <div>
                  <strong>{chapter.name}</strong>
                  <small>
                    {chapter.sections.length} 专题 · {chapter.target}题
                  </small>
                </div>
              </button>
            ))}
          </div>
          <div className="book-card">
            <span>题库版本</span>
            <strong>200题 · 逐题编辑复核</strong>
            <small>110选择 / 35计算 / 55主观</small>
          </div>
        </aside>

        <div className="content-shell">
          <header className="topbar">
            <button
              className="mobile-menu"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="打开学习导航"
            >
              ☰
            </button>
            <div className="breadcrumb">
              <span>849 微机原理及应用</span>
              <b>/</b>
              <strong>
                {navItems.find((item) => item.id === view)?.label}
              </strong>
            </div>
            <div className="top-actions">
              <button
                className="search-button"
                onClick={() => setSearchOpen(true)}
              >
                ⌕ <span>搜索题目</span>
                <kbd>⌘ K</kbd>
              </button>
              <div
                className="font-controls"
                role="group"
                aria-label="调节网站字体大小"
              >
                <button
                  onClick={() => adjustFontSize(-1)}
                  disabled={fontSize === "small"}
                  aria-label="缩小字体"
                >
                  A−
                </button>
                <span>
                  字号 {fontSizes.find((size) => size.id === fontSize)?.label}
                </span>
                <button
                  onClick={() => adjustFontSize(1)}
                  disabled={fontSize === "xlarge"}
                  aria-label="放大字体"
                >
                  A＋
                </button>
              </div>
              <button
                className="icon-button"
                onClick={() => setDark(!dark)}
                aria-label="切换深色模式"
              >
                {dark ? "☀" : "☾"}
              </button>
              <button
                className="icon-button"
                onClick={() => {
                  setSettingsError("");
                  setSettingsOpen(true);
                }}
                aria-label="打开账户与显示设置"
              >
                ⚙
              </button>
              {account ? (
                <button
                  className="account-chip"
                  onClick={() => setSettingsOpen(true)}
                >
                  <span>{account.displayName.slice(0, 1).toUpperCase()}</span>
                  <small>{account.displayName}</small>
                </button>
              ) : (
                <a
                  className="signin-button"
                  href="/signin-with-chatgpt?return_to=%2F"
                >
                  登录同步
                </a>
              )}
            </div>
          </header>

          <main>
            {view === "home" && (
              <>
                <section className="hero-panel">
                  <div className="hero-copy">
                    <span className="eyebrow">
                      <i /> 2027 考研 · 上海理工大学
                    </span>
                    <h1>
                      把 849 的每一个
                      <br />
                      <em>失分点</em>，练成得分点。
                    </h1>
                    <p>
                      200道题已完成逐题编辑式复核，增加汇编编程与综合设计训练；不宣称专家认证。
                    </p>
                    <div className="hero-actions">
                      <button
                        className="primary-button"
                        onClick={() => beginChapter("8086 CPU结构")}
                      >
                        开始章节训练 →
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => switchView("exam")}
                      >
                        快速组卷
                      </button>
                    </div>
                    <div className="hero-meta">
                      <span>✓ 11章52专题</span>
                      <span>✓ 55道编程与设计题</span>
                      <span>
                        ✓ {account ? "账户跨设备同步" : "登录后跨设备同步"}
                      </span>
                    </div>
                  </div>
                  <div className="countdown-card">
                    <span>距离预计初试</span>
                    <strong>{daysLeft ?? "—"}</strong>
                    <b>DAYS</b>
                    <p>目标：完成3轮知识闭环</p>
                    <div className="countdown-track">
                      <i />
                    </div>
                    <small>当前阶段 · 基础强化</small>
                  </div>
                </section>
                <section className="stats-grid" aria-label="学习概览">
                  <article>
                    <span className="stat-icon cyan">∿</span>
                    <div>
                      <small>累计已练</small>
                      <strong>
                        {Object.keys(progress).length}
                        <em>题</em>
                      </strong>
                      <p>题库共200题</p>
                    </div>
                  </article>
                  <article>
                    <span className="stat-icon amber">◎</span>
                    <div>
                      <small>当前正确率</small>
                      <strong>
                        {accuracy}
                        <em>%</em>
                      </strong>
                      <p>按真实作答计算</p>
                    </div>
                  </article>
                  <article>
                    <span className="stat-icon violet">◇</span>
                    <div>
                      <small>已掌握</small>
                      <strong>
                        {mastered}
                        <em>/200</em>
                      </strong>
                      <p>覆盖52个专题</p>
                    </div>
                  </article>
                  <article>
                    <span className="stat-icon red">↻</span>
                    <div>
                      <small>今日到期复测</small>
                      <strong>
                        {dueReviews}
                        <em>题</em>
                      </strong>
                      <button onClick={() => switchView("mistakes")}>
                        开始复测 →
                      </button>
                    </div>
                  </article>
                </section>
                <section className="dashboard-grid">
                  <article className="study-card">
                    <div className="section-heading">
                      <div>
                        <span>今日任务</span>
                        <h2>继续学习计划</h2>
                      </div>
                      <button onClick={() => switchView("plan")}>
                        管理计划
                      </button>
                    </div>
                    <div className="task-list">
                      {planItems.slice(0, 3).map((item, index) => (
                        <button
                          key={String(item.id ?? item.localKey)}
                          onClick={() => beginPlan(item)}
                        >
                          <span className="task-number">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <b>{item.chapter}</b>
                            <small>
                              {item.completedQuestions}/{item.targetQuestions}题
                              · 自动回填
                            </small>
                          </div>
                          <em>
                            <i
                              style={{
                                width:
                                  String(
                                    Math.round(
                                      (item.completedQuestions /
                                        item.targetQuestions) *
                                        100,
                                    ),
                                  ) + "%",
                              }}
                            />
                            {item.status === "completed" ? "已完成" : "进行中"}
                          </em>
                          <strong>继续 →</strong>
                        </button>
                      ))}
                      {!planItems.length && (
                        <div className="empty-inline">
                          还没有计划，前往“学习计划”生成今日任务。
                        </div>
                      )}
                    </div>
                  </article>
                  <article className="activity-card">
                    <div className="section-heading">
                      <div>
                        <span>真实历史</span>
                        <h2>近10周 · 含本周</h2>
                      </div>
                      <b>今日 {activity[shanghaiDate()] ?? 0} 次</b>
                    </div>
                    <div className="heat-wrap">
                      <div className="heat-labels">
                        <span>一</span>
                        <span>三</span>
                        <span>五</span>
                        <span>日</span>
                      </div>
                      <div
                        className="heatmap"
                        role="list"
                        aria-label="包含本周的近十周真实学习热力图"
                      >
                        {heatDays.map((day) => (
                          <span
                            key={day.key}
                            className="heat-cell"
                            role="listitem"
                            tabIndex={!day.isFuture && day.count > 0 ? 0 : -1}
                            data-level={day.level}
                            data-today={day.isToday || undefined}
                            data-future={day.isFuture || undefined}
                            aria-label={`${day.label}，${day.isFuture ? "尚未到达" : `${day.count} 次有效作答，强度 ${heatLevelLabels[day.level]}`}`}
                          >
                            <span className="heat-tooltip" aria-hidden="true">
                              <strong>
                                {day.label}
                                {day.isToday ? " · 今天" : ""}
                              </strong>
                              <b>
                                {day.isFuture
                                  ? "本周尚未到达"
                                  : `${day.count} 次有效作答`}
                              </b>
                              <small>
                                {day.isFuture
                                  ? "未来日期"
                                  : `强度 · ${heatLevelLabels[day.level]}`}
                              </small>
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="heat-footer">
                      <span>含本周，按上海时区记录</span>
                      <span
                        className="heat-legend"
                        aria-label="作答次数强度图例"
                      >
                        <span>
                          <i data-level="0" />0
                        </span>
                        <span>
                          <i data-level="1" />
                          1–4
                        </span>
                        <span>
                          <i data-level="2" />
                          5–9
                        </span>
                        <span>
                          <i data-level="3" />
                          10–19
                        </span>
                        <span>
                          <i data-level="4" />
                          20+
                        </span>
                      </span>
                    </div>
                  </article>
                </section>
              </>
            )}

            {(view === "practice" || view === "mistakes") && (
              <section className="practice-view">
                <div className="practice-header">
                  <div>
                    <span className="eyebrow">
                      <i /> 逐题编辑复核题库
                    </span>
                    <h1>{view === "mistakes" ? "错题复测" : "章节刷题"}</h1>
                    <p>
                      {activePlan
                        ? "当前计入计划：" +
                          activePlan.chapter +
                          "，每道不同题首次提交自动回填。"
                        : "先独立作答，再查看参考答案、解析与评分量规。"}
                    </p>
                  </div>
                  <div className="question-count">
                    <strong>{filteredQuestions.length}</strong>
                    <span>当前题目</span>
                  </div>
                </div>
                <div className="filter-bar">
                  <label>
                    章节
                    <select
                      value={selectedChapter}
                      onChange={(event) => {
                        setSelectedChapter(event.target.value);
                        resetQuestionState();
                      }}
                    >
                      <option>全部章节</option>
                      {chapterGroups.map((chapter) => (
                        <option key={chapter.name}>{chapter.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    难度
                    <select
                      value={difficulty}
                      onChange={(event) => {
                        setDifficulty(event.target.value);
                        resetQuestionState();
                      }}
                    >
                      <option>全部难度</option>
                      <option>基础</option>
                      <option>强化</option>
                      <option>综合</option>
                    </select>
                  </label>
                  {searchFilter && (
                    <button
                      className="filter-chip"
                      onClick={() => {
                        setSearchFilter("");
                        resetQuestionState();
                      }}
                    >
                      搜索：{searchFilter} ×
                    </button>
                  )}
                  <span>
                    第 {currentQuestionIndex + 1} / {filteredQuestions.length}{" "}
                    题
                  </span>
                </div>
                {currentQuestion ? (
                  <article className="question-card">
                    <div className="question-meta">
                      <span>#{currentQuestion.id}</span>
                      <b>{currentQuestion.chapter}</b>
                      <b>{currentQuestion.section}</b>
                      <em data-difficulty={currentQuestion.difficulty}>
                        {currentQuestion.difficulty}
                      </em>
                      <small>
                        {currentQuestion.type} · {currentQuestion.points}分
                      </small>
                    </div>
                    <h2>{currentQuestion.prompt}</h2>
                    {currentQuestion.options ? (
                      <div className="options-list">
                        {currentQuestion.options.map((option, index) => {
                          const letter = String.fromCharCode(65 + index);
                          const correct =
                            revealed && letter === currentQuestion.answer;
                          const wrong =
                            revealed &&
                            selectedAnswer === letter &&
                            letter !== currentQuestion.answer;
                          return (
                            <button
                              key={letter}
                              className={
                                (selectedAnswer === letter ? "selected " : "") +
                                (correct ? "correct " : "") +
                                (wrong ? "wrong" : "")
                              }
                              onClick={() =>
                                !revealed && setSelectedAnswer(letter)
                              }
                            >
                              <span>{letter}</span>
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <label className="answer-input">
                        你的答案
                        {currentQuestion.scoring === "rubric" ? (
                          <textarea
                            rows={8}
                            value={selectedAnswer}
                            onChange={(event) =>
                              setSelectedAnswer(event.target.value)
                            }
                            placeholder="写出程序、步骤或设计说明"
                            disabled={revealed}
                          />
                        ) : (
                          <input
                            value={selectedAnswer}
                            onChange={(event) =>
                              setSelectedAnswer(event.target.value)
                            }
                            placeholder="输入计算结果或结论"
                            disabled={revealed}
                          />
                        )}
                      </label>
                    )}
                    {!revealed ? (
                      <button
                        className="primary-button submit-answer"
                        onClick={submitPractice}
                        disabled={!selectedAnswer.trim()}
                      >
                        提交并查看解析
                      </button>
                    ) : (
                      <div className="analysis-panel">
                        <div className="answer-result">
                          <span>参考答案</span>
                          <strong>
                            {currentQuestion.scoring === "auto"
                              ? currentQuestion.answer
                              : "量规自评"}
                          </strong>
                          <em>
                            {currentQuestion.scoring === "auto"
                              ? isCorrect(currentQuestion, selectedAnswer)
                                ? "回答正确"
                                : "需要复测"
                              : "请对照评分点检查"}
                          </em>
                        </div>
                        <div>
                          <span>解题解析 / 参考方案</span>
                          <p>{currentQuestion.explanation}</p>
                          {currentQuestion.rubric && (
                            <ul className="rubric-list">
                              {currentQuestion.rubric.map((item) => (
                                <li key={item.id}>
                                  <b>{item.points}分</b>
                                  {item.label}
                                </li>
                              ))}
                            </ul>
                          )}
                          <small>
                            <b>核心考点：</b>
                            {currentQuestion.keypoint}
                          </small>
                        </div>
                      </div>
                    )}
                    <div className="question-footer">
                      <div>
                        <span>掌握状态</span>
                        <button onClick={() => setMasteryStatus("mastered")}>
                          ✓ 已掌握
                        </button>
                        <button onClick={() => setMasteryStatus("unsure")}>
                          ? 有点模糊
                        </button>
                        <button onClick={() => setMasteryStatus("mistake")}>
                          ↻ 加入错题
                        </button>
                      </div>
                      <div>
                        <button onClick={() => nextQuestion(-1)}>
                          ← 上一题
                        </button>
                        <button
                          className="next-button"
                          onClick={() => nextQuestion(1)}
                        >
                          下一题 →
                        </button>
                      </div>
                    </div>
                  </article>
                ) : (
                  <div className="empty-state">
                    <strong>当前筛选下没有题目</strong>
                    <p>清除搜索或更换章节、难度后继续。</p>
                  </div>
                )}
              </section>
            )}

            {view === "mastery" && (
              <section className="mastery-view">
                <div className="practice-header">
                  <div>
                    <span className="eyebrow">
                      <i /> COURSE CATALOG
                    </span>
                    <h1>849题库目录</h1>
                    <p>11章、52专题、200道逐题命制题目。</p>
                  </div>
                  <div className="mastery-score">
                    <strong>{mastered}</strong>
                    <span>已掌握 / 200</span>
                  </div>
                </div>
                <div className="mastery-grid">
                  {chapterGroups.map((chapter) => {
                    const items = questions.filter(
                      (question) => question.chapter === chapter.name,
                    );
                    const done = items.filter(
                      (question) => progress[question.id] === "mastered",
                    ).length;
                    const percent = Math.round((done / items.length) * 100);
                    return (
                      <article key={chapter.name}>
                        <div className="mastery-top">
                          <span>{chapter.code}</span>
                          <div>
                            <h2>{chapter.name}</h2>
                            <p>{chapter.source}</p>
                          </div>
                          <strong>{percent}%</strong>
                        </div>
                        <div className="catalog-count">
                          <span>{chapter.sections.length}个专题</span>
                          <span>{items.length}道已上线</span>
                        </div>
                        <div className="mastery-progress">
                          <i style={{ width: String(percent) + "%" }} />
                        </div>
                        <ul>
                          {chapter.sections.map((section) => (
                            <li key={section}>
                              <button
                                onClick={() => beginChapter(chapter.name)}
                              >
                                <span className="good" />
                                {section}
                                <em>可练</em>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {view === "analytics" && (
              <AnalyticsView
                account={Boolean(account)}
                localEvents={localEvents}
                localProgress={Object.entries(reviews).map(
                  ([questionId, item]) => ({
                    questionId: Number(questionId),
                    attempts: item.attempts,
                    correctAttempts: item.correctAttempts,
                    status: progress[Number(questionId)],
                    nextReviewAt: item.nextReviewAt,
                  }),
                )}
                localExams={examHistory}
                dueReviews={dueReviews}
                todayKey={shanghaiDate()}
              />
            )}

            {view === "plan" && (
              <section className="workspace-view">
                <div className="practice-header">
                  <div>
                    <span className="eyebrow">
                      <i /> SMART STUDY PLAN
                    </span>
                    <h1>学习计划</h1>
                    <p>从计划进入训练后，不同题目的首次提交会自动回填进度。</p>
                  </div>
                  <div className="question-count">
                    <strong>{daysLeft}</strong>
                    <span>距离考试 / 天</span>
                  </div>
                </div>
                <div className="plan-layout">
                  <article className="tool-card">
                    <div className="section-heading">
                      <div>
                        <span>计划设置</span>
                        <h2>生成今日任务</h2>
                      </div>
                      <b>{account ? "账户同步" : "本机模式"}</b>
                    </div>
                    <div className="form-grid">
                      <label>
                        预计考试日期
                        <input
                          type="date"
                          value={examDate}
                          onChange={(event) => setExamDate(event.target.value)}
                        />
                      </label>
                      <label>
                        每日目标题量
                        <input
                          type="number"
                          min="5"
                          max="100"
                          value={dailyGoal}
                          onChange={(event) =>
                            setDailyGoal(
                              Math.min(
                                100,
                                Math.max(5, Number(event.target.value)),
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="wide">
                        今日主攻章节
                        <select
                          value={planChapter}
                          onChange={(event) =>
                            setPlanChapter(event.target.value)
                          }
                        >
                          {chapterGroups.map((chapter) => (
                            <option key={chapter.name}>{chapter.name}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <button className="primary-button" onClick={savePlan}>
                      生成并保存计划
                    </button>
                  </article>
                  <article className="tool-card">
                    <div className="section-heading">
                      <div>
                        <span>计数规则</span>
                        <h2>真实完成进度</h2>
                      </div>
                    </div>
                    <ol className="plan-steps">
                      <li>
                        <b>01</b>
                        <span>
                          <strong>从计划进入</strong>
                          <small>绑定当前计划与章节</small>
                        </span>
                      </li>
                      <li>
                        <b>02</b>
                        <span>
                          <strong>首次提交计数</strong>
                          <small>答对答错均算完成，同题不重复</small>
                        </span>
                      </li>
                      <li>
                        <b>03</b>
                        <span>
                          <strong>达到目标完成</strong>
                          <small>自动同步计划状态</small>
                        </span>
                      </li>
                    </ol>
                  </article>
                </div>
                <article className="tool-card plan-history">
                  <div className="section-heading">
                    <div>
                      <span>已保存任务</span>
                      <h2>最近学习计划</h2>
                    </div>
                  </div>
                  {planItems.length ? (
                    <div className="history-list">
                      {planItems.slice(0, 10).map((item) => (
                        <button
                          key={String(item.id ?? item.localKey)}
                          onClick={() => beginPlan(item)}
                        >
                          <span>{item.planDate}</span>
                          <strong>{item.chapter}</strong>
                          <em>
                            {item.completedQuestions}/{item.targetQuestions}题
                          </em>
                          <b>
                            {item.status === "completed"
                              ? "已完成"
                              : "去学习 →"}
                          </b>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-inline">
                      还没有计划，先生成今天的第一项任务。
                    </div>
                  )}
                </article>
              </section>
            )}

            {view === "exam" && (
              <section className="workspace-view">
                <div className="practice-header">
                  <div>
                    <span className="eyebrow">
                      <i /> EXAM BUILDER 2.0
                    </span>
                    <h1>组卷考试</h1>
                    <p>倒计时、答题卡、跨设备暂存和交卷后逐题复盘。</p>
                  </div>
                  <div className="question-count">
                    <strong>{exam?.questionIds.length ?? examSize}</strong>
                    <span>本卷题量</span>
                  </div>
                </div>
                {!exam ? (
                  <div className="exam-layout">
                    <article className="tool-card">
                      <div className="section-heading">
                        <div>
                          <span>组卷参数</span>
                          <h2>创建练习卷</h2>
                        </div>
                      </div>
                      <div className="form-grid">
                        <label className="wide">
                          考试范围
                          <select
                            value={examChapter}
                            onChange={(event) =>
                              setExamChapter(event.target.value)
                            }
                          >
                            <option>全部章节</option>
                            {chapterGroups.map((chapter) => (
                              <option key={chapter.name}>{chapter.name}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          题目数量
                          <select
                            value={examSize}
                            onChange={(event) => {
                              const size = Number(event.target.value);
                              setExamSize(size);
                              setExamMinutes(Math.ceil(size * 1.5));
                            }}
                          >
                            <option value="10">10题</option>
                            <option value="20">20题</option>
                            <option value="40">40题</option>
                          </select>
                        </label>
                        <label>
                          考试时长
                          <select
                            value={
                              [30, 60, 90, 120].includes(examMinutes)
                                ? String(examMinutes)
                                : "custom"
                            }
                            onChange={(event) =>
                              event.target.value !== "custom" &&
                              setExamMinutes(Number(event.target.value))
                            }
                          >
                            <option value="30">30分钟</option>
                            <option value="60">60分钟</option>
                            <option value="90">90分钟</option>
                            <option value="120">120分钟</option>
                            <option value="custom">自定义</option>
                          </select>
                        </label>
                        <label className="wide">
                          自定义分钟
                          <input
                            type="number"
                            min="5"
                            max="300"
                            value={examMinutes}
                            onChange={(event) =>
                              setExamMinutes(
                                Math.min(
                                  300,
                                  Math.max(5, Number(event.target.value)),
                                ),
                              )
                            }
                          />
                        </label>
                      </div>
                      <button className="primary-button" onClick={newExam}>
                        开始考试
                      </button>
                    </article>
                    <article className="result-card">
                      <span>智能推荐</span>
                      <strong>
                        {Math.ceil(examSize * 1.5)}
                        <em>分钟</em>
                      </strong>
                      <p>默认按每题1.5分钟</p>
                      <small>主观题交卷后使用量规自评。</small>
                    </article>
                  </div>
                ) : exam.status === "paused" ? (
                  <article className="tool-card resume-card">
                    <span className="eyebrow">
                      <i /> 已安全暂存
                    </span>
                    <h2>继续上次考试</h2>
                    <p>
                      {exam.scope} · {exam.questionIds.length}题 · 剩余
                      {formatClock(exam.remainingSeconds)}
                    </p>
                    <div className="hero-actions">
                      <button className="primary-button" onClick={resumeExam}>
                        继续考试
                      </button>
                      <button
                        className="secondary-button"
                        onClick={discardExam}
                      >
                        放弃本卷
                      </button>
                    </div>
                  </article>
                ) : exam.status === "active" ? (
                  <ExamActiveWorkspace
                    exam={exam}
                    bank={questions}
                    account={Boolean(account)}
                    formatClock={formatClock}
                    onChange={setExam}
                    onAnswer={setExamFullAnswer}
                    onPause={pauseExam}
                    onSubmit={() => submitExam(false)}
                  />
                ) : exam.status === "completed" && exam.resultVisible ? (
                  <section className="exam-result-screen" aria-live="polite">
                    <div className="result-hero">
                      <span className="eyebrow">
                        <i /> SCORE REPORT
                      </span>
                      <h2 ref={resultTitleRef} tabIndex={-1}>
                        成绩已生成
                      </h2>
                      <div className="result-score">
                        <strong>{examScore(exam)}</strong>
                        <span>/ {examTotal(exam)} 分</span>
                        <em>
                          {Math.round(
                            (examScore(exam) / Math.max(1, examTotal(exam))) *
                              100,
                          )}
                          %
                        </em>
                      </div>
                      <p>
                        {exam.scope} · 用时{" "}
                        {Math.round(
                          (exam.durationSeconds - exam.remainingSeconds) / 60,
                        )}{" "}
                        分钟
                      </p>
                    </div>
                    <div className="result-metrics">
                      <article>
                        <span>客观题</span>
                        <strong>
                          {examBreakdown?.objective.earned}/
                          {examBreakdown?.objective.possible}
                        </strong>
                      </article>
                      <article>
                        <span>主观题</span>
                        <strong>
                          {examBreakdown?.subjective.earned}/
                          {examBreakdown?.subjective.possible}
                        </strong>
                      </article>
                      <article>
                        <span>未作答</span>
                        <strong>{examBreakdown?.unanswered}题</strong>
                      </article>
                      <article>
                        <span>用时</span>
                        <strong>
                          {Math.round(
                            (exam.durationSeconds - exam.remainingSeconds) / 60,
                          )}
                          分钟
                        </strong>
                      </article>
                    </div>
                    <article className="result-loss-card">
                      <div className="section-heading">
                        <div>
                          <span>LOSS DISTRIBUTION</span>
                          <h3>章节失分分布</h3>
                        </div>
                      </div>
                      <div className="loss-bars">
                        {Object.entries(examBreakdown?.chapterLoss ?? {})
                          .sort((a, b) => b[1] - a[1])
                          .map(([chapter, loss]) => (
                            <div key={chapter}>
                              <span>{chapter}</span>
                              <i>
                                <b
                                  style={{
                                    width: `${Math.min(100, (loss / Math.max(1, examTotal(exam) - examScore(exam))) * 100)}%`,
                                  }}
                                />
                              </i>
                              <strong>-{loss}分</strong>
                            </div>
                          ))}
                      </div>
                    </article>
                    <div className="result-actions">
                      <button
                        className="primary-button"
                        onClick={() => {
                          setReviewFilter("wrong");
                          setExam({ ...exam, resultVisible: false });
                        }}
                      >
                        只看失分题
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => {
                          setReviewFilter("all");
                          setExam({ ...exam, resultVisible: false });
                        }}
                      >
                        继续逐题复盘
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => {
                          setNotice("失分题已进入间隔复测队列");
                          window.setTimeout(() => setNotice(""), 2000);
                        }}
                      >
                        加入错题复测
                      </button>
                      <button onClick={discardExam}>返回组卷</button>
                    </div>
                  </section>
                ) : (
                  <section className="review-view">
                    <div className="review-summary">
                      <div>
                        <span>本卷得分</span>
                        <strong>
                          {examScore(exam)} / {examTotal(exam)}
                        </strong>
                        <small>
                          {exam.status === "completed"
                            ? "复盘已完成"
                            : "主观题自评后生成最终成绩"}
                        </small>
                      </div>
                      <div
                        className="review-filters"
                        role="group"
                        aria-label="复盘筛选"
                      >
                        {(
                          ["all", "wrong", "unanswered", "subjective"] as const
                        ).map((filter) => (
                          <button
                            key={filter}
                            className={reviewFilter === filter ? "active" : ""}
                            onClick={() => setReviewFilter(filter)}
                          >
                            {filter === "all"
                              ? "全部"
                              : filter === "wrong"
                                ? "错误/待评"
                                : filter === "unanswered"
                                  ? "未答"
                                  : "主观题"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="review-list">
                      {reviewQuestions.map((question, index) => {
                        const given = examAnswerText(exam.answers[question.id]);
                        const correct =
                          question.scoring === "auto" &&
                          isCorrect(question, given);
                        return (
                          <article key={question.id} className="review-card">
                            <div className="question-meta">
                              <span>#{question.id}</span>
                              <b>{question.chapter}</b>
                              <small>
                                {question.type} · {question.points}分
                              </small>
                            </div>
                            <h2>
                              {index + 1}. {question.prompt}
                            </h2>
                            <dl>
                              <div>
                                <dt>你的答案</dt>
                                <dd>{given || "未作答"}</dd>
                              </div>
                              <div>
                                <dt>参考答案</dt>
                                <dd>{question.answer}</dd>
                              </div>
                            </dl>
                            {question.scoring === "auto" ? (
                              <p
                                className={
                                  correct ? "review-correct" : "review-wrong"
                                }
                              >
                                {correct ? "回答正确" : "回答错误或未答"}
                              </p>
                            ) : (
                              <div className="self-rubric">
                                <SubjectiveAnswerTools
                                  examId={exam.id}
                                  question={question}
                                  answer={
                                    exam.answers[question.id] ??
                                    emptyExamAnswer()
                                  }
                                  account={Boolean(account)}
                                  phase="review"
                                  disabled={exam.status === "completed"}
                                  onChange={(next) =>
                                    setExamFullAnswer(question.id, next)
                                  }
                                />
                                <p>{question.explanation}</p>
                                {question.rubric?.map((item) => (
                                  <label
                                    key={item.id}
                                    className={
                                      exam.answers[
                                        question.id
                                      ]?.analysis?.suggestedRubricIds.includes(
                                        item.id,
                                      )
                                        ? "ai-suggested"
                                        : ""
                                    }
                                  >
                                    <input
                                      type="checkbox"
                                      checked={(
                                        exam.selfChecks[question.id] ?? []
                                      ).includes(item.id)}
                                      onChange={() =>
                                        toggleRubric(question.id, item.id)
                                      }
                                      disabled={exam.status === "completed"}
                                    />{" "}
                                    <span>{item.label}</span>
                                    <b>{item.points}分</b>
                                    {exam.answers[
                                      question.id
                                    ]?.analysis?.suggestedRubricIds.includes(
                                      item.id,
                                    ) && <em>AI建议，需自行确认</em>}
                                  </label>
                                ))}
                                {exam.status !== "completed" && (
                                  <button
                                    onClick={() =>
                                      confirmSubjective(question.id)
                                    }
                                  >
                                    {exam.reviewedSubjective.includes(
                                      question.id,
                                    )
                                      ? "已确认本题自评"
                                      : "确认本题自评"}
                                  </button>
                                )}
                              </div>
                            )}
                            <p className="review-explanation">
                              <b>解析：</b>
                              {question.explanation}
                            </p>
                            <small>
                              <b>核心考点：</b>
                              {question.keypoint}
                            </small>
                          </article>
                        );
                      })}
                    </div>
                    {exam.status !== "completed" ? (
                      <button
                        className="primary-button finish-review"
                        onClick={finishReview}
                        disabled={resultBusy}
                      >
                        {resultBusy ? "正在汇总…" : "完成复盘并生成成绩"}
                      </button>
                    ) : (
                      <button
                        className="primary-button finish-review"
                        onClick={() =>
                          setExam({ ...exam, resultVisible: true })
                        }
                      >
                        查看成绩页
                      </button>
                    )}
                  </section>
                )}
              </section>
            )}
          </main>
          <footer>
            <span>849微机研习社 · 200题逐题编辑复核</span>
            <span>题库、计划、组卷与间隔复测</span>
          </footer>
        </div>
        {sidebarOpen && (
          <button
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
            aria-label="关闭导航"
          />
        )}
      </div>

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}

      {searchOpen && (
        <div
          className="settings-overlay"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setSearchOpen(false);
          }}
        >
          <section
            ref={searchDialogRef}
            className="settings-dialog search-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="search-title"
            aria-describedby="search-help"
            tabIndex={-1}
          >
            <div className="settings-head">
              <div>
                <span>QUESTION SEARCH</span>
                <h2 id="search-title">搜索200道题</h2>
              </div>
              <button
                onClick={() => setSearchOpen(false)}
                aria-label="关闭搜索"
              >
                ×
              </button>
            </div>
            <p id="search-help" className="dialog-help">
              搜索题号、题干、章节、专题、题型和核心考点，不检索答案解析。
            </p>
            <input
              ref={searchInputRef}
              className="search-input"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setSearchCursor(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setSearchCursor(
                    (searchCursor + 1) % Math.max(1, searchResults.length),
                  );
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setSearchCursor(
                    (searchCursor - 1 + Math.max(1, searchResults.length)) %
                      Math.max(1, searchResults.length),
                  );
                } else if (event.key === "Enter" && searchResults[searchCursor])
                  chooseSearchResult(searchResults[searchCursor]);
              }}
              placeholder="例如：8255 控制字、DMA、#849001"
              aria-controls="search-results"
              aria-activedescendant={
                searchResults[searchCursor]
                  ? "search-result-" + searchResults[searchCursor].id
                  : undefined
              }
            />
            <div id="search-results" className="search-results" role="listbox">
              {searchResults.map((question, index) => (
                <button
                  id={"search-result-" + question.id}
                  role="option"
                  aria-selected={index === searchCursor}
                  className={index === searchCursor ? "active" : ""}
                  key={question.id}
                  onMouseEnter={() => setSearchCursor(index)}
                  onClick={() => chooseSearchResult(question)}
                >
                  <span>#{question.id}</span>
                  <div>
                    <strong>{question.prompt}</strong>
                    <small>
                      {question.chapter} · {question.section} · {question.type}
                    </small>
                  </div>
                </button>
              ))}
              {searchQuery && !searchResults.length && (
                <div className="empty-inline">
                  没有匹配题目，尝试减少关键词。
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div
          className="settings-overlay"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setSettingsOpen(false);
          }}
        >
          <section
            ref={settingsDialogRef}
            className="settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            aria-describedby="settings-help"
            tabIndex={-1}
          >
            <div className="settings-head">
              <div>
                <span>ACCOUNT & DISPLAY</span>
                <h2 id="settings-title">账户与显示设置</h2>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                aria-label="关闭设置"
              >
                ×
              </button>
            </div>
            <p id="settings-help" className="dialog-help">
              管理站内身份、考试日期和每日学习目标。
            </p>
            {account ? (
              <>
                <div className="settings-avatar">
                  <span>{account.displayName.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{account.displayName}</strong>
                    <small>{account.email}</small>
                  </div>
                  <em>{syncState === "synced" ? "已同步" : "等待同步"}</em>
                </div>
                <div className="settings-form">
                  <label>
                    站内昵称
                    <input
                      value={settingsNickname}
                      onChange={(event) =>
                        setSettingsNickname(event.target.value)
                      }
                      maxLength={24}
                    />
                  </label>
                  <label>
                    学习ID
                    <input
                      value={settingsStudyId}
                      onChange={(event) =>
                        setSettingsStudyId(event.target.value.toLowerCase())
                      }
                      maxLength={24}
                    />
                    <small>4–24位字母、数字、短横线或下划线。</small>
                  </label>
                  <label>
                    学习签名
                    <textarea
                      value={settingsBio}
                      onChange={(event) => setSettingsBio(event.target.value)}
                      maxLength={80}
                    />
                  </label>
                  <div className="settings-row">
                    <label>
                      预计考试日期
                      <input
                        type="date"
                        value={examDate}
                        onChange={(event) => setExamDate(event.target.value)}
                      />
                    </label>
                    <label>
                      每日目标题量
                      <input
                        type="number"
                        min="5"
                        max="100"
                        value={dailyGoal}
                        onChange={(event) =>
                          setDailyGoal(
                            Math.min(
                              100,
                              Math.max(5, Number(event.target.value)),
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                </div>
                {settingsError && (
                  <p
                    ref={settingsErrorRef}
                    className="settings-error"
                    role="alert"
                    tabIndex={-1}
                  >
                    {settingsError}
                  </p>
                )}
                <div className="settings-actions">
                  <a href="/signout-with-chatgpt?return_to=%2F">退出登录</a>
                  <button
                    className="primary-button"
                    onClick={saveAccountSettings}
                    disabled={settingsSaving}
                  >
                    {settingsSaving ? "保存中…" : "保存账户设置"}
                  </button>
                </div>
              </>
            ) : (
              <div className="settings-guest">
                <span>◎</span>
                <h3>登录后管理账户</h3>
                <p>登录ChatGPT后可同步计划、真实历史和未完成试卷。</p>
                <a
                  className="primary-button"
                  href="/signin-with-chatgpt?return_to=%2F"
                >
                  登录并同步
                </a>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

import type { Question, QuestionType } from "./question-bank";

export type AnalyticsEvent = {
  id: string;
  questionId: number;
  source: "practice" | "review" | "exam" | string;
  correct: boolean;
  answeredAt: string;
  activityDate: string;
  earnedPoints?: number | null;
  possiblePoints?: number | null;
};
export type ProgressLike = {
  questionId: number;
  attempts: number;
  correctAttempts: number;
  status?: string;
  nextReviewAt?: string | null;
};
export type ExamLike = {
  id: string;
  score: number;
  total: number;
  durationSeconds: number;
  completedAt: string;
};

export function analyticsDateRange(days: number, todayKey: string) {
  const [year, month, day] = todayKey.split("-").map(Number);
  const end = new Date(Date.UTC(year, month - 1, day));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - days + 1 + index);
    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0"),
    ].join("-");
  });
}

export function buildAnalytics(input: {
  questions: Question[];
  events: AnalyticsEvent[];
  progress: ProgressLike[];
  exams: ExamLike[];
  days: number;
  todayKey: string;
  source: string;
}) {
  const dates = analyticsDateRange(input.days, input.todayKey);
  const start = dates[0];
  const byId = new Map(
    input.questions.map((question) => [question.id, question]),
  );
  const filtered = input.events.filter(
    (event) =>
      event.activityDate >= start &&
      event.activityDate <= input.todayKey &&
      (input.source === "all" || event.source === input.source),
  );
  const daily = dates.map((date) => {
    const events = filtered.filter((event) => event.activityDate === date);
    const objective = events.filter(
      (event) => byId.get(event.questionId)?.scoring === "auto",
    );
    return {
      date,
      attempts: events.length,
      correct: objective.filter((event) => event.correct).length,
      wrong: objective.filter((event) => !event.correct).length,
    };
  });
  const objectiveEvents = filtered.filter(
    (event) => byId.get(event.questionId)?.scoring === "auto",
  );
  const subjectiveEvents = filtered.filter(
    (event) =>
      byId.get(event.questionId)?.scoring === "rubric" &&
      Number(event.possiblePoints) > 0,
  );
  const progressMap = new Map(
    input.progress.map((item) => [item.questionId, item]),
  );
  const group = <K extends string>(keys: K[]) =>
    keys.map((key) => {
      const bank = input.questions.filter(
        (question) => question.chapter === key || question.type === key,
      );
      const rows = bank
        .map((question) => progressMap.get(question.id))
        .filter((item): item is ProgressLike => Boolean(item));
      const attempts = rows.reduce((sum, item) => sum + item.attempts, 0);
      const correct = rows.reduce((sum, item) => sum + item.correctAttempts, 0);
      return {
        key,
        attempts,
        accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
        coverage: bank.length
          ? Math.round((rows.length / bank.length) * 100)
          : 0,
        sampleEnough: attempts >= 5,
      };
    });
  const activeDates = new Set(
    daily.filter((item) => item.attempts > 0).map((item) => item.date),
  );
  let streak = 0;
  for (let index = dates.length - 1; index >= 0; index -= 1) {
    if (activeDates.has(dates[index])) streak += 1;
    else if (dates[index] !== input.todayKey || streak) break;
  }
  const subjectivePossible = subjectiveEvents.reduce(
    (sum, event) => sum + Number(event.possiblePoints || 0),
    0,
  );
  return {
    daily,
    totalAttempts: filtered.length,
    objectiveAccuracy: objectiveEvents.length
      ? Math.round(
          (objectiveEvents.filter((event) => event.correct).length /
            objectiveEvents.length) *
            100,
        )
      : 0,
    objectiveSamples: objectiveEvents.length,
    subjectiveRate: subjectivePossible
      ? Math.round(
          (subjectiveEvents.reduce(
            (sum, event) => sum + Number(event.earnedPoints || 0),
            0,
          ) /
            subjectivePossible) *
            100,
        )
      : 0,
    subjectiveSamples: subjectiveEvents.length,
    streak,
    chapters: group(
      Array.from(new Set(input.questions.map((question) => question.chapter))),
    ),
    types: group(
      Array.from(
        new Set(input.questions.map((question) => question.type)),
      ) as QuestionType[],
    ),
    exams: [...input.exams]
      .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
      .slice(-10),
  };
}

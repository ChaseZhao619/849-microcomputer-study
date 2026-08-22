export function completePlanQuestion(completedIds: number[], questionId: number, target: number) {
  const ids = Array.from(new Set([...completedIds, questionId]));
  const completedQuestions = Math.min(Math.max(0, target), ids.length);
  return { completedIds: ids, completedQuestions, status: completedQuestions >= target ? "completed" : "pending" };
}

export function remainingAt(deadlineAt: string | null, now: number, fallback: number) {
  if (!deadlineAt) return Math.max(0, fallback);
  return Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - now) / 1000));
}

export function resumeDeadline(remainingSeconds: number, now: number) {
  return new Date(now + Math.max(0, remainingSeconds) * 1000).toISOString();
}

export function rubricScore(rubric: Array<{ id: string; points: number }>, checked: string[]) {
  const selected = new Set(checked);
  return rubric.filter((item) => selected.has(item.id)).reduce((sum, item) => sum + item.points, 0);
}

export function serializeExamDraft<T>(draft: T) {
  return JSON.stringify(draft);
}

export function buildHeatmapDays(activity: Record<string, number>, todayKey: string) {
  const [year, month, dayOfMonth] = todayKey.split("-").map(Number);
  const today = new Date(Date.UTC(year, month - 1, dayOfMonth));
  const weekday = today.getUTCDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - daysSinceMonday - 63);

  return Array.from({ length: 70 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("-");
    const count = activity[key] ?? 0;
    return {
      key,
      count,
      level: count === 0 ? 0 : count < 5 ? 1 : count < 10 ? 2 : count < 20 ? 3 : 4,
      isToday: key === todayKey,
      isFuture: key > todayKey,
    };
  });
}

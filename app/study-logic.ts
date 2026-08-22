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

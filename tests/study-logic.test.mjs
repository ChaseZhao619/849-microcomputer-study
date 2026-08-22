import assert from "node:assert/strict";
import test from "node:test";
import { buildHeatmapDays, completePlanQuestion, remainingAt, resumeDeadline, rubricScore, serializeExamDraft } from "../app/study-logic.ts";

test("学习计划按计划与题目去重并自动完成", () => {
  assert.deepEqual(completePlanQuestion([1], 1, 2), { completedIds: [1], completedQuestions: 1, status: "pending" });
  assert.deepEqual(completePlanQuestion([1], 2, 2), { completedIds: [1, 2], completedQuestions: 2, status: "completed" });
});

test("考试关闭继续计时、暂停冻结、恢复重建截止时间", () => {
  const now = Date.parse("2026-08-22T00:00:00Z");
  assert.equal(remainingAt("2026-08-22T00:01:00Z", now, 999), 60);
  assert.equal(remainingAt("2026-08-21T23:59:00Z", now, 999), 0);
  assert.equal(remainingAt(null, now, 45), 45);
  assert.equal(resumeDeadline(45, now), "2026-08-22T00:00:45.000Z");
});

test("草稿可无损序列化，量规只累计已选评分点", () => {
  const draft = { id: "exam-1", answers: { 1: "A", 2: "程序" }, remainingSeconds: 90 };
  assert.deepEqual(JSON.parse(serializeExamDraft(draft)), draft);
  assert.equal(rubricScore([{ id: "a", points: 4 }, { id: "b", points: 3 }, { id: "c", points: 3 }], ["a", "c"]), 7);
});

test("热力图包含当前自然周并保持十周范围", () => {
  const days = buildHeatmapDays({ "2026-08-22": 6 }, "2026-08-22");
  assert.equal(days.length, 70);
  assert.equal(days[0].key, "2026-06-15");
  assert.equal(days.at(-1).key, "2026-08-23");
  assert.deepEqual(days.find((day) => day.key === "2026-08-22"), { key: "2026-08-22", count: 6, level: 2, isToday: true, isFuture: false });
  assert.equal(days.at(-1).isFuture, true);
});

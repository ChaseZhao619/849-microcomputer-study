import assert from "node:assert/strict";
import test from "node:test";
import questions from "../app/question-bank.json" with { type: "json" };
import { buildAnalytics } from "../app/analytics.ts";
import {
  buildPaperLayout,
  emptyExamAnswer,
  hasExamAnswer,
  selectExamQuestions,
  upgradeExamDraft,
} from "../app/exam-model.ts";

test("组卷遵循题库比例并在范围缺题时安全补足", () => {
  const selected = selectExamQuestions(questions, 40, () => 0.42);
  assert.equal(selected.length, 40);
  assert.deepEqual(
    Object.fromEntries(
      ["选择题", "填空/计算题", "汇编编程题", "综合设计题"].map((type) => [
        type,
        selected.filter((item) => item.type === type).length,
      ]),
    ),
    {
      选择题: 22,
      "填空/计算题": 7,
      汇编编程题: 6,
      综合设计题: 5,
    },
  );
  const narrow = questions.filter(
    (question) => question.chapter === "微型计算机基础",
  );
  assert.equal(selectExamQuestions(narrow, 10, () => 0.4).length, 10);
});

test("纸卷布局与旧字符串答案升级稳定且无损", () => {
  const ids = questions.slice(0, 20).map((question) => question.id);
  const first = buildPaperLayout(ids, questions);
  assert.deepEqual(buildPaperLayout(ids, questions), first);
  assert.ok(first.every((slot) => slot.column === 1 || slot.column === 2));
  const upgraded = upgradeExamDraft(
    {
      id: "legacy",
      questionIds: ids,
      answers: { [ids[0]]: "A" },
      durationSeconds: 1800,
      remainingSeconds: 900,
    },
    questions,
  );
  assert.equal(upgraded.answers[ids[0]].text, "A");
  assert.deepEqual(upgraded.paperLayout, first);
  assert.equal(
    hasExamAnswer({
      ...emptyExamAnswer(),
      handwriting: [
        {
          id: "p",
          background: "blank",
          strokes: [
            { id: "s", tool: "pen", color: "#000", width: 2, points: [] },
          ],
        },
      ],
    }),
    true,
  );
});

test("学习数据分离客观正确率和主观得分率并排除低样本", () => {
  const objective = questions.find((question) => question.scoring === "auto");
  const subjective = questions.find(
    (question) => question.scoring === "rubric",
  );
  const events = [
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `o${index}`,
      questionId: objective.id,
      source: "practice",
      correct: index < 3,
      answeredAt: `2026-08-2${index + 0}T10:00:00+08:00`,
      activityDate: `2026-08-2${index + 0}`,
    })),
    {
      id: "s1",
      questionId: subjective.id,
      source: "exam",
      correct: false,
      answeredAt: "2026-08-24T10:00:00+08:00",
      activityDate: "2026-08-24",
      earnedPoints: 6,
      possiblePoints: 10,
    },
  ];
  const result = buildAnalytics({
    questions,
    events,
    progress: [],
    exams: [],
    days: 7,
    todayKey: "2026-08-24",
    source: "all",
  });
  assert.equal(result.objectiveAccuracy, 60);
  assert.equal(result.objectiveSamples, 5);
  assert.equal(result.subjectiveRate, 60);
  assert.equal(result.subjectiveSamples, 1);
  assert.equal(result.daily.length, 7);
  assert.equal(
    result.chapters.find((item) => item.key === subjective.chapter)
      .sampleEnough,
    false,
  );
});

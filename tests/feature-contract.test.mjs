import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);
const account = await readFile(
  new URL("../app/api/account/route.ts", import.meta.url),
  "utf8",
);
const exams = await readFile(
  new URL("../app/api/exams/route.ts", import.meta.url),
  "utf8",
);
const migration = await readFile(
  new URL("../drizzle/0003_certain_skrulls.sql", import.meta.url),
  "utf8",
);
const upgradeMigration = await readFile(
  new URL("../drizzle/0004_fancy_zemo.sql", import.meta.url),
  "utf8",
);
const assets = await readFile(
  new URL("../app/api/exam-assets/route.ts", import.meta.url),
  "utf8",
);
const ai = await readFile(
  new URL("../app/api/ai-analysis/route.ts", import.meta.url),
  "utf8",
);
const paper = await readFile(
  new URL("../app/components/ExamActiveWorkspace.tsx", import.meta.url),
  "utf8",
);
const subjectiveTools = await readFile(
  new URL("../app/components/SubjectiveAnswerTools.tsx", import.meta.url),
  "utf8",
);

test("搜索与对话框键盘契约存在", () => {
  for (const token of [
    "metaKey",
    "ctrlKey",
    'event.key === "Escape"',
    'event.key !== "Tab"',
    "event.shiftKey",
    "aria-activedescendant",
    "aria-modal",
    "inert={modalOpen",
    "opener?.focus()",
  ])
    assert.ok(page.includes(token), token);
});

test("整卷、私有附件和BYOK安全契约存在", () => {
  for (const token of [
    "paperLayout",
    "viewMode",
    "paper-page",
    "SubjectiveAnswerTools",
    "hasExamAnswer",
  ])
    assert.ok(paper.includes(token), token);
  for (const token of [
    "getAnswerAssets",
    "expiresAt",
    "1_500_000",
    "questionIdsJson",
    "user.id",
  ])
    assert.ok(assets.includes(token), token);
  for (const token of [
    "api.openai.com",
    "dashscope.aliyuncs.com",
    "api.deepseek.com",
    "suggestedRubricIds",
    "aiRequestLocks",
    "store: false",
  ])
    assert.ok(ai.includes(token), token);
  assert.ok(!ai.includes("console.log"));
  for (const table of [
    "exam_answer_assets",
    "ai_analysis_events",
    "ai_request_locks",
    "earned_points",
    "possible_points",
  ])
    assert.ok(upgradeMigration.includes(table), table);
});

test("AI配置集中到个人设置并由所有题目共享", () => {
  for (const token of [
    "AI辅助设置",
    "savePersonalAiSettings",
    "unlockPersonalAiSettings",
    "所有题目共用同一配置",
    "aiConfig={aiConfig}",
  ])
    assert.ok(page.includes(token), token);
  for (const token of ["前往个人设置", "onOpenAiSettings", "aiConfig"])
    assert.ok(subjectiveTools.includes(token), token);
  for (const token of ["saveAiVault", "unlockAiVault", "API Token"])
    assert.ok(!subjectiveTools.includes(token), token);
});

test("进度、活动和考试接口具备幂等与生命周期动作", () => {
  for (const token of [
    "eventId",
    "studyPlanCompletions",
    "onConflictDoNothing",
    "activityDate",
  ])
    assert.ok(account.includes(token), token);
  assert.ok(migration.includes("legacy-backfill"));
  for (const action of [
    "create",
    "save",
    "pause",
    "resume",
    "submit",
    "selfScore",
  ])
    assert.ok(exams.includes(`\"${action}\"`), action);
});

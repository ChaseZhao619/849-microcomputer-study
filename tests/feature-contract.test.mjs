import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const account = await readFile(new URL("../app/api/account/route.ts", import.meta.url), "utf8");
const exams = await readFile(new URL("../app/api/exams/route.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../drizzle/0003_certain_skrulls.sql", import.meta.url), "utf8");

test("搜索与对话框键盘契约存在", () => {
  for (const token of ["metaKey", "ctrlKey", 'event.key === "Escape"', 'event.key !== "Tab"', "event.shiftKey", "aria-activedescendant", "aria-modal", "inert={modalOpen", "opener?.focus()"] ) assert.ok(page.includes(token), token);
});

test("进度、活动和考试接口具备幂等与生命周期动作", () => {
  for (const token of ["eventId", "studyPlanCompletions", "onConflictDoNothing", "activityDate"]) assert.ok(account.includes(token), token);
  assert.ok(migration.includes("legacy-backfill"));
  for (const action of ["create", "save", "pause", "resume", "submit", "selfScore"]) assert.ok(exams.includes(`\"${action}\"`), action);
});

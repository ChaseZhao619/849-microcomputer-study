import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../drizzle/0005_free_wind_dancer.sql", import.meta.url),
  "utf8",
);
const auth = await readFile(
  new URL("../app/internal-admin-auth.ts", import.meta.url),
  "utf8",
);
const detail = await readFile(
  new URL(
    "../app/api/internal-admin/users/[userId]/route.ts",
    import.meta.url,
  ),
  "utf8",
);

test("管理数据库、汇总回填与全局索引存在", () => {
  for (const token of [
    "admin_user_controls",
    "admin_audit_events",
    "admin_request_nonces",
    "user_admin_rollups",
    "INSERT INTO `user_admin_rollups`",
    "idx_answer_events_date_source",
    "idx_user_admin_rollups_last_activity",
  ])
    assert.ok(migration.includes(token), token);
});

test("管理桥接请求签名包含防篡改与防重放字段", () => {
  for (const token of [
    "x-849-admin-timestamp",
    "x-849-admin-nonce",
    "x-849-admin-signature",
    "x-849-admin-actor",
    'request.method.toUpperCase()',
    "await sha256(bodyText)",
    "INSERT OR IGNORE INTO admin_request_nonces",
    "constantTimeEqual",
  ])
    assert.ok(auth.includes(token), token);
});

test("用户详情响应不读取私密答题内容", () => {
  for (const forbidden of [
    "answers_json",
    "question_ids_json",
    "object_key",
    "filename",
    "transcript",
    "result_json",
  ])
    assert.ok(!detail.includes(forbidden), forbidden);
  for (const allowed of [
    "user_admin_rollups",
    "question_progress",
    "exam_attempts",
    "attachments",
    "aiUsage",
  ])
    assert.ok(detail.includes(allowed), allowed);
});

import { getD1 } from "../../../../../../db";
import {
  adminError,
  adminNoStore,
  verifyInternalAdminRequest,
} from "../../../../../internal-admin-auth";

export const dynamic = "force-dynamic";

function tags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).map((item) => item.trim()).filter(Boolean))]
    .slice(0, 10)
    .map((item) => item.slice(0, 20));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const verified = await verifyInternalAdminRequest(request);
    const body = JSON.parse(verified.bodyText || "{}") as Record<string, unknown>;
    const { userId } = await context.params;
    const id = decodeURIComponent(userId).slice(0, 160);
    const action = String(body.action || "");
    const requestId = String(body.requestId || "");
    const reason = String(body.reason || "").trim().slice(0, 300);
    if (!/^[a-f0-9-]{16,80}$/i.test(requestId))
      return adminNoStore({ error: "管理请求编号无效" }, { status: 400 });
    if (!["note", "suspend", "resume"].includes(action))
      return adminNoStore({ error: "不支持的管理操作" }, { status: 400 });
    if (["suspend", "resume"].includes(action) && reason.length < 4)
      return adminNoStore({ error: "停用或恢复必须填写至少4个字符的原因" }, { status: 400 });
    const db = getD1();
    const profile = await db
      .prepare("SELECT user_id FROM user_profiles WHERE user_id = ?")
      .bind(id)
      .first();
    if (!profile) return adminNoStore({ error: "用户不存在" }, { status: 404 });
    const duplicate = await db
      .prepare("SELECT id FROM admin_audit_events WHERE id = ?")
      .bind(requestId)
      .first();
    if (duplicate) return adminNoStore({ ok: true, duplicate: true });
    const current = await db
      .prepare(
        "SELECT status, note, tags_json, suspension_reason FROM admin_user_controls WHERE user_id = ?",
      )
      .bind(id)
      .first<Record<string, unknown>>();
    const beforeStatus = String(current?.status || "active");
    const nextStatus = action === "suspend" ? "suspended" : action === "resume" ? "active" : beforeStatus;
    const nextNote = action === "note" ? String(body.note || "").trim().slice(0, 1000) : String(current?.note || "");
    const nextTags = action === "note" ? tags(body.tags) : JSON.parse(String(current?.tags_json || "[]"));
    const nextReason = action === "suspend" ? reason : action === "resume" ? null : current?.suspension_reason ?? null;
    const now = new Date().toISOString();
    const metadata = JSON.stringify({
      statusBefore: beforeStatus,
      statusAfter: nextStatus,
      noteChanged: action === "note" && nextNote !== String(current?.note || ""),
      tagCount: nextTags.length,
    });
    await db.batch([
      db
        .prepare(
          `INSERT INTO admin_user_controls
            (user_id, status, note, tags_json, suspension_reason, updated_by, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET status = excluded.status,
             note = excluded.note, tags_json = excluded.tags_json,
             suspension_reason = excluded.suspension_reason,
             updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
        )
        .bind(id, nextStatus, nextNote, JSON.stringify(nextTags), nextReason, verified.actorEmail, now),
      db
        .prepare(
          `INSERT INTO admin_audit_events
            (id, actor_email, action, target_user_id, reason, metadata_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          requestId,
          verified.actorEmail,
          action,
          id,
          action === "note" ? reason || "更新管理员备注与标签" : reason,
          metadata,
          now,
        ),
    ]);
    return adminNoStore({
      ok: true,
      control: {
        status: nextStatus,
        note: nextNote,
        tags: nextTags,
        suspensionReason: nextReason,
        updatedBy: verified.actorEmail,
        updatedAt: now,
      },
    });
  } catch (error) {
    return adminError(error);
  }
}

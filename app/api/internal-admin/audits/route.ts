import { getD1 } from "../../../../db";
import {
  adminError,
  adminNoStore,
  verifyInternalAdminRequest,
} from "../../../internal-admin-auth";

export const dynamic = "force-dynamic";

function cursorOffset(cursor: string | null) {
  if (!cursor) return 0;
  try {
    const value = Number(atob(cursor));
    return Number.isInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export async function GET(request: Request) {
  try {
    await verifyInternalAdminRequest(request);
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
    const offset = cursorOffset(url.searchParams.get("cursor"));
    const action = ["note", "suspend", "resume"].includes(String(url.searchParams.get("action")))
      ? String(url.searchParams.get("action"))
      : "";
    const target = String(url.searchParams.get("target") || "").trim().slice(0, 100);
    const from = String(url.searchParams.get("from") || "").slice(0, 10);
    const to = String(url.searchParams.get("to") || "").slice(0, 10);
    const where: string[] = [];
    const bindings: string[] = [];
    if (action) {
      where.push("a.action = ?");
      bindings.push(action);
    }
    if (target) {
      where.push("(a.target_user_id = ? OR p.email LIKE ? OR COALESCE(p.nickname, '') LIKE ? OR COALESCE(p.study_id, '') LIKE ?)");
      bindings.push(target, `%${target}%`, `%${target}%`, `%${target}%`);
    }
    if (from) {
      where.push("substr(a.created_at, 1, 10) >= ?");
      bindings.push(from);
    }
    if (to) {
      where.push("substr(a.created_at, 1, 10) <= ?");
      bindings.push(to);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = await getD1()
      .prepare(
        `SELECT a.id, a.actor_email, a.action, a.target_user_id, a.reason,
          a.metadata_json, a.created_at, p.email AS target_email,
          p.nickname AS target_nickname, p.study_id AS target_study_id
         FROM admin_audit_events a
         LEFT JOIN user_profiles p ON p.user_id = a.target_user_id
         ${whereSql} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(...bindings, limit + 1, offset)
      .all<Record<string, unknown>>();
    const hasMore = rows.results.length > limit;
    return adminNoStore({
      audits: rows.results.slice(0, limit).map((row) => ({
        ...row,
        metadata: JSON.parse(String(row.metadata_json || "{}")),
        metadata_json: undefined,
      })),
      nextCursor: hasMore ? btoa(String(offset + limit)) : null,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return adminError(error);
  }
}

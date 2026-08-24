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

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export async function GET(request: Request) {
  try {
    await verifyInternalAdminRequest(request);
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
    const offset = cursorOffset(url.searchParams.get("cursor"));
    const search = String(url.searchParams.get("search") || "").trim().slice(0, 80);
    const status = ["active", "suspended"].includes(String(url.searchParams.get("status")))
      ? String(url.searchParams.get("status"))
      : "";
    const activeWithin = [1, 7, 30, 70].includes(Number(url.searchParams.get("activeWithin")))
      ? Number(url.searchParams.get("activeWithin"))
      : 0;
    const sort = ["activity", "registered", "email"].includes(String(url.searchParams.get("sort")))
      ? String(url.searchParams.get("sort"))
      : "activity";
    const where: string[] = [];
    const bindings: Array<string | number> = [];
    if (search) {
      const term = `%${escapeLike(search)}%`;
      where.push("(p.email LIKE ? ESCAPE '\\' OR COALESCE(p.nickname, '') LIKE ? ESCAPE '\\' OR COALESCE(p.study_id, '') LIKE ? ESCAPE '\\')");
      bindings.push(term, term, term);
    }
    if (status) {
      where.push("COALESCE(c.status, 'active') = ?");
      bindings.push(status);
    }
    if (activeWithin) {
      const start = new Date(Date.now() - (activeWithin - 1) * 86400000)
        .toISOString()
        .slice(0, 10);
      where.push("r.last_activity_date >= ?");
      bindings.push(start);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const orderSql =
      sort === "registered"
        ? "p.created_at DESC, p.user_id"
        : sort === "email"
          ? "p.email COLLATE NOCASE ASC, p.user_id"
          : "COALESCE(r.last_activity_at, '') DESC, p.user_id";
    const db = getD1();
    const [rows, count] = await Promise.all([
      db
        .prepare(
          `SELECT p.user_id, p.email, p.display_name, p.nickname, p.study_id,
            p.bio, p.exam_date, p.daily_goal, p.created_at, p.updated_at,
            COALESCE(c.status, 'active') AS status, c.tags_json,
            r.last_activity_at, r.last_activity_date, COALESCE(r.answer_count, 0) AS answer_count,
            COALESCE(r.objective_attempts, 0) AS objective_attempts,
            COALESCE(r.objective_correct, 0) AS objective_correct,
            COALESCE(r.subjective_earned, 0) AS subjective_earned,
            COALESCE(r.subjective_possible, 0) AS subjective_possible,
            COALESCE(r.exam_count, 0) AS exam_count
           FROM user_profiles p
           LEFT JOIN admin_user_controls c ON c.user_id = p.user_id
           LEFT JOIN user_admin_rollups r ON r.user_id = p.user_id
           ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`,
        )
        .bind(...bindings, limit + 1, offset)
        .all<Record<string, unknown>>(),
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM user_profiles p
           LEFT JOIN admin_user_controls c ON c.user_id = p.user_id
           LEFT JOIN user_admin_rollups r ON r.user_id = p.user_id ${whereSql}`,
        )
        .bind(...bindings)
        .first<{ count: number }>(),
    ]);
    const hasMore = rows.results.length > limit;
    return adminNoStore({
      users: rows.results.slice(0, limit).map((row) => ({
        ...row,
        tags: JSON.parse(String(row.tags_json || "[]")),
        tags_json: undefined,
      })),
      total: Number(count?.count || 0),
      nextCursor: hasMore ? btoa(String(offset + limit)) : null,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return adminError(error);
  }
}

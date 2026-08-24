import { getD1 } from "../../../../../db";
import { questions } from "../../../../question-bank";
import {
  adminError,
  adminNoStore,
  verifyInternalAdminRequest,
} from "../../../../internal-admin-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    await verifyInternalAdminRequest(request);
    const { userId } = await context.params;
    const id = decodeURIComponent(userId).slice(0, 160);
    const start = new Date(Date.now() - 69 * 86400000).toISOString().slice(0, 10);
    const db = getD1();
    const [profile, control, rollup, activity, progress, plans, exams, assets, aiUsage, audits] =
      await Promise.all([
        db
          .prepare(
            `SELECT user_id, email, display_name, nickname, study_id, bio,
              exam_date, daily_goal, created_at, updated_at
             FROM user_profiles WHERE user_id = ?`,
          )
          .bind(id)
          .first<Record<string, unknown>>(),
        db
          .prepare(
            `SELECT status, note, tags_json, suspension_reason, updated_by, updated_at
             FROM admin_user_controls WHERE user_id = ?`,
          )
          .bind(id)
          .first<Record<string, unknown>>(),
        db
          .prepare("SELECT * FROM user_admin_rollups WHERE user_id = ?")
          .bind(id)
          .first<Record<string, unknown>>(),
        db
          .prepare(
            `SELECT activity_date, question_id, source, COUNT(*) AS attempts,
              SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) AS correct,
              SUM(COALESCE(earned_points, 0)) AS earned,
              SUM(COALESCE(possible_points, 0)) AS possible
             FROM answer_events WHERE user_id = ? AND activity_date >= ?
             GROUP BY activity_date, question_id, source
             ORDER BY activity_date`,
          )
          .bind(id, start)
          .all<Record<string, unknown>>(),
        db
          .prepare(
            `SELECT question_id, status, attempts, correct_attempts, review_stage,
              next_review_at, last_answered_at
             FROM question_progress WHERE user_id = ? ORDER BY question_id`,
          )
          .bind(id)
          .all<Record<string, unknown>>(),
        db
          .prepare(
            `SELECT id, plan_date, chapter, target_questions, completed_questions,
              status, created_at FROM study_plans WHERE user_id = ?
             ORDER BY plan_date DESC LIMIT 50`,
          )
          .bind(id)
          .all<Record<string, unknown>>(),
        db
          .prepare(
            `SELECT id, scope, score, total, duration_seconds, completed_at
             FROM exam_attempts WHERE user_id = ? ORDER BY completed_at DESC LIMIT 30`,
          )
          .bind(id)
          .all<Record<string, unknown>>(),
        db
          .prepare(
            `SELECT kind, COUNT(*) AS count, SUM(size_bytes) AS bytes,
              MIN(created_at) AS first_created_at, MAX(created_at) AS last_created_at
             FROM exam_answer_assets WHERE user_id = ? GROUP BY kind`,
          )
          .bind(id)
          .all<Record<string, unknown>>(),
        db
          .prepare(
            `SELECT provider, model, phase, COUNT(*) AS count,
              MAX(created_at) AS last_used_at
             FROM ai_analysis_events WHERE user_id = ?
             GROUP BY provider, model, phase ORDER BY count DESC`,
          )
          .bind(id)
          .all<Record<string, unknown>>(),
        db
          .prepare(
            `SELECT id, actor_email, action, reason, metadata_json, created_at
             FROM admin_audit_events WHERE target_user_id = ?
             ORDER BY created_at DESC LIMIT 20`,
          )
          .bind(id)
          .all<Record<string, unknown>>(),
      ]);
    if (!profile) return adminNoStore({ error: "用户不存在" }, { status: 404 });
    const byId = new Map(questions.map((question) => [question.id, question]));
    const enrich = (row: Record<string, unknown>) => {
      const question = byId.get(Number(row.question_id));
      return {
        ...row,
        chapter: question?.chapter ?? "未知章节",
        type: question?.type ?? "未知题型",
        scoring: question?.scoring ?? "auto",
      };
    };
    return adminNoStore({
      profile,
      control: {
        status: String(control?.status || "active"),
        note: String(control?.note || ""),
        tags: JSON.parse(String(control?.tags_json || "[]")),
        suspensionReason: control?.suspension_reason ?? null,
        updatedBy: control?.updated_by ?? null,
        updatedAt: control?.updated_at ?? null,
      },
      rollup: rollup ?? {},
      activity: activity.results.map(enrich),
      progress: progress.results.map(enrich),
      plans: plans.results,
      exams: exams.results,
      attachments: assets.results,
      aiUsage: aiUsage.results,
      audits: audits.results.map((row) => ({
        ...row,
        metadata: JSON.parse(String(row.metadata_json || "{}")),
        metadata_json: undefined,
      })),
      range: { days: 70, start, timeZone: "Asia/Shanghai" },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return adminError(error);
  }
}

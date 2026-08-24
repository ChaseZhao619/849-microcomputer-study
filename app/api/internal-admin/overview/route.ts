import { getD1 } from "../../../../db";
import { questions } from "../../../question-bank";
import {
  adminError,
  adminNoStore,
  verifyInternalAdminRequest,
} from "../../../internal-admin-auth";

export const dynamic = "force-dynamic";

function shanghaiDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function startDate(days: number) {
  return shanghaiDate(new Date(Date.now() - (days - 1) * 86400000));
}

export async function GET(request: Request) {
  try {
    await verifyInternalAdminRequest(request);
    const url = new URL(request.url);
    const days = [7, 30, 70].includes(Number(url.searchParams.get("days")))
      ? Number(url.searchParams.get("days"))
      : 30;
    const start = startDate(days);
    const today = shanghaiDate();
    const sevenDays = startDate(7);
    const thirtyDays = startDate(30);
    const db = getD1();
    const [users, active, daily, byQuestion, exams, plans, due, aiUsage] =
      await Promise.all([
        db
          .prepare(
            `SELECT COUNT(*) AS total,
              SUM(CASE WHEN substr(created_at, 1, 10) >= ? THEN 1 ELSE 0 END) AS new_in_range
             FROM user_profiles`,
          )
          .bind(start)
          .first<Record<string, number>>(),
        db
          .prepare(
            `SELECT
              SUM(CASE WHEN last_activity_date >= ? THEN 1 ELSE 0 END) AS today,
              SUM(CASE WHEN last_activity_date >= ? THEN 1 ELSE 0 END) AS seven,
              SUM(CASE WHEN last_activity_date >= ? THEN 1 ELSE 0 END) AS thirty
             FROM user_admin_rollups`,
          )
          .bind(today, sevenDays, thirtyDays)
          .first<Record<string, number>>(),
        db
          .prepare(
            `SELECT activity_date AS date, source, COUNT(*) AS attempts,
              SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) AS correct,
              SUM(COALESCE(earned_points, 0)) AS earned,
              SUM(COALESCE(possible_points, 0)) AS possible
             FROM answer_events WHERE activity_date >= ?
             GROUP BY activity_date, source ORDER BY activity_date`,
          )
          .bind(start)
          .all<Record<string, string | number>>(),
        db
          .prepare(
            `SELECT question_id, source, COUNT(*) AS attempts,
              SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) AS correct,
              SUM(COALESCE(earned_points, 0)) AS earned,
              SUM(COALESCE(possible_points, 0)) AS possible
             FROM answer_events WHERE activity_date >= ?
             GROUP BY question_id, source`,
          )
          .bind(start)
          .all<Record<string, string | number>>(),
        db
          .prepare(
            `SELECT COUNT(*) AS count,
              SUM(score) AS score, SUM(total) AS total,
              AVG(duration_seconds) AS average_duration
             FROM exam_attempts WHERE substr(completed_at, 1, 10) >= ?`,
          )
          .bind(start)
          .first<Record<string, number>>(),
        db
          .prepare(
            `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
             FROM study_plans WHERE plan_date >= ?`,
          )
          .bind(start)
          .first<Record<string, number>>(),
        db
          .prepare(
            `SELECT COUNT(*) AS count FROM question_progress
             WHERE next_review_at IS NOT NULL AND next_review_at <= ?`,
          )
          .bind(new Date().toISOString())
          .first<Record<string, number>>(),
        db
          .prepare(
            `SELECT provider, model, COUNT(*) AS count
             FROM ai_analysis_events WHERE substr(created_at, 1, 10) >= ?
             GROUP BY provider, model ORDER BY count DESC`,
          )
          .bind(start)
          .all<Record<string, string | number>>(),
      ]);

    const questionById = new Map(questions.map((item) => [item.id, item]));
    const chapterMap = new Map<
      string,
      { attempts: number; correct: number; earned: number; possible: number }
    >();
    const typeMap = new Map<
      string,
      { attempts: number; correct: number; earned: number; possible: number }
    >();
    const sources = new Map<string, number>();
    let objectiveAttempts = 0;
    let objectiveCorrect = 0;
    let subjectiveEarned = 0;
    let subjectivePossible = 0;
    for (const row of byQuestion.results) {
      const question = questionById.get(Number(row.question_id));
      if (!question) continue;
      const attempts = Number(row.attempts || 0);
      const correct = Number(row.correct || 0);
      const earned = Number(row.earned || 0);
      const possible = Number(row.possible || 0);
      const chapter = chapterMap.get(question.chapter) ?? {
        attempts: 0,
        correct: 0,
        earned: 0,
        possible: 0,
      };
      chapter.attempts += attempts;
      chapter.correct += correct;
      chapter.earned += earned;
      chapter.possible += possible;
      chapterMap.set(question.chapter, chapter);
      const type = typeMap.get(question.type) ?? {
        attempts: 0,
        correct: 0,
        earned: 0,
        possible: 0,
      };
      type.attempts += attempts;
      type.correct += correct;
      type.earned += earned;
      type.possible += possible;
      typeMap.set(question.type, type);
      if (question.scoring === "auto") {
        objectiveAttempts += attempts;
        objectiveCorrect += correct;
      } else {
        subjectiveEarned += earned;
        subjectivePossible += possible;
      }
      const source = String(row.source || "practice");
      sources.set(source, (sources.get(source) ?? 0) + attempts);
    }

    return adminNoStore({
      range: { days, start, end: today, timeZone: "Asia/Shanghai" },
      generatedAt: new Date().toISOString(),
      users: {
        total: Number(users?.total || 0),
        newInRange: Number(users?.new_in_range || 0),
        activeToday: Number(active?.today || 0),
        active7Days: Number(active?.seven || 0),
        active30Days: Number(active?.thirty || 0),
      },
      learning: {
        attempts: [...sources.values()].reduce((sum, value) => sum + value, 0),
        objectiveAttempts,
        objectiveCorrect,
        subjectiveEarned,
        subjectivePossible,
        dueReviews: Number(due?.count || 0),
        sources: Object.fromEntries(sources),
      },
      exams: {
        count: Number(exams?.count || 0),
        score: Number(exams?.score || 0),
        total: Number(exams?.total || 0),
        averageDuration: Math.round(Number(exams?.average_duration || 0)),
      },
      plans: {
        total: Number(plans?.total || 0),
        completed: Number(plans?.completed || 0),
      },
      daily: daily.results,
      chapters: [...chapterMap].map(([name, value]) => ({ name, ...value })),
      types: [...typeMap].map(([name, value]) => ({ name, ...value })),
      aiUsage: aiUsage.results,
    });
  } catch (error) {
    return adminError(error);
  }
}

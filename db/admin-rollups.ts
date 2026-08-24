import { getD1 } from ".";

export async function recordAnswerRollup(input: {
  userId: string;
  answeredAt: string;
  activityDate: string;
  objective: boolean;
  correct: boolean;
  earnedPoints: number | null;
  possiblePoints: number | null;
}) {
  const now = new Date().toISOString();
  await getD1()
    .prepare(
      `INSERT INTO user_admin_rollups (
        user_id, last_activity_at, last_activity_date, answer_count,
        objective_attempts, objective_correct, subjective_earned,
        subjective_possible, exam_count, updated_at
      ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, 0, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        last_activity_at = CASE
          WHEN excluded.last_activity_at > COALESCE(user_admin_rollups.last_activity_at, '')
          THEN excluded.last_activity_at ELSE user_admin_rollups.last_activity_at END,
        last_activity_date = CASE
          WHEN excluded.last_activity_date > COALESCE(user_admin_rollups.last_activity_date, '')
          THEN excluded.last_activity_date ELSE user_admin_rollups.last_activity_date END,
        answer_count = user_admin_rollups.answer_count + 1,
        objective_attempts = user_admin_rollups.objective_attempts + excluded.objective_attempts,
        objective_correct = user_admin_rollups.objective_correct + excluded.objective_correct,
        subjective_earned = user_admin_rollups.subjective_earned + excluded.subjective_earned,
        subjective_possible = user_admin_rollups.subjective_possible + excluded.subjective_possible,
        updated_at = excluded.updated_at`,
    )
    .bind(
      input.userId,
      input.answeredAt,
      input.activityDate,
      input.objective ? 1 : 0,
      input.objective && input.correct ? 1 : 0,
      input.objective ? 0 : Math.max(0, input.earnedPoints ?? 0),
      input.objective ? 0 : Math.max(0, input.possiblePoints ?? 0),
      now,
    )
    .run();
}

export async function recordExamRollup(input: {
  userId: string;
  completedAt: string;
}) {
  await getD1()
    .prepare(
      `INSERT INTO user_admin_rollups (
        user_id, last_activity_at, last_activity_date, answer_count,
        objective_attempts, objective_correct, subjective_earned,
        subjective_possible, exam_count, last_exam_at, updated_at
      ) VALUES (?, ?, ?, 0, 0, 0, 0, 0, 1, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        last_activity_at = CASE
          WHEN excluded.last_activity_at > COALESCE(user_admin_rollups.last_activity_at, '')
          THEN excluded.last_activity_at ELSE user_admin_rollups.last_activity_at END,
        last_activity_date = CASE
          WHEN excluded.last_activity_date > COALESCE(user_admin_rollups.last_activity_date, '')
          THEN excluded.last_activity_date ELSE user_admin_rollups.last_activity_date END,
        exam_count = user_admin_rollups.exam_count + 1,
        last_exam_at = CASE
          WHEN excluded.last_exam_at > COALESCE(user_admin_rollups.last_exam_at, '')
          THEN excluded.last_exam_at ELSE user_admin_rollups.last_exam_at END,
        updated_at = excluded.updated_at`,
    )
    .bind(
      input.userId,
      input.completedAt,
      input.completedAt.slice(0, 10),
      input.completedAt,
      input.completedAt,
    )
    .run();
}

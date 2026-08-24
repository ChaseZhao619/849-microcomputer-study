import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const userProfiles = sqliteTable(
  "user_profiles",
  {
    userId: text("user_id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    nickname: text("nickname"),
    studyId: text("study_id"),
    bio: text("bio").notNull().default(""),
    examDate: text("exam_date").notNull().default("2026-12-19"),
    dailyGoal: integer("daily_goal").notNull().default(20),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("idx_user_profiles_study_id").on(table.studyId)],
);

export const questionProgress = sqliteTable(
  "question_progress",
  {
    userId: text("user_id").notNull(),
    questionId: integer("question_id").notNull(),
    status: text("status").notNull(),
    attempts: integer("attempts").notNull().default(0),
    correctAttempts: integer("correct_attempts").notNull().default(0),
    reviewStage: integer("review_stage").notNull().default(0),
    nextReviewAt: text("next_review_at"),
    lastAnsweredAt: text("last_answered_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [primaryKey({ columns: [table.userId, table.questionId] })],
);

export const studyPlans = sqliteTable(
  "study_plans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    planDate: text("plan_date").notNull(),
    chapter: text("chapter").notNull(),
    targetQuestions: integer("target_questions").notNull(),
    completedQuestions: integer("completed_questions").notNull().default(0),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_study_plans_user_date_chapter").on(
      table.userId,
      table.planDate,
      table.chapter,
    ),
  ],
);

export const examAttempts = sqliteTable(
  "exam_attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    scope: text("scope").notNull(),
    questionIdsJson: text("question_ids_json").notNull(),
    answersJson: text("answers_json").notNull(),
    score: integer("score").notNull(),
    total: integer("total").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    completedAt: text("completed_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_exam_attempts_user_completed").on(
      table.userId,
      table.completedAt,
    ),
  ],
);

export const answerEvents = sqliteTable(
  "answer_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    questionId: integer("question_id").notNull(),
    source: text("source").notNull(),
    correct: integer("correct", { mode: "boolean" }).notNull(),
    answeredAt: text("answered_at").notNull(),
    activityDate: text("activity_date").notNull(),
    earnedPoints: integer("earned_points"),
    possiblePoints: integer("possible_points"),
  },
  (table) => [
    index("idx_answer_events_user_date").on(table.userId, table.activityDate),
  ],
);

export const studyPlanCompletions = sqliteTable(
  "study_plan_completions",
  {
    planId: integer("plan_id").notNull(),
    userId: text("user_id").notNull(),
    questionId: integer("question_id").notNull(),
    completedAt: text("completed_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.planId, table.questionId] }),
    index("idx_plan_completions_user_plan").on(table.userId, table.planId),
  ],
);

export const examSessions = sqliteTable(
  "exam_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    scope: text("scope").notNull(),
    questionIdsJson: text("question_ids_json").notNull(),
    answersJson: text("answers_json").notNull().default("{}"),
    selfScoresJson: text("self_scores_json").notNull().default("{}"),
    currentIndex: integer("current_index").notNull().default(0),
    durationSeconds: integer("duration_seconds").notNull(),
    remainingSeconds: integer("remaining_seconds").notNull(),
    deadlineAt: text("deadline_at"),
    status: text("status").notNull().default("active"),
    score: integer("score").notNull().default(0),
    total: integer("total").notNull().default(0),
    startedAt: text("started_at").notNull(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("idx_exam_sessions_user_status_updated").on(
      table.userId,
      table.status,
      table.updatedAt,
    ),
  ],
);

export const examAnswerAssets = sqliteTable(
  "exam_answer_assets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    examId: text("exam_id").notNull(),
    questionId: integer("question_id").notNull(),
    kind: text("kind").notNull(),
    objectKey: text("object_key").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [
    index("idx_exam_answer_assets_owner_exam_question").on(
      table.userId,
      table.examId,
      table.questionId,
    ),
    index("idx_exam_answer_assets_expiry").on(table.expiresAt),
  ],
);

export const aiAnalysisEvents = sqliteTable(
  "ai_analysis_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    examId: text("exam_id").notNull(),
    questionId: integer("question_id").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    phase: text("phase").notNull(),
    transcript: text("transcript").notNull().default(""),
    resultJson: text("result_json").notNull().default("{}"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [
    index("idx_ai_analysis_events_user_created").on(
      table.userId,
      table.createdAt,
    ),
    index("idx_ai_analysis_events_exam_question").on(
      table.examId,
      table.questionId,
    ),
  ],
);

export const aiRequestLocks = sqliteTable("ai_request_locks", {
  userId: text("user_id").primaryKey(),
  requestId: text("request_id").notNull(),
  createdAt: text("created_at").notNull(),
});

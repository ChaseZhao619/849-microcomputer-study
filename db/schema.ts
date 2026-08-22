import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const userProfiles = sqliteTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  nickname: text("nickname"),
  studyId: text("study_id"),
  bio: text("bio").notNull().default(""),
  examDate: text("exam_date").notNull().default("2026-12-19"),
  dailyGoal: integer("daily_goal").notNull().default(20),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_user_profiles_study_id").on(table.studyId),
]);

export const questionProgress = sqliteTable("question_progress", {
  userId: text("user_id").notNull(),
  questionId: integer("question_id").notNull(),
  status: text("status").notNull(),
  attempts: integer("attempts").notNull().default(0),
  correctAttempts: integer("correct_attempts").notNull().default(0),
  reviewStage: integer("review_stage").notNull().default(0),
  nextReviewAt: text("next_review_at"),
  lastAnsweredAt: text("last_answered_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.userId, table.questionId] }),
]);

export const studyPlans = sqliteTable("study_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  planDate: text("plan_date").notNull(),
  chapter: text("chapter").notNull(),
  targetQuestions: integer("target_questions").notNull(),
  completedQuestions: integer("completed_questions").notNull().default(0),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_study_plans_user_date_chapter").on(table.userId, table.planDate, table.chapter),
]);

export const examAttempts = sqliteTable("exam_attempts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  scope: text("scope").notNull(),
  questionIdsJson: text("question_ids_json").notNull(),
  answersJson: text("answers_json").notNull(),
  score: integer("score").notNull(),
  total: integer("total").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  completedAt: text("completed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_exam_attempts_user_completed").on(table.userId, table.completedAt),
]);

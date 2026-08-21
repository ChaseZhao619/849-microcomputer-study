CREATE TABLE `exam_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scope` text NOT NULL,
	`question_ids_json` text NOT NULL,
	`answers_json` text NOT NULL,
	`score` integer NOT NULL,
	`total` integer NOT NULL,
	`duration_seconds` integer NOT NULL,
	`completed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `question_progress` (
	`user_id` text NOT NULL,
	`question_id` integer NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`correct_attempts` integer DEFAULT 0 NOT NULL,
	`review_stage` integer DEFAULT 0 NOT NULL,
	`next_review_at` text,
	`last_answered_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `question_id`)
);
--> statement-breakpoint
CREATE TABLE `study_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`plan_date` text NOT NULL,
	`chapter` text NOT NULL,
	`target_questions` integer NOT NULL,
	`completed_questions` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_study_plans_user_date_chapter` ON `study_plans` (`user_id`,`plan_date`,`chapter`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`exam_date` text DEFAULT '2026-12-19' NOT NULL,
	`daily_goal` integer DEFAULT 20 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

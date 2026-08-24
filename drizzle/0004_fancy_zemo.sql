CREATE TABLE `ai_analysis_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`exam_id` text NOT NULL,
	`question_id` integer NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`phase` text NOT NULL,
	`transcript` text DEFAULT '' NOT NULL,
	`result_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ai_analysis_events_user_created` ON `ai_analysis_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ai_analysis_events_exam_question` ON `ai_analysis_events` (`exam_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `ai_request_locks` (
	`user_id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exam_answer_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`exam_id` text NOT NULL,
	`question_id` integer NOT NULL,
	`kind` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_exam_answer_assets_owner_exam_question` ON `exam_answer_assets` (`user_id`,`exam_id`,`question_id`);--> statement-breakpoint
CREATE INDEX `idx_exam_answer_assets_expiry` ON `exam_answer_assets` (`expires_at`);--> statement-breakpoint
ALTER TABLE `answer_events` ADD `earned_points` integer;--> statement-breakpoint
ALTER TABLE `answer_events` ADD `possible_points` integer;
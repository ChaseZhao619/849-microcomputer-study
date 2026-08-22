CREATE TABLE `answer_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`question_id` integer NOT NULL,
	`source` text NOT NULL,
	`correct` integer NOT NULL,
	`answered_at` text NOT NULL,
	`activity_date` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_answer_events_user_date` ON `answer_events` (`user_id`,`activity_date`);--> statement-breakpoint
CREATE TABLE `exam_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scope` text NOT NULL,
	`question_ids_json` text NOT NULL,
	`answers_json` text DEFAULT '{}' NOT NULL,
	`self_scores_json` text DEFAULT '{}' NOT NULL,
	`current_index` integer DEFAULT 0 NOT NULL,
	`duration_seconds` integer NOT NULL,
	`remaining_seconds` integer NOT NULL,
	`deadline_at` text,
	`status` text DEFAULT 'active' NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`started_at` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_exam_sessions_user_status_updated` ON `exam_sessions` (`user_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `study_plan_completions` (
	`plan_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`question_id` integer NOT NULL,
	`completed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`plan_id`, `question_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_plan_completions_user_plan` ON `study_plan_completions` (`user_id`,`plan_id`);--> statement-breakpoint
INSERT OR IGNORE INTO `answer_events` (`id`,`user_id`,`question_id`,`source`,`correct`,`answered_at`,`activity_date`)
SELECT 'legacy-' || `user_id` || '-' || `question_id`, `user_id`, `question_id`, 'legacy-backfill',
  CASE WHEN `status` = 'mastered' THEN 1 ELSE 0 END,
  `last_answered_at`, date(`last_answered_at`, '+8 hours')
FROM `question_progress`
WHERE `attempts` > 0;--> statement-breakpoint
PRAGMA optimize;

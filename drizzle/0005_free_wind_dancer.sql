CREATE TABLE `admin_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`target_user_id` text,
	`reason` text DEFAULT '' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_admin_audit_created_at` ON `admin_audit_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_admin_audit_target_created` ON `admin_audit_events` (`target_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `admin_request_nonces` (
	`nonce` text PRIMARY KEY NOT NULL,
	`actor_email` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_admin_request_nonces_expiry` ON `admin_request_nonces` (`expires_at`);--> statement-breakpoint
CREATE TABLE `admin_user_controls` (
	`user_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`suspension_reason` text,
	`updated_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_admin_user_controls_status` ON `admin_user_controls` (`status`);--> statement-breakpoint
CREATE TABLE `user_admin_rollups` (
	`user_id` text PRIMARY KEY NOT NULL,
	`last_activity_at` text,
	`last_activity_date` text,
	`answer_count` integer DEFAULT 0 NOT NULL,
	`objective_attempts` integer DEFAULT 0 NOT NULL,
	`objective_correct` integer DEFAULT 0 NOT NULL,
	`subjective_earned` integer DEFAULT 0 NOT NULL,
	`subjective_possible` integer DEFAULT 0 NOT NULL,
	`exam_count` integer DEFAULT 0 NOT NULL,
	`last_exam_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_user_admin_rollups_last_activity` ON `user_admin_rollups` (`last_activity_at`);--> statement-breakpoint
CREATE INDEX `idx_user_admin_rollups_last_activity_date` ON `user_admin_rollups` (`last_activity_date`);--> statement-breakpoint
CREATE INDEX `idx_answer_events_date_source` ON `answer_events` (`activity_date`,`source`);--> statement-breakpoint
CREATE INDEX `idx_answer_events_question_date` ON `answer_events` (`question_id`,`activity_date`);--> statement-breakpoint
CREATE INDEX `idx_exam_attempts_completed_at` ON `exam_attempts` (`completed_at`);--> statement-breakpoint
CREATE INDEX `idx_study_plans_date_status` ON `study_plans` (`plan_date`,`status`);--> statement-breakpoint
CREATE INDEX `idx_user_profiles_created_at` ON `user_profiles` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_user_profiles_updated_at` ON `user_profiles` (`updated_at`);--> statement-breakpoint
INSERT INTO `user_admin_rollups` (
	`user_id`, `last_activity_at`, `last_activity_date`, `answer_count`,
	`objective_attempts`, `objective_correct`, `subjective_earned`,
	`subjective_possible`, `exam_count`, `last_exam_at`, `updated_at`
)
SELECT
	p.`user_id`,
	CASE
		WHEN COALESCE(a.`last_answer_at`, '') >= COALESCE(x.`last_exam_at`, '') THEN a.`last_answer_at`
		ELSE x.`last_exam_at`
	END,
	substr(CASE
		WHEN COALESCE(a.`last_answer_at`, '') >= COALESCE(x.`last_exam_at`, '') THEN a.`last_answer_at`
		ELSE x.`last_exam_at`
	END, 1, 10),
	COALESCE(a.`answer_count`, 0),
	COALESCE(a.`objective_attempts`, 0),
	COALESCE(a.`objective_correct`, 0),
	COALESCE(a.`subjective_earned`, 0),
	COALESCE(a.`subjective_possible`, 0),
	COALESCE(x.`exam_count`, 0),
	x.`last_exam_at`,
	CURRENT_TIMESTAMP
FROM `user_profiles` p
LEFT JOIN (
	SELECT
		`user_id`, COUNT(*) AS `answer_count`, MAX(`answered_at`) AS `last_answer_at`,
		SUM(CASE WHEN `question_id` NOT IN (
			850123,850124,850125,850126,850127,850128,850129,850130,850131,850132,
			850153,850133,850134,850135,850136,850137,850138,850139,850140,850154,
			850155,850156,850157,850141,850158,850159,850160,850142,850143,850144,
			850145,850161,850162,850163,850146,850147,850148,850164,850165,850166,
			850167,850149,850150,850168,850169,850170,850171,850151,850172,850173,
			850174,850152,850175,850176,850177
		) THEN 1 ELSE 0 END) AS `objective_attempts`,
		SUM(CASE WHEN `question_id` NOT IN (
			850123,850124,850125,850126,850127,850128,850129,850130,850131,850132,
			850153,850133,850134,850135,850136,850137,850138,850139,850140,850154,
			850155,850156,850157,850141,850158,850159,850160,850142,850143,850144,
			850145,850161,850162,850163,850146,850147,850148,850164,850165,850166,
			850167,850149,850150,850168,850169,850170,850171,850151,850172,850173,
			850174,850152,850175,850176,850177
		) AND `correct` = 1 THEN 1 ELSE 0 END) AS `objective_correct`,
		SUM(CASE WHEN `question_id` IN (
			850123,850124,850125,850126,850127,850128,850129,850130,850131,850132,
			850153,850133,850134,850135,850136,850137,850138,850139,850140,850154,
			850155,850156,850157,850141,850158,850159,850160,850142,850143,850144,
			850145,850161,850162,850163,850146,850147,850148,850164,850165,850166,
			850167,850149,850150,850168,850169,850170,850171,850151,850172,850173,
			850174,850152,850175,850176,850177
		) THEN COALESCE(`earned_points`, 0) ELSE 0 END) AS `subjective_earned`,
		SUM(CASE WHEN `question_id` IN (
			850123,850124,850125,850126,850127,850128,850129,850130,850131,850132,
			850153,850133,850134,850135,850136,850137,850138,850139,850140,850154,
			850155,850156,850157,850141,850158,850159,850160,850142,850143,850144,
			850145,850161,850162,850163,850146,850147,850148,850164,850165,850166,
			850167,850149,850150,850168,850169,850170,850171,850151,850172,850173,
			850174,850152,850175,850176,850177
		) THEN COALESCE(`possible_points`, 0) ELSE 0 END) AS `subjective_possible`
	FROM `answer_events` GROUP BY `user_id`
) a ON a.`user_id` = p.`user_id`
LEFT JOIN (
	SELECT `user_id`, COUNT(*) AS `exam_count`, MAX(`completed_at`) AS `last_exam_at`
	FROM `exam_attempts` GROUP BY `user_id`
) x ON x.`user_id` = p.`user_id`;

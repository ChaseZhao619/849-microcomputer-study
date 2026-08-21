CREATE INDEX `idx_exam_attempts_user_completed` ON `exam_attempts` (`user_id`,`completed_at`);
--> statement-breakpoint
PRAGMA optimize;

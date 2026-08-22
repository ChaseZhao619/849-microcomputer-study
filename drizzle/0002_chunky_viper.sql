ALTER TABLE `user_profiles` ADD `nickname` text;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `study_id` text;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `bio` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_profiles_study_id` ON `user_profiles` (`study_id`);--> statement-breakpoint
PRAGMA optimize;

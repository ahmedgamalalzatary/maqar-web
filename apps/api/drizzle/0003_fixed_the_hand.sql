CREATE TABLE `client_prefs` (
	`user_id` bigint unsigned NOT NULL,
	`purposes` json NOT NULL,
	`budget_max` bigint unsigned NOT NULL,
	`area_ids` json NOT NULL,
	`types` json NOT NULL,
	`min_beds` tinyint unsigned NOT NULL DEFAULT 0,
	`interests` json NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_prefs_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `client_prefs` ADD CONSTRAINT `client_prefs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
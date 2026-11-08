CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`role` enum('client','owner','agent','admin') NOT NULL,
	`name` varchar(100) NOT NULL,
	`email` varchar(255),
	`password_hash` varchar(255),
	`phone` varchar(20),
	`lang` enum('ar','en') NOT NULL DEFAULT 'ar',
	`theme` enum('system','light','dark') NOT NULL DEFAULT 'system',
	`push_enabled` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`deleted_at` timestamp,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`user_id` bigint unsigned NOT NULL,
	`name_ar` varchar(100) NOT NULL,
	`name_en` varchar(100) NOT NULL,
	`role_title_ar` varchar(100) NOT NULL,
	`role_title_en` varchar(100) NOT NULL,
	`rating` decimal(2,1) NOT NULL DEFAULT 5,
	`deals_count` int NOT NULL DEFAULT 0,
	`years` int NOT NULL DEFAULT 0,
	`languages_ar` varchar(100) NOT NULL,
	`languages_en` varchar(100) NOT NULL,
	`avg_reply_mins` int NOT NULL DEFAULT 5,
	`phone` varchar(20) NOT NULL,
	`colour` varchar(7) NOT NULL,
	`monthly_target` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `agents_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`token_hash` char(64) NOT NULL,
	`expires_at` datetime NOT NULL,
	`revoked_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `refresh_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `refresh_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `agents` ADD CONSTRAINT `agents_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `refresh_tokens_user_idx` ON `refresh_tokens` (`user_id`);
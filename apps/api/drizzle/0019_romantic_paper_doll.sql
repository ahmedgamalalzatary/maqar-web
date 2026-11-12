CREATE TABLE `chat_reports` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`thread_id` bigint unsigned NOT NULL,
	`by` enum('client','agent') NOT NULL,
	`reporter_id` bigint unsigned,
	`reason` enum('spam','abuse','scam','other') NOT NULL,
	`note` varchar(500),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`resolved_at` timestamp(3),
	`resolved_by` bigint unsigned,
	`outcome` enum('dismissed','blocked','suspended'),
	CONSTRAINT `chat_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `chat_threads` ADD `blocked_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `chat_threads` ADD `blocked_by` enum('client','agent','admin');--> statement-breakpoint
ALTER TABLE `chat_reports` ADD CONSTRAINT `chat_reports_thread_id_chat_threads_id_fk` FOREIGN KEY (`thread_id`) REFERENCES `chat_threads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_reports` ADD CONSTRAINT `chat_reports_reporter_id_users_id_fk` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_reports` ADD CONSTRAINT `chat_reports_resolved_by_users_id_fk` FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `chat_reports_open_idx` ON `chat_reports` (`resolved_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `chat_reports_thread_idx` ON `chat_reports` (`thread_id`);
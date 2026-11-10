CREATE TABLE `chat_messages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`thread_id` bigint unsigned NOT NULL,
	`sender` enum('client','agent') NOT NULL,
	`kind` enum('text','images','property','plan','tour','slots','booking') NOT NULL,
	`body` json NOT NULL,
	`read_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_threads` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`client_id` bigint unsigned NOT NULL,
	`property_id` bigint unsigned NOT NULL,
	`agent_id` bigint unsigned NOT NULL,
	`lead_id` bigint unsigned,
	`last_message_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `chat_threads_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_threads_client_property_unique` UNIQUE(`client_id`,`property_id`)
);
--> statement-breakpoint
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_thread_id_chat_threads_id_fk` FOREIGN KEY (`thread_id`) REFERENCES `chat_threads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_threads` ADD CONSTRAINT `chat_threads_client_id_users_id_fk` FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_threads` ADD CONSTRAINT `chat_threads_property_id_properties_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_threads` ADD CONSTRAINT `chat_threads_agent_id_agents_user_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`user_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_threads` ADD CONSTRAINT `chat_threads_lead_id_leads_id_fk` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `chat_messages_thread_idx` ON `chat_messages` (`thread_id`,`id`);--> statement-breakpoint
CREATE INDEX `chat_threads_agent_idx` ON `chat_threads` (`agent_id`,`last_message_at`);
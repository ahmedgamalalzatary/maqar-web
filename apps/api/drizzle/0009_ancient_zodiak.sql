CREATE TABLE `lead_notes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`lead_id` bigint unsigned NOT NULL,
	`agent_id` bigint unsigned NOT NULL,
	`text` varchar(1000) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lead_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `leads` MODIFY COLUMN `source` varchar(40) NOT NULL DEFAULT 'booking';--> statement-breakpoint
ALTER TABLE `leads` MODIFY COLUMN `last_activity_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `leads` ADD `seen_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `leads` ADD `won_at` timestamp;--> statement-breakpoint
ALTER TABLE `lead_notes` ADD CONSTRAINT `lead_notes_lead_id_leads_id_fk` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lead_notes` ADD CONSTRAINT `lead_notes_agent_id_agents_user_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`user_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `lead_notes_lead_idx` ON `lead_notes` (`lead_id`,`created_at`);--> statement-breakpoint
UPDATE `leads` SET `source` = 'booking' WHERE `source` = 'app';

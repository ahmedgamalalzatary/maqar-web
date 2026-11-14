CREATE TABLE `app_settings` (
	`id` tinyint NOT NULL,
	`value` json NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `areas` MODIFY COLUMN `image` varchar(255);
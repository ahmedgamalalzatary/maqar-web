CREATE TABLE `agent_days_off` (
	`agent_id` bigint unsigned NOT NULL,
	`date` date NOT NULL,
	`reason` varchar(100),
	CONSTRAINT `agent_days_off_agent_id_date_pk` PRIMARY KEY(`agent_id`,`date`)
);
--> statement-breakpoint
CREATE TABLE `agent_hours` (
	`agent_id` bigint unsigned NOT NULL,
	`weekday` tinyint unsigned NOT NULL,
	`from_hour` tinyint unsigned NOT NULL,
	`to_hour` tinyint unsigned NOT NULL,
	CONSTRAINT `agent_hours_agent_id_weekday_pk` PRIMARY KEY(`agent_id`,`weekday`)
);
--> statement-breakpoint
CREATE TABLE `viewing_reminders` (
	`viewing_id` bigint unsigned NOT NULL,
	`offset` enum('1d','2h','30m') NOT NULL,
	`sent_at` timestamp,
	CONSTRAINT `viewing_reminders_viewing_id_offset_pk` PRIMARY KEY(`viewing_id`,`offset`)
);
--> statement-breakpoint
CREATE TABLE `viewings` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`property_id` bigint unsigned NOT NULL,
	`client_id` bigint unsigned NOT NULL,
	`agent_id` bigint unsigned NOT NULL,
	`starts_at` datetime NOT NULL,
	`mode` enum('visit','video') NOT NULL DEFAULT 'visit',
	`status` enum('confirmed','rescheduled','cancelled','completed') NOT NULL DEFAULT 'confirmed',
	`rescheduled_from` datetime,
	`video_url` varchar(500),
	`active` tinyint GENERATED ALWAYS AS ((if(`status` in ('confirmed','rescheduled'), 1, NULL))) STORED,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `viewings_id` PRIMARY KEY(`id`),
	CONSTRAINT `viewings_agent_hour_unique` UNIQUE(`agent_id`,`starts_at`,`active`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`client_id` bigint unsigned,
	`name` varchar(100),
	`phone` varchar(20),
	`property_id` bigint unsigned,
	`agent_id` bigint unsigned NOT NULL,
	`budget` bigint unsigned,
	`source` varchar(40) NOT NULL DEFAULT 'app',
	`stage` enum('new','contacted','viewing','negotiation','won','lost') NOT NULL DEFAULT 'new',
	`hot` boolean NOT NULL DEFAULT false,
	`from_app` boolean NOT NULL DEFAULT true,
	`last_activity_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leads_id` PRIMARY KEY(`id`),
	CONSTRAINT `leads_client_agent_unique` UNIQUE(`client_id`,`agent_id`)
);
--> statement-breakpoint
ALTER TABLE `agent_days_off` ADD CONSTRAINT `agent_days_off_agent_id_agents_user_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`user_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_hours` ADD CONSTRAINT `agent_hours_agent_id_agents_user_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`user_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `viewing_reminders` ADD CONSTRAINT `viewing_reminders_viewing_id_viewings_id_fk` FOREIGN KEY (`viewing_id`) REFERENCES `viewings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `viewings` ADD CONSTRAINT `viewings_property_id_properties_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `viewings` ADD CONSTRAINT `viewings_client_id_users_id_fk` FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `viewings` ADD CONSTRAINT `viewings_agent_id_agents_user_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`user_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_client_id_users_id_fk` FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_property_id_properties_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_agent_id_agents_user_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`user_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `viewings_client_idx` ON `viewings` (`client_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `leads_agent_idx` ON `leads` (`agent_id`,`stage`);
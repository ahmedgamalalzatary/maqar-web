CREATE TABLE `price_alerts` (
	`user_id` bigint unsigned NOT NULL,
	`property_id` bigint unsigned NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `price_alerts_user_id_property_id_pk` PRIMARY KEY(`user_id`,`property_id`)
);
--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`property_id` bigint unsigned NOT NULL,
	`old_price` bigint unsigned NOT NULL,
	`new_price` bigint unsigned NOT NULL,
	`changed_by` bigint unsigned,
	`at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `price_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `price_alerts` ADD CONSTRAINT `price_alerts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_alerts` ADD CONSTRAINT `price_alerts_property_id_properties_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_history` ADD CONSTRAINT `price_history_property_id_properties_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_history` ADD CONSTRAINT `price_history_changed_by_users_id_fk` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `price_alerts_property_idx` ON `price_alerts` (`property_id`);--> statement-breakpoint
CREATE INDEX `price_history_property_idx` ON `price_history` (`property_id`,`id`);
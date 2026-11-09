CREATE TABLE `tour_rooms` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`property_id` bigint unsigned NOT NULL,
	`name_ar` varchar(80) NOT NULL,
	`name_en` varchar(80) NOT NULL,
	`pano` varchar(255) NOT NULL,
	`sort` tinyint unsigned NOT NULL DEFAULT 0,
	CONSTRAINT `tour_rooms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `properties` DROP FOREIGN KEY `properties_owner_id_users_id_fk`;
--> statement-breakpoint
-- The owner role is removed (2026-11-09): owner accounts go first, or the enum change fails.
-- Their sessions, saved homes and preferences go with them (ON DELETE CASCADE).
DELETE FROM `users` WHERE `role` = 'owner';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('client','agent','admin') NOT NULL;--> statement-breakpoint
ALTER TABLE `tour_rooms` ADD CONSTRAINT `tour_rooms_property_id_properties_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `tour_rooms_property_idx` ON `tour_rooms` (`property_id`,`sort`);--> statement-breakpoint
ALTER TABLE `properties` DROP COLUMN `owner_id`;
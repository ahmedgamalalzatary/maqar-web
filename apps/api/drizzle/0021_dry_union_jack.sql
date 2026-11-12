CREATE TABLE `property_videos` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`property_id` bigint unsigned NOT NULL,
	`url` varchar(255) NOT NULL,
	`poster` varchar(255) NOT NULL,
	`duration_s` smallint unsigned NOT NULL,
	`width` smallint unsigned NOT NULL,
	`height` smallint unsigned NOT NULL,
	`sort` tinyint unsigned NOT NULL DEFAULT 0,
	CONSTRAINT `property_videos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `property_videos` ADD CONSTRAINT `property_videos_property_id_properties_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `property_videos_property_idx` ON `property_videos` (`property_id`,`sort`);
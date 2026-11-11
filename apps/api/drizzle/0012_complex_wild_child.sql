CREATE TABLE `listing_stats` (
	`property_id` bigint unsigned NOT NULL,
	`day` date NOT NULL,
	`views` int unsigned NOT NULL DEFAULT 0,
	`saves` int unsigned NOT NULL DEFAULT 0,
	CONSTRAINT `listing_stats_property_id_day_pk` PRIMARY KEY(`property_id`,`day`)
);
--> statement-breakpoint
ALTER TABLE `listing_stats` ADD CONSTRAINT `listing_stats_property_id_properties_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;
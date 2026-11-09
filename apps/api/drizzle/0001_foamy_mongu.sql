CREATE TABLE `areas` (
	`id` varchar(40) NOT NULL,
	`name_ar` varchar(100) NOT NULL,
	`name_en` varchar(100) NOT NULL,
	`city_ar` varchar(100) NOT NULL,
	`city_en` varchar(100) NOT NULL,
	`image` varchar(255) NOT NULL,
	CONSTRAINT `areas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`category` enum('sale','rent','stay','project') NOT NULL,
	`type` enum('apartment','villa','twinhouse','townhouse','chalet','penthouse','duplex','studio') NOT NULL,
	`title_ar` varchar(200) NOT NULL,
	`title_en` varchar(200) NOT NULL,
	`area_id` varchar(40) NOT NULL,
	`compound_ar` varchar(150) NOT NULL,
	`compound_en` varchar(150) NOT NULL,
	`developer_ar` varchar(150),
	`developer_en` varchar(150),
	`price` bigint unsigned NOT NULL,
	`old_price` bigint unsigned,
	`beds` tinyint unsigned NOT NULL,
	`baths` tinyint unsigned NOT NULL,
	`size_m2` smallint unsigned NOT NULL,
	`floor` tinyint unsigned,
	`finishing` enum('full','semi','core','furnished') NOT NULL,
	`delivery_year` smallint unsigned,
	`agent_id` bigint unsigned NOT NULL,
	`owner_id` bigint unsigned,
	`status` enum('draft','pending','approved','changes','sold','rented','unpublished') NOT NULL DEFAULT 'draft',
	`review_note` text,
	`featured` boolean NOT NULL DEFAULT false,
	`maintenance_fee` tinyint unsigned,
	`plan_down_pct` tinyint unsigned,
	`plan_years` tinyint unsigned,
	`desc_ar` text NOT NULL,
	`desc_en` text NOT NULL,
	`views` int unsigned NOT NULL DEFAULT 0,
	`published_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `properties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `property_features` (
	`property_id` bigint unsigned NOT NULL,
	`feature` enum('pool','garden','sea','parking','elevator','security','gym','clubhouse','smart','roof') NOT NULL,
	CONSTRAINT `property_features_property_id_feature_pk` PRIMARY KEY(`property_id`,`feature`)
);
--> statement-breakpoint
CREATE TABLE `property_images` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`property_id` bigint unsigned NOT NULL,
	`url` varchar(255) NOT NULL,
	`sort` tinyint unsigned NOT NULL DEFAULT 0,
	CONSTRAINT `property_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `properties` ADD CONSTRAINT `properties_area_id_areas_id_fk` FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `properties` ADD CONSTRAINT `properties_agent_id_agents_user_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `agents`(`user_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `properties` ADD CONSTRAINT `properties_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_features` ADD CONSTRAINT `property_features_property_id_properties_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `property_images` ADD CONSTRAINT `property_images_property_id_properties_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `properties_browse_idx` ON `properties` (`status`,`category`,`published_at`);--> statement-breakpoint
CREATE INDEX `properties_area_idx` ON `properties` (`status`,`area_id`,`published_at`);--> statement-breakpoint
CREATE INDEX `property_images_property_idx` ON `property_images` (`property_id`,`sort`);
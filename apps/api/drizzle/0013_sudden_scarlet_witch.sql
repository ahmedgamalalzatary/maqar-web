CREATE TABLE `interest_first` (
	`property_id` bigint unsigned NOT NULL,
	`client_id` bigint unsigned NOT NULL,
	`kind` enum('saved','followed','chatted','booked') NOT NULL,
	`day` date NOT NULL,
	CONSTRAINT `interest_first_property_id_client_id_kind_pk` PRIMARY KEY(`property_id`,`client_id`,`kind`)
);
--> statement-breakpoint
ALTER TABLE `interest_first` ADD CONSTRAINT `interest_first_property_id_properties_id_fk` FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `interest_first` ADD CONSTRAINT `interest_first_client_id_users_id_fk` FOREIGN KEY (`client_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
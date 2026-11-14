ALTER TABLE `viewings` MODIFY COLUMN `status` enum('confirmed','rescheduled','cancelled','completed','pending') NOT NULL DEFAULT 'confirmed';--> statement-breakpoint
ALTER TABLE `viewings` MODIFY COLUMN `active` tinyint GENERATED ALWAYS AS ((if(`status` in ('confirmed','rescheduled','pending'), 1, NULL))) STORED;

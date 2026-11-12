ALTER TABLE `viewings` ADD `cancelled_by` enum('client','agent','admin');--> statement-breakpoint
ALTER TABLE `leads` ADD `lost_at` timestamp;
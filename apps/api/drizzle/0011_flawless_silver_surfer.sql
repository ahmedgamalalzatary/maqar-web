-- No review step any more (2026-11-09): listings waiting for review or changes become drafts.
UPDATE `properties` SET `status` = 'draft' WHERE `status` IN ('pending', 'changes');--> statement-breakpoint
ALTER TABLE `properties` MODIFY COLUMN `agent_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `properties` MODIFY COLUMN `status` enum('draft','approved','unpublished','sold','rented') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `properties` ADD `owner_name` varchar(120);--> statement-breakpoint
ALTER TABLE `properties` ADD `owner_phone` varchar(30);
ALTER TABLE `command_execution` ADD `installation_id` text;--> statement-breakpoint
CREATE INDEX `command_execution_installation_id_idx` ON `command_execution` (`installation_id`);
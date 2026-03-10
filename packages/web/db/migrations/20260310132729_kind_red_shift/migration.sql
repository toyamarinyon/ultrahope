PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_command_execution` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`cli_session_id` text NOT NULL,
	`installation_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`command` text NOT NULL,
	`args` text NOT NULL,
	`api` text NOT NULL,
	`request_payload` text,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	CONSTRAINT `fk_command_execution_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_command_execution`(`id`, `cli_session_id`, `installation_id`, `user_id`, `command`, `args`, `api`, `request_payload`, `started_at`, `finished_at`) SELECT `id`, `cli_session_id`, `installation_id`, `user_id`, `command`, `args`, `api`, `request_payload`, `started_at`, `finished_at` FROM `command_execution`;--> statement-breakpoint
DROP TABLE `command_execution`;--> statement-breakpoint
ALTER TABLE `__new_command_execution` RENAME TO `command_execution`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `command_execution_command_idx` ON `command_execution` (`command`);--> statement-breakpoint
CREATE INDEX `command_execution_installation_id_idx` ON `command_execution` (`installation_id`);--> statement-breakpoint
CREATE INDEX `command_execution_started_at_idx` ON `command_execution` (`started_at`);--> statement-breakpoint
CREATE INDEX `command_execution_finished_at_idx` ON `command_execution` (`finished_at`);
CREATE TABLE `command_execution` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`cli_session_id` text NOT NULL,
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
CREATE TABLE `generation` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`command_execution_id` integer NOT NULL,
	`vercel_ai_gateway_generation_id` text NOT NULL,
	`provider_name` text NOT NULL,
	`model` text NOT NULL,
	`cost` integer NOT NULL,
	`latency` integer NOT NULL,
	`created_at` integer NOT NULL,
	`gateway_payload` text,
	`output` text NOT NULL,
	CONSTRAINT `fk_generation_command_execution_id_command_execution_id_fk` FOREIGN KEY (`command_execution_id`) REFERENCES `command_execution`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `generation_score` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`generation_id` integer NOT NULL,
	`value` integer NOT NULL,
	`comment` text,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_generation_score_generation_id_generation_id_fk` FOREIGN KEY (`generation_id`) REFERENCES `generation`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `device_code` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`device_code` text NOT NULL,
	`user_code` text NOT NULL,
	`user_id` integer,
	`expires_at` integer NOT NULL,
	`status` text NOT NULL,
	`last_polled_at` integer,
	`polling_interval` integer,
	`client_id` text,
	`scope` text
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` integer NOT NULL,
	CONSTRAINT `fk_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `command_execution_command_idx` ON `command_execution` (`command`);--> statement-breakpoint
CREATE INDEX `command_execution_started_at_idx` ON `command_execution` (`started_at`);--> statement-breakpoint
CREATE INDEX `command_execution_finished_at_idx` ON `command_execution` (`finished_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `generation_gateway_id_unique` ON `generation` (`vercel_ai_gateway_generation_id`);--> statement-breakpoint
CREATE INDEX `generation_model_idx` ON `generation` (`model`);--> statement-breakpoint
CREATE INDEX `generation_started_at_idx` ON `generation` (`created_at`);--> statement-breakpoint
CREATE INDEX `generation_score_generation_id_idx` ON `generation_score` (`generation_id`);--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);
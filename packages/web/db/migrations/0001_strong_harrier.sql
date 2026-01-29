CREATE TABLE `command_execution` (
	`id` text PRIMARY KEY NOT NULL,
	`cli_session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`command` text NOT NULL,
	`args` text NOT NULL,
	`api` text NOT NULL,
	`request_payload` text,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `command_execution_command_idx` ON `command_execution` (`command`);--> statement-breakpoint
CREATE INDEX `command_execution_started_at_idx` ON `command_execution` (`started_at`);--> statement-breakpoint
CREATE INDEX `command_execution_finished_at_idx` ON `command_execution` (`finished_at`);--> statement-breakpoint
CREATE TABLE `free_plan_daily_usage` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `date`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `free_plan_daily_usage_date_idx` ON `free_plan_daily_usage` (`date`);--> statement-breakpoint
CREATE TABLE `generation` (
	`id` text PRIMARY KEY NOT NULL,
	`command_execution_id` text NOT NULL,
	`vercel_ai_gateway_generation_id` text NOT NULL,
	`provider_name` text NOT NULL,
	`model` text NOT NULL,
	`cost` integer NOT NULL,
	`latency` integer NOT NULL,
	`created_at` integer NOT NULL,
	`gateway_payload` text,
	`output` text NOT NULL,
	FOREIGN KEY (`command_execution_id`) REFERENCES `command_execution`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `generation_gateway_id_unique` ON `generation` (`vercel_ai_gateway_generation_id`);--> statement-breakpoint
CREATE INDEX `generation_model_idx` ON `generation` (`model`);--> statement-breakpoint
CREATE INDEX `generation_started_at_idx` ON `generation` (`created_at`);
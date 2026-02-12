ALTER TABLE `user` ADD COLUMN `auto_recharge_enabled` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `user` ADD COLUMN `auto_recharge_threshold` integer DEFAULT 1000000 NOT NULL;
--> statement-breakpoint
ALTER TABLE `user` ADD COLUMN `auto_recharge_amount` integer DEFAULT 10 NOT NULL;

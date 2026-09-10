CREATE TABLE `budgets` (
	`user_id` text NOT NULL,
	`month` text NOT NULL,
	`category` text NOT NULL,
	`amount` integer NOT NULL,
	PRIMARY KEY(`user_id`, `month`, `category`)
);
--> statement-breakpoint
CREATE TABLE `savings_goals` (
	`user_id` text PRIMARY KEY NOT NULL,
	`amount` integer DEFAULT 100000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`occurred_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_transactions_user_date` ON `transactions` (`user_id`,`occurred_at`);
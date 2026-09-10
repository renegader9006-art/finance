PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_savings_goals` (
	`user_id` text PRIMARY KEY NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_savings_goals`("user_id", "amount") SELECT "user_id", "amount" FROM `savings_goals`;--> statement-breakpoint
DROP TABLE `savings_goals`;--> statement-breakpoint
ALTER TABLE `__new_savings_goals` RENAME TO `savings_goals`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
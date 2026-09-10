import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    kind: text("kind", { enum: ["income", "expense", "debt", "saving"] }).notNull(),
    amount: integer("amount").notNull(),
    occurredAt: text("occurred_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_transactions_user_date").on(table.userId, table.occurredAt)],
);

export const budgets = sqliteTable(
  "budgets",
  {
    userId: text("user_id").notNull(),
    month: text("month").notNull(),
    category: text("category").notNull(),
    amount: integer("amount").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.month, table.category] })],
);

export const savingsGoals = sqliteTable("savings_goals", {
  userId: text("user_id").primaryKey(),
  amount: integer("amount").notNull().default(0),
});

import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { budgets, savingsGoals, transactions } from "../../../db/schema";
import { getSupabaseUser } from "../../../lib/supabase";

const kinds = new Set(["income", "expense", "debt", "saving"]);

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Неизвестная ошибка";
  return message.includes("no such table") ? "Хранилище еще не подготовлено" : "Не удалось сохранить данные";
}

export async function GET(request: Request) {
  const user = await getSupabaseUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  try {
    const db = getDb();
    const [transactionRows, budgetRows, goalRows] = await Promise.all([
      db.select().from(transactions).where(eq(transactions.userId, user.id)).orderBy(desc(transactions.occurredAt), desc(transactions.createdAt)),
      db.select().from(budgets).where(eq(budgets.userId, user.id)),
      db.select().from(savingsGoals).where(eq(savingsGoals.userId, user.id)).limit(1),
    ]);
    return Response.json({
      transactions: transactionRows.map((row) => ({ id: row.id, title: row.title, category: row.category, kind: row.kind, amount: row.amount, date: row.occurredAt })),
      budgets: budgetRows,
      savingsGoal: goalRows[0]?.amount ?? 0,
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSupabaseUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const db = getDb();

    if (payload.action === "budget") {
      const month = String(payload.month ?? "");
      const category = String(payload.category ?? "").trim();
      const amount = Math.round(Number(payload.amount));
      if (!/^\d{4}-\d{2}$/.test(month) || !category || !Number.isFinite(amount) || amount < 0) return Response.json({ error: "Некорректный бюджет" }, { status: 400 });
      await db.insert(budgets).values({ userId: user.id, month, category, amount }).onConflictDoUpdate({ target: [budgets.userId, budgets.month, budgets.category], set: { amount } });
      return Response.json({ ok: true });
    }

    if (payload.action === "goal") {
      const amount = Math.round(Number(payload.amount));
      if (!Number.isFinite(amount) || amount < 0) return Response.json({ error: "Некорректная цель" }, { status: 400 });
      await db.insert(savingsGoals).values({ userId: user.id, amount }).onConflictDoUpdate({ target: savingsGoals.userId, set: { amount } });
      return Response.json({ ok: true });
    }

    const title = String(payload.title ?? "").trim();
    const category = String(payload.category ?? "Другое").trim();
    const kind = String(payload.kind ?? "");
    const amount = Math.round(Number(payload.amount));
    const date = String(payload.date ?? "");
    if (!title || !category || !kinds.has(kind) || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "Проверьте данные операции" }, { status: 400 });
    const transaction = { id: crypto.randomUUID(), userId: user.id, title, category, kind: kind as "income" | "expense" | "debt" | "saving", amount, occurredAt: date };
    await db.insert(transactions).values(transaction);
    return Response.json({ transaction: { ...transaction, date: transaction.occurredAt } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await getSupabaseUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const id = String(payload.id ?? "").trim();
    const title = String(payload.title ?? "").trim();
    const category = String(payload.category ?? "Другое").trim();
    const kind = String(payload.kind ?? "");
    const amount = Math.round(Number(payload.amount));
    const date = String(payload.date ?? "");

    if (!id || !title || !category || !kinds.has(kind) || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: "Проверьте данные операции" }, { status: 400 });
    }

    const db = getDb();
    const existing = await db.select({ id: transactions.id }).from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, user.id))).limit(1);
    if (!existing.length) return Response.json({ error: "Операция не найдена" }, { status: 404 });

    const updated = {
      title,
      category,
      kind: kind as "income" | "expense" | "debt" | "saving",
      amount,
      occurredAt: date,
    };
    await db.update(transactions).set(updated).where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));
    return Response.json({ transaction: { id, ...updated, date: updated.occurredAt } });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getSupabaseUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Не указана операция" }, { status: 400 });
  try {
    const db = getDb();
    await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

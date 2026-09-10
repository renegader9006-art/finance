"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight,
  Download, Landmark, LogOut, MoreHorizontal, PiggyBank, Plus, Search,
  Target, Trash2, WalletCards,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBrowserSupabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

type Kind = "income" | "expense" | "debt" | "saving";
type Transaction = { id: string; title: string; category: string; kind: Kind; amount: number; date: string };
type Budget = { month: string; category: string; amount: number };
type WebTool = { name: string; title?: string; description: string; inputSchema: object; annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }; execute: (input: unknown) => unknown | Promise<unknown> };

declare global {
  interface Document { readonly modelContext?: { registerTool: (tool: WebTool, options?: { signal?: AbortSignal }) => void | Promise<void> } }
}

const rubles = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
const categories = ["Жилье", "Еда", "Транспорт", "Покупки", "Сервисы", "Здоровье", "Долги", "Резерв", "Другое"];
const budgetColors = [
  "[&_[data-slot=progress-indicator]]:bg-[#2377d8]",
  "[&_[data-slot=progress-indicator]]:bg-[#f2ae45]",
  "[&_[data-slot=progress-indicator]]:bg-[#f05b61]",
  "[&_[data-slot=progress-indicator]]:bg-[#3ca37b]",
];

function kindLabel(kind: Kind) { return { income: "Доход", expense: "Расход", debt: "Долг", saving: "Накопление" }[kind]; }
function kindClass(kind: Kind) { return { income: "bg-blue-50 text-blue-700", expense: "bg-rose-50 text-rose-700", debt: "bg-amber-50 text-amber-800", saving: "bg-emerald-50 text-emerald-700" }[kind]; }

export function FinanceDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const supabase = useMemo(() => getBrowserSupabase(), []);

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  if (!authReady) return <div className="grid min-h-screen place-items-center bg-[#f5f7f8] text-sm text-muted-foreground">Загрузка...</div>;
  if (!supabase) return <AuthUnavailable />;
  if (!session) return <AuthScreen />;

  return <LedgerDashboard email={session.user.email ?? "Пользователь"} accessToken={session.access_token} onSignOut={() => void supabase.auth.signOut()} />;
}

function AuthUnavailable() {
  return <main className="grid min-h-screen place-items-center bg-[#f5f7f8] px-5"><div className="surface w-full max-w-[420px] p-6 text-center"><WalletCards className="mx-auto mb-4 size-10" /><h1 className="text-xl font-semibold">Баланс</h1><p className="mt-2 text-sm text-muted-foreground">Сервис регистрации еще не подключен.</p></div></main>;
}

function AuthScreen() {
  const supabase = getBrowserSupabase()!;
  const [busy, setBusy] = useState(false);

  async function authenticate(mode: "login" | "register", formData: FormData) {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (!email || password.length < 6) { toast.error("Введите email и пароль от 6 символов"); return; }
    setBusy(true);
    const result = mode === "login" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) { toast.error(result.error.message === "Invalid login credentials" ? "Неверный email или пароль" : result.error.message); return; }
    if (mode === "register" && !result.data.session) toast.success("Проверьте почту и подтвердите регистрацию");
  }

  return <main className="grid min-h-screen place-items-center bg-[#f5f7f8] px-4 py-8"><Toaster position="top-center" /><div className="w-full max-w-[420px]"><div className="mb-7 flex items-center justify-center gap-3"><span className="grid size-11 place-items-center rounded-md bg-[#172229] text-white"><WalletCards /></span><span className="text-2xl font-semibold">Баланс</span></div><div className="surface p-5"><Tabs defaultValue="login"><TabsList className="mb-5 grid h-11 w-full grid-cols-2"><TabsTrigger value="login">Вход</TabsTrigger><TabsTrigger value="register">Регистрация</TabsTrigger></TabsList><TabsContent value="login"><AuthForm busy={busy} submit={(data) => authenticate("login", data)} button="Войти" /></TabsContent><TabsContent value="register"><AuthForm busy={busy} submit={(data) => authenticate("register", data)} button="Создать аккаунт" /></TabsContent></Tabs></div><p className="mt-4 text-center text-xs text-muted-foreground">Ваши операции доступны только после входа.</p></div></main>;
}

function AuthForm({ busy, submit, button }: { busy: boolean; submit: (data: FormData) => void | Promise<void>; button: string }) {
  return <form action={submit} className="grid gap-4"><div className="grid gap-2"><Label htmlFor={`${button}-email`}>Email</Label><Input id={`${button}-email`} name="email" type="email" autoComplete="email" required placeholder="mail@example.com" /></div><div className="grid gap-2"><Label htmlFor={`${button}-password`}>Пароль</Label><Input id={`${button}-password`} name="password" type="password" minLength={6} autoComplete={button === "Войти" ? "current-password" : "new-password"} required placeholder="Минимум 6 символов" /></div><Button type="submit" disabled={busy} className="mt-1 h-12 bg-[#172229]">{busy ? "Подождите..." : button}</Button></form>;
}

function LedgerDashboard({ email, accessToken, onSignOut }: { email: string; accessToken: string; onSignOut: () => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Kind | "all">("all");
  const [open, setOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [budgetRows, setBudgetRows] = useState<Budget[]>([]);
  const [savingsGoal, setSavingsGoal] = useState(0);
  const [loading, setLoading] = useState(true);
  const activeDate = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  }, [monthOffset]);
  const monthKey = `${activeDate.getFullYear()}-${String(activeDate.getMonth() + 1).padStart(2, "0")}`;
  const budgets = useMemo(() => Object.fromEntries(budgetRows.filter((item) => item.month === monthKey).map((item) => [item.category, item.amount])), [budgetRows, monthKey]);
  const monthTransactions = useMemo(() => transactions.filter((item) => item.date.startsWith(monthKey)), [transactions, monthKey]);
  const filtered = useMemo(() => monthTransactions.filter((item) => (filter === "all" || item.kind === filter) && `${item.title} ${item.category}`.toLowerCase().includes(query.toLowerCase())), [monthTransactions, query, filter]);
  const totals = useMemo(() => {
    const income = monthTransactions.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
    const expenses = monthTransactions.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
    const savings = monthTransactions.filter((item) => item.kind === "saving").reduce((sum, item) => sum + item.amount, 0);
    return { income, expenses, savings, balance: income - expenses - savings };
  }, [monthTransactions]);
  const month = activeDate.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  const chartData = useMemo(() => {
    let income = 0; let expense = 0;
    return Array.from({ length: 8 }, (_, index) => Math.min(1 + index * 4, new Date(activeDate.getFullYear(), activeDate.getMonth() + 1, 0).getDate())).map((day) => {
      income = monthTransactions.filter((item) => item.kind === "income" && Number(item.date.slice(-2)) <= day).reduce((sum, item) => sum + item.amount, 0);
      expense = monthTransactions.filter((item) => item.kind === "expense" && Number(item.date.slice(-2)) <= day).reduce((sum, item) => sum + item.amount, 0);
      return { day: String(day), income: Math.round(income / 1000), expense: Math.round(expense / 1000) };
    });
  }, [monthTransactions, activeDate]);
  const budgetItems = useMemo(() => Object.entries(budgets).map(([name, limit], index) => ({ name, limit, spent: monthTransactions.filter((item) => item.kind === "expense" && item.category === name).reduce((sum, item) => sum + item.amount, 0), className: budgetColors[index % budgetColors.length] })), [budgets, monthTransactions]);

  function apiFetch(url: string, init: RequestInit = {}) {
    return fetch(url, { ...init, headers: { ...init.headers, authorization: `Bearer ${accessToken}` } });
  }

  useEffect(() => {
    apiFetch("/api/ledger").then(async (response) => {
      if (!response.ok) throw new Error();
      return response.json();
    }).then((data) => {
      setTransactions(data.transactions);
      setSavingsGoal(data.savingsGoal ?? 0);
      setBudgetRows(data.budgets);
    }).catch(() => toast.error("Данные пока недоступны")).finally(() => setLoading(false));
  }, [accessToken]);

  async function addTransaction(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim();
    const amount = Number(formData.get("amount"));
    const kind = String(formData.get("kind")) as Kind;
    if (!title || !amount || amount <= 0) { toast.error("Заполните название и сумму"); return; }
    const transaction = { id: crypto.randomUUID(), title, amount, kind, category: String(formData.get("category") ?? "Другое"), date: String(formData.get("date") ?? `${monthKey}-01`) };
    const response = await apiFetch("/api/ledger", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(transaction) });
    if (!response.ok) { toast.error("Не удалось сохранить операцию"); return; }
    const data = await response.json(); transaction.id = data.transaction.id;
    setTransactions((items) => [transaction, ...items]);
    setOpen(false); toast.success("Операция добавлена");
  }

  async function removeTransaction(id: string) {
    const response = await apiFetch(`/api/ledger?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) { toast.error("Не удалось удалить операцию"); return; }
    setTransactions((items) => items.filter((transaction) => transaction.id !== id));
    toast.success("Операция удалена");
  }

  async function saveBudget(formData: FormData) {
    const category = String(formData.get("budget-category") ?? "");
    const amount = Math.round(Number(formData.get("budget-amount")));
    const goal = Math.round(Number(formData.get("savings-goal")));
    if (!category || !Number.isFinite(amount) || amount < 0 || !Number.isFinite(goal) || goal < 0) { toast.error("Проверьте суммы"); return; }
    const responses = await Promise.all([
      apiFetch("/api/ledger", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "budget", month: monthKey, category, amount }) }),
      apiFetch("/api/ledger", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "goal", amount: goal }) }),
    ]);
    if (responses.some((response) => !response.ok)) { toast.error("Не удалось сохранить бюджет"); return; }
    setBudgetRows((items) => [...items.filter((item) => item.month !== monthKey || item.category !== category), { month: monthKey, category, amount }]); setSavingsGoal(goal); setBudgetOpen(false); toast.success("Бюджет обновлен");
  }

  function exportCsv() {
    const rows = [["Дата", "Название", "Категория", "Тип", "Сумма"], ...filtered.map((item) => [item.date, item.title, item.category, kindLabel(item.kind), item.amount])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    link.download = "balans-september-2026.csv"; link.click(); URL.revokeObjectURL(link.href); toast.success("Таблица выгружена");
  }

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: WebTool) => Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined);
    void register({
      name: "add_transaction",
      title: "Добавить операцию",
      description: "Добавляет доход, расход, долг или накопление в текущую таблицу пользователя.",
      inputSchema: {
        type: "object",
        properties: { title: { type: "string" }, amount: { type: "number", minimum: 1 }, kind: { type: "string", enum: ["income", "expense", "debt", "saving"] }, category: { type: "string" }, date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } },
        required: ["title", "amount", "kind", "category", "date"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const value = input as Record<string, unknown>;
        const form = new FormData();
        for (const key of ["title", "amount", "kind", "category", "date"]) form.set(key, String(value[key] ?? ""));
        await addTransaction(form);
        return { status: "created", title: String(value.title), amount: Number(value.amount) };
      },
    });
    void register({
      name: "get_month_summary",
      title: "Итоги месяца",
      description: "Возвращает текущие суммы доходов, расходов, накоплений и доступного баланса.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() { return { month: monthKey, ...totals, transactionCount: monthTransactions.length }; },
    });
    return () => lifecycle.abort();
  }, [monthKey, totals, monthTransactions.length]);

  return (
    <main className="min-h-screen bg-[#f5f7f8] text-[#182025]">
      <Toaster position="top-center" />
      <header className="sticky top-0 z-30 border-b border-black/6 bg-white/94 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[480px] items-center gap-3 px-4">
          <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-md bg-[#172229] text-white"><WalletCards className="size-5" /></span><span className="text-lg font-semibold">Баланс</span></div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden max-w-[120px] text-right min-[420px]:block"><p className="truncate text-sm font-medium leading-4">{email.split("@")[0]}</p><p className="truncate text-xs text-muted-foreground">{email}</p></div><Button variant="ghost" size="icon" aria-label="Выйти" title="Выйти" onClick={onSignOut}><LogOut /></Button>
            <span className="grid size-9 place-items-center rounded-full bg-[#e1f0f4] text-sm font-semibold text-[#19586c]">Б</span>
          </div>
        </div>
      </header>

      <div id="overview" className="mx-auto max-w-[480px] scroll-mt-20 px-3 pb-28 pt-5">
        <section className="mb-5 flex flex-col gap-4">
          <div><p className="mb-1 text-sm text-muted-foreground">Личные финансы</p><h1 className="text-2xl font-semibold leading-tight">Деньги под контролем</h1></div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-11 flex-1 items-center rounded-md border border-black/8 bg-white p-1 shadow-sm"><Button variant="ghost" size="icon-sm" aria-label="Предыдущий месяц" onClick={() => setMonthOffset((value) => value - 1)}><ChevronLeft /></Button><span className="min-w-0 flex-1 px-1 text-center text-sm font-medium capitalize">{month}</span><Button variant="ghost" size="icon-sm" aria-label="Следующий месяц" onClick={() => setMonthOffset((value) => value + 1)}><ChevronRight /></Button></div>
            <Button variant="outline" size="icon" aria-label="Выгрузить CSV" title="Выгрузить CSV" onClick={exportCsv}><Download /></Button>
            <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="h-11 bg-[#172229] px-3 hover:bg-[#29383f]"><Plus /> Добавить</Button></DialogTrigger><DialogContent className="max-h-[92dvh] overflow-y-auto"><DialogHeader><DialogTitle>Новая операция</DialogTitle><DialogDescription>Добавьте доход, расход, долг или перевод в накопления.</DialogDescription></DialogHeader><form action={addTransaction} className="grid gap-4"><div className="grid gap-2"><Label htmlFor="title">Название</Label><Input id="title" name="title" placeholder="Например, продукты" autoFocus /></div><div className="grid gap-4"><div className="grid gap-2"><Label htmlFor="amount">Сумма, ₽</Label><Input id="amount" name="amount" type="number" min="1" placeholder="0" inputMode="decimal" /></div><div className="grid gap-2"><Label htmlFor="date">Дата</Label><Input id="date" name="date" type="date" defaultValue={`${monthKey}-10`} /></div></div><div className="grid gap-4"><div className="grid gap-2"><Label>Тип</Label><Select name="kind" defaultValue="expense"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="income">Доход</SelectItem><SelectItem value="expense">Расход</SelectItem><SelectItem value="debt">Долг</SelectItem><SelectItem value="saving">Накопление</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>Категория</Label><Select name="category" defaultValue="Другое"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button type="submit" className="h-11 w-full bg-[#172229]">Добавить операцию</Button></DialogFooter></form></DialogContent></Dialog>
          </div>
        </section>

        <section className="mb-4 grid grid-cols-2 gap-3">
          {[
            { label: "Баланс", value: totals.balance, note: "Доступно сейчас", icon: Landmark, tone: "ink" },
            { label: "Доходы", value: totals.income, note: `${monthTransactions.filter((item) => item.kind === "income").length} поступления`, icon: ArrowDownLeft, tone: "blue" },
            { label: "Расходы", value: totals.expenses, note: totals.income ? `${Math.round((totals.expenses / totals.income) * 100)}% от дохода` : "Нет доходов", icon: ArrowUpRight, tone: "rose" },
            { label: "Накопления", value: totals.savings, note: savingsGoal > 0 ? `${Math.min(100, Math.round((totals.savings / savingsGoal) * 100))}% от цели` : "Цель не задана", icon: PiggyBank, tone: "green" },
          ].map((card) => <article key={card.label} className={`summary-card summary-${card.tone} ${card.label === "Баланс" || card.label === "Накопления" ? "col-span-2" : ""}`}><div className="mb-5 flex items-center justify-between"><span className="text-sm font-medium opacity-75">{card.label}</span><card.icon className="size-5 opacity-70" /></div><p className="amount-value text-xl font-semibold tabular-nums">{rubles.format(card.value)}</p><p className="mt-2 text-xs opacity-65">{card.note}</p></article>)}
        </section>

        <section className="mb-4 grid gap-4">
          <article className="surface min-h-[320px] p-4">
            <div className="mb-6 flex items-center justify-between"><div><h2 className="font-semibold">Движение средств</h2><p className="text-sm text-muted-foreground">Накопительно за месяц</p></div><div className="flex items-center gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-2"><i className="size-2 rounded-full bg-[#2377d8]" />Доходы</span><span className="flex items-center gap-2"><i className="size-2 rounded-full bg-[#f05b61]" />Расходы</span></div></div>
            <div className="h-[225px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 5, right: 2, left: -30, bottom: 0 }}><defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2377d8" stopOpacity={0.16} /><stop offset="95%" stopColor="#2377d8" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e8ecee" /><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#899399", fontSize: 12 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#899399", fontSize: 12 }} tickFormatter={(value) => `${value}к`} /><ChartTooltip contentStyle={{ borderRadius: 8, borderColor: "#e5e8ea", fontSize: 13 }} formatter={(value) => `${value} 000 ₽`} /><Area type="monotone" dataKey="income" stroke="#2377d8" strokeWidth={2.5} fill="url(#incomeFill)" /><Area type="monotone" dataKey="expense" stroke="#f05b61" strokeWidth={2.5} fill="transparent" /></AreaChart></ResponsiveContainer></div>
          </article>
          <aside id="budgets" className="surface scroll-mt-20 p-4"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Бюджет</h2><p className="text-sm capitalize text-muted-foreground">Лимиты на {month}</p></div><Dialog open={budgetOpen} onOpenChange={setBudgetOpen}><DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Настроить бюджеты" title="Настроить бюджеты"><MoreHorizontal /></Button></DialogTrigger><DialogContent className="max-h-[92dvh] overflow-y-auto"><DialogHeader><DialogTitle>Настройка бюджета</DialogTitle><DialogDescription>Установите лимит категории на выбранный месяц и цель накоплений.</DialogDescription></DialogHeader><form action={saveBudget} className="grid gap-4"><div className="grid gap-2"><Label>Категория</Label><Select name="budget-category" defaultValue="Еда"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{categories.filter((category) => !["Долги", "Резерв"].includes(category)).map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="budget-amount">Лимит, ₽</Label><Input id="budget-amount" name="budget-amount" type="number" min="0" placeholder="0" inputMode="decimal" /></div><div className="grid gap-2"><Label htmlFor="savings-goal">Цель накоплений, ₽</Label><Input id="savings-goal" name="savings-goal" type="number" min="0" placeholder="0" defaultValue={savingsGoal || undefined} inputMode="decimal" /></div><DialogFooter><Button type="submit" className="h-11 w-full bg-[#172229]">Сохранить</Button></DialogFooter></form></DialogContent></Dialog></div>{budgetItems.length ? <div className="space-y-6">{budgetItems.map((item) => <div key={item.name}><div className="mb-2 flex items-baseline justify-between gap-3"><span className="text-sm font-medium">{item.name}</span><span className="text-xs text-muted-foreground">{rubles.format(item.spent)} / {rubles.format(item.limit)}</span></div><Progress value={item.limit ? Math.min(100, (item.spent / item.limit) * 100) : 0} className={item.className} /></div>)}</div> : <button type="button" onClick={() => setBudgetOpen(true)} className="w-full rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Добавить первый лимит</button>}<div id="goals" className="mt-6 scroll-mt-20 border-t pt-5"><div className="mb-2 flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-medium"><Target className="size-4 text-[#3ca37b]" /> Резерв</span><span>{savingsGoal > 0 ? Math.min(100, Math.round((totals.savings / savingsGoal) * 100)) : 0}%</span></div><p className="text-xs text-muted-foreground">{savingsGoal > 0 ? `${rubles.format(totals.savings)} из ${rubles.format(savingsGoal)}` : "Цель не задана"}</p></div></aside>
        </section>

        <section id="transactions" className="surface scroll-mt-20 overflow-hidden">
          <div className="border-b p-4"><div className="mb-3"><h2 className="font-semibold">Операции</h2><p className="text-sm text-muted-foreground">{loading ? "Загружаем данные" : `${filtered.length} записей в выбранном месяце`}</p></div><div className="grid grid-cols-[minmax(0,1fr)_132px] gap-2"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full pl-9" placeholder="Поиск" /></div><Select value={filter} onValueChange={(value) => setFilter(value as Kind | "all")}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Все типы</SelectItem><SelectItem value="income">Доходы</SelectItem><SelectItem value="expense">Расходы</SelectItem><SelectItem value="debt">Долги</SelectItem><SelectItem value="saving">Накопления</SelectItem></SelectContent></Select></div></div>
          {filtered.length ? <div className="divide-y">{filtered.map((item) => <article key={item.id} className="flex min-h-[82px] items-center gap-3 px-4 py-3"><span className={`grid size-10 shrink-0 place-items-center rounded-md ${kindClass(item.kind)}`}>{item.kind === "income" ? <ArrowDownLeft /> : <ArrowUpRight />}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><h3 className="truncate text-[15px] font-medium">{item.title}</h3><p className={`shrink-0 text-[15px] font-semibold tabular-nums ${item.kind === "income" ? "text-[#2377d8]" : item.kind === "expense" ? "text-[#de4d55]" : ""}`}>{item.kind === "income" ? "+" : "−"}{rubles.format(item.amount)}</p></div><div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span className="truncate">{item.category} · {kindLabel(item.kind)}</span><span className="shrink-0">{new Date(`${item.date}T00:00:00`).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}</span></div></div><Button variant="ghost" size="icon-sm" className="shrink-0" aria-label={`Удалить ${item.title}`} onClick={() => void removeTransaction(item.id)}><Trash2 /></Button></article>)}</div> : <div className="grid min-h-44 place-items-center px-6 py-8 text-center"><div><CalendarDays className="mx-auto mb-3 size-8 text-muted-foreground/60" /><p className="font-medium">Пока нет операций</p><p className="mt-1 text-sm text-muted-foreground">Добавьте первую запись за этот месяц</p><Button className="mt-4 h-11 bg-[#172229]" onClick={() => setOpen(true)}><Plus /> Добавить</Button></div></div>}
        </section>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto grid h-[calc(70px+env(safe-area-inset-bottom))] max-w-[480px] grid-cols-5 border-t border-black/8 bg-white/96 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgb(24_32_37/6%)] backdrop-blur-xl" aria-label="Нижняя навигация"><a href="#overview" className="mobile-nav-link"><Landmark /><span>Обзор</span></a><a href="#transactions" className="mobile-nav-link"><CalendarDays /><span>Операции</span></a><button type="button" onClick={() => setOpen(true)} className="mobile-add" aria-label="Добавить операцию"><Plus /></button><a href="#budgets" className="mobile-nav-link"><WalletCards /><span>Бюджет</span></a><a href="#goals" className="mobile-nav-link"><Target /><span>Цель</span></a></nav>
    </main>
  );
}

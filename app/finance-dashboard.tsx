"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Download, LogOut, Plus, Trash2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBrowserSupabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

type Kind = "income" | "expense" | "debt" | "saving";
type Transaction = { id: string; title: string; category: string; kind: Kind; amount: number; date: string };
type LedgerResponse = { transactions: Transaction[] };
type WebTool = { name: string; title?: string; description: string; inputSchema: object; annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }; execute: (input: unknown) => unknown | Promise<unknown> };
type SheetRow = { label: string; kind: Kind };
type SheetSection = { title: string; kind: Kind; rows: string[] };

declare global { interface Document { readonly modelContext?: { registerTool: (tool: WebTool, options?: { signal?: AbortSignal }) => void | Promise<void> } } }

const rubles = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
const numberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const categories = ["Жильё", "Еда", "Транспорт", "Покупки", "Сервисы", "Здоровье", "Долги", "Резерв", "Другое"];
const sheetSections: SheetSection[] = [
  { title: "Доходы", kind: "income", rows: ["Зарплата", "Другие доходы"] },
  { title: "Расходы", kind: "expense", rows: ["Аренда кв", "Коммуналка", "Такси / карш", "Доставка", "Продукты", "Макар", "Ozon", "Тарас", "Лиза", "Подписки", "Здоровье", "Кредит", "Алкоголь"] },
  { title: "Дали в долг", kind: "debt", rows: ["Дали в долг"] },
  { title: "Накопления", kind: "saving", rows: ["Накопления"] },
];
const sheetRows: SheetRow[] = sheetSections.flatMap((section) => section.rows.map((label) => ({ label, kind: section.kind })));

function kindLabel(kind: Kind) { return { income: "Доход", expense: "Расход", debt: "Долг", saving: "Накопление" }[kind]; }

export function FinanceDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const supabase = useMemo(() => getBrowserSupabase(), []);
  useEffect(() => {
    if (!supabase) { void Promise.resolve().then(() => setAuthReady(true)); return; }
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
  return <main className="grid min-h-screen place-items-center bg-[#f5f7f8] px-5 text-[#182025]"><div className="surface w-full max-w-[420px] p-6 text-center"><WalletCards className="mx-auto mb-4 size-10" /><h1 className="text-xl font-semibold">Баланс</h1><p className="mt-2 text-sm text-muted-foreground">Сервис регистрации еще не подключен.</p></div></main>;
}

function AuthScreen() {
  const supabase = getBrowserSupabase()!;
  const [busy, setBusy] = useState(false);
  async function authenticate(mode: "login" | "register", formData: FormData) {
    const email = String(formData.get("email") ?? "").trim(); const password = String(formData.get("password") ?? "");
    if (!email || password.length < 6) { toast.error("Введите email и пароль от 6 символов"); return; }
    setBusy(true);
    try {
      const result = mode === "login" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
      if (result.error) { toast.error(result.error.message === "Invalid login credentials" ? "Неверный email или пароль" : result.error.message); return; }
      if (mode === "register" && !result.data.session) {
        const login = await supabase.auth.signInWithPassword({ email, password });
        if (!login.error && login.data.session) { toast.success("Аккаунт создан, вы вошли в систему"); return; }
        toast.success(login.error?.message.toLowerCase().includes("confirm") ? "Аккаунт создан. Подтвердите email, затем войдите" : "Аккаунт создан. Теперь можно войти");
      }
    } catch { toast.error("Не удалось связаться с сервисом. Попробуйте еще раз"); } finally { setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-[#f5f7f8] px-4 py-8 text-[#182025]"><Toaster position="top-center" /><div className="w-full max-w-[420px]"><div className="mb-7 flex items-center justify-center gap-3"><span className="grid size-11 place-items-center rounded-md bg-[#172229] text-white"><WalletCards /></span><span className="text-2xl font-semibold">Баланс</span></div><div className="surface p-5"><Tabs defaultValue="login"><TabsList className="mb-5 grid h-11 w-full grid-cols-2"><TabsTrigger value="login">Вход</TabsTrigger><TabsTrigger value="register">Регистрация</TabsTrigger></TabsList><TabsContent value="login"><AuthForm busy={busy} submit={(data) => authenticate("login", data)} button="Войти" /></TabsContent><TabsContent value="register"><AuthForm busy={busy} submit={(data) => authenticate("register", data)} button="Создать аккаунт" /></TabsContent></Tabs></div><p className="mt-4 text-center text-xs text-muted-foreground">Ваши операции доступны только после входа.</p></div></main>;
}

function AuthForm({ busy, submit, button }: { busy: boolean; submit: (data: FormData) => void | Promise<void>; button: string }) {
  return <form action={submit} className="grid gap-4"><div className="grid gap-2"><Label htmlFor={`${button}-email`}>Email</Label><Input id={`${button}-email`} name="email" type="email" autoComplete="email" required placeholder="mail@example.com" /></div><div className="grid gap-2"><Label htmlFor={`${button}-password`}>Пароль</Label><Input id={`${button}-password`} name="password" type="password" minLength={6} autoComplete={button === "Войти" ? "current-password" : "new-password"} required placeholder="Минимум 6 символов" /></div><Button type="submit" disabled={busy} className="mt-1 h-12 bg-[#172229]">{busy ? "Подождите..." : button}</Button></form>;
}

function LedgerDashboard({ email, accessToken, onSignOut }: { email: string; accessToken: string; onSignOut: () => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]); const [monthOffset, setMonthOffset] = useState(0); const [loading, setLoading] = useState(true); const [open, setOpen] = useState(false); const [drafts, setDrafts] = useState<Record<string, string>>({});
  const activeDate = useMemo(() => { const today = new Date(); return new Date(today.getFullYear(), today.getMonth() + monthOffset, 1); }, [monthOffset]);
  const monthKey = `${activeDate.getFullYear()}-${String(activeDate.getMonth() + 1).padStart(2, "0")}`; const month = activeDate.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  const monthTransactions = useMemo(() => transactions.filter((item) => item.date.startsWith(monthKey)), [transactions, monthKey]);
  const actualFor = (row: SheetRow) => monthTransactions.filter((item) => item.kind === row.kind && (item.category === row.label || item.title === row.label)).reduce((sum, item) => sum + item.amount, 0);
  const totals = useMemo(() => monthTransactions.reduce((result, item) => { result[item.kind] += item.amount; return result; }, { income: 0, expense: 0, debt: 0, saving: 0 } as Record<Kind, number>), [monthTransactions]);
  const balance = totals.income - totals.expense - totals.debt - totals.saving;
  const dateLabel = activeDate.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  const apiFetch = useCallback((url: string, init: RequestInit = {}) => fetch(url, { ...init, headers: { ...init.headers, authorization: `Bearer ${accessToken}` } }), [accessToken]);
  useEffect(() => { apiFetch("/api/ledger").then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<LedgerResponse>; }).then((data) => setTransactions(data.transactions)).catch(() => toast.error("Данные пока недоступны")).finally(() => setLoading(false)); }, [apiFetch]);
  async function saveCell(row: SheetRow, rawValue: string) {
    const amount = Math.round(Number(rawValue.replace(/\s/g, "").replace(",", ".")) || 0);
    const matches = monthTransactions.filter((item) => item.kind === row.kind && (item.category === row.label || item.title === row.label));
    if (amount === 0 && !matches.length) return;
    if (amount === 0) {
      const responses = await Promise.all(matches.map((item) => apiFetch(`/api/ledger?id=${encodeURIComponent(item.id)}`, { method: "DELETE" })));
      if (responses.some((response) => !response.ok)) { toast.error("Не удалось очистить ячейку"); return; }
      const ids = new Set(matches.map((item) => item.id));
      setTransactions((items) => items.filter((item) => !ids.has(item.id)));
      return;
    }
    const existing = matches[0];
    const payload = { id: existing?.id ?? crypto.randomUUID(), title: row.label, category: row.label, kind: row.kind, amount, date: `${monthKey}-01` };
    const response = await apiFetch("/api/ledger", { method: existing ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) { toast.error("Не удалось сохранить сумму"); return; }
    const data = await response.json() as { transaction: Transaction };
    const duplicateResponses = await Promise.all(matches.slice(1).map((item) => apiFetch(`/api/ledger?id=${encodeURIComponent(item.id)}`, { method: "DELETE" })));
    if (duplicateResponses.some((item) => !item.ok)) { toast.error("Сумма сохранена, но дубли не удалось объединить"); }
    const duplicateIds = new Set(matches.slice(1).map((item) => item.id));
    setTransactions((items) => [data.transaction, ...items.filter((item) => item.id !== existing?.id && !duplicateIds.has(item.id))]);
  }
  async function addTransaction(formData: FormData) {
    const title = String(formData.get("title") ?? "").trim(); const amount = Number(formData.get("amount")); const kind = String(formData.get("kind")) as Kind; const category = String(formData.get("category") ?? title).trim();
    if (!title || !Number.isFinite(amount) || amount <= 0) { toast.error("Заполните название и сумму"); return; }
    const payload = { id: crypto.randomUUID(), title, amount: Math.round(amount), kind, category, date: String(formData.get("date") ?? `${monthKey}-01`) }; const response = await apiFetch("/api/ledger", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) { toast.error("Не удалось сохранить операцию"); return; }
    const data = await response.json() as { transaction: Transaction };
    setTransactions((items) => [data.transaction, ...items]); setOpen(false); toast.success("Операция добавлена");
  }
  async function removeTransaction(id: string) { const response = await apiFetch(`/api/ledger?id=${encodeURIComponent(id)}`, { method: "DELETE" }); if (!response.ok) { toast.error("Не удалось удалить операцию"); return; } setTransactions((items) => items.filter((item) => item.id !== id)); toast.success("Операция удалена"); }
  function exportCsv() { const rows = [["Дата", "Тип", "Статья", "Название", "Сумма"], ...monthTransactions.map((item) => [item.date, kindLabel(item.kind), item.category, item.title, item.amount]), ["", "ИТОГО", "Остаток", "Доходы - расходы - долги - накопления", balance]]; const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })); link.download = `balans-${monthKey}.csv`; link.click(); URL.revokeObjectURL(link.href); toast.success("Таблица выгружена"); }
  useEffect(() => { const context = document.modelContext; if (!context?.registerTool) return; const lifecycle = new AbortController(); void Promise.resolve(context.registerTool({ name: "get_month_summary", title: "Итоги месяца", description: "Возвращает суммы доходов, расходов, долгов, накоплений и остатка.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: () => ({ month: monthKey, ...totals, balance }) }, { signal: lifecycle.signal })).catch(() => undefined); return () => lifecycle.abort(); }, [monthKey, totals, balance]);
  return (
    <main className="ledger-app min-h-screen bg-[#f4f6f5] text-[#182025]"><Toaster position="top-center" />
      <header className="ledger-header"><div className="ledger-header-inner"><div className="flex items-center gap-2"><span className="brand-mark"><WalletCards className="size-5" /></span><span className="text-lg font-semibold">Баланс</span></div><div className="flex items-center gap-1"><span className="hidden text-right text-xs text-muted-foreground min-[420px]:block">{email.split("@")[0]}</span><Button variant="ghost" size="icon" aria-label="Выгрузить таблицу" title="Выгрузить таблицу" onClick={exportCsv}><Download /></Button><Button variant="ghost" size="icon" aria-label="Выйти" title="Выйти" onClick={onSignOut}><LogOut /></Button></div></div></header>
      <div className="ledger-content"><section className="ledger-toolbar"><div><p className="eyebrow">Личный лист расчетов</p><h1>Деньги за месяц</h1></div><div className="month-switcher"><Button variant="ghost" size="icon-sm" aria-label="Предыдущий месяц" onClick={() => setMonthOffset((value) => value - 1)}><ChevronLeft /></Button><span className="capitalize">{month}</span><Button variant="ghost" size="icon-sm" aria-label="Следующий месяц" onClick={() => setMonthOffset((value) => value + 1)}><ChevronRight /></Button></div></section>
        <section className="totals-strip"><div className="total-main"><span>Остаток</span><strong>{rubles.format(balance)}</strong><small>Доходы минус все отчисления</small></div><div className="total-cell income"><span>Доходы</span><strong>{rubles.format(totals.income)}</strong></div><div className="total-cell expense"><span>Расходы</span><strong>{rubles.format(totals.expense)}</strong></div><div className="total-cell debt"><span>Долги</span><strong>{rubles.format(totals.debt)}</strong></div><div className="total-cell saving"><span>Накопления</span><strong>{rubles.format(totals.saving)}</strong></div></section>
        <section className="sheet-wrap"><div className="sheet-title"><div><span className="sheet-kicker">Таблица расходов и доходов</span><h2>Итого за {dateLabel}</h2></div><span className="sheet-date">{loading ? "Загрузка..." : `${monthTransactions.length} операций`}</span></div><div className="sheet-table"><div className="sheet-head"><span>Статья</span><span>Сумма, ₽</span></div>{sheetSections.map((section) => <div key={section.kind} className={`sheet-section section-${section.kind}`}><div className="section-label"><span>{section.title}</span><strong>{rubles.format(totals[section.kind])}</strong></div>{section.rows.map((label) => { const row = { label, kind: section.kind }; const value = actualFor(row); const key = `${row.kind}:${row.label}`; return <div className="sheet-row" key={key}><span className="row-label">{label}</span><div className="row-value"><input className="sheet-input" type="text" inputMode="decimal" aria-label={`${label}, сумма`} value={drafts[key] ?? (value ? numberFormat.format(value) : "")} placeholder="0" onChange={(event) => setDrafts((items) => ({ ...items, [key]: event.target.value }))} onBlur={(event) => { void saveCell(row, event.target.value); setDrafts((items) => { const next = { ...items }; delete next[key]; return next; }); }} /><span className="currency">₽</span></div></div>; })}</div>)}<div className="sheet-grand-total"><span>Итоговый остаток</span><strong>{rubles.format(balance)}</strong></div></div></section>
        <div className="sheet-actions"><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="add-operation"><Plus /> Добавить операцию</Button></DialogTrigger><DialogContent className="max-h-[92dvh] overflow-y-auto"><DialogHeader><DialogTitle>Новая операция</DialogTitle><DialogDescription>Добавьте отдельную запись, если ее нет среди строк листа.</DialogDescription></DialogHeader><form action={addTransaction} className="grid gap-4"><div className="grid gap-2"><Label htmlFor="title">Название</Label><Input id="title" name="title" placeholder="Например, премия" autoFocus /></div><div className="grid gap-2"><Label htmlFor="amount">Сумма, ₽</Label><Input id="amount" name="amount" type="number" min="1" placeholder="0" inputMode="decimal" /></div><div className="grid gap-2"><Label>Тип</Label><Select name="kind" defaultValue="expense"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="income">Доход</SelectItem><SelectItem value="expense">Расход</SelectItem><SelectItem value="debt">Долг</SelectItem><SelectItem value="saving">Накопление</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>Статья</Label><Select name="category" defaultValue="Другое"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="date">Дата</Label><Input id="date" name="date" type="date" defaultValue={`${monthKey}-01`} /></div><DialogFooter><Button type="submit" className="h-11 w-full bg-[#172229]">Сохранить</Button></DialogFooter></form></DialogContent></Dialog><Button variant="outline" className="export-button" onClick={exportCsv}><Download /> CSV</Button></div>
        <section className="recent-sheet"><div className="recent-heading"><div><h2>Операции за месяц</h2><p>Дополнительные записи, которые не вошли в строки листа</p></div></div>{monthTransactions.filter((item) => !sheetRows.some((row) => row.kind === item.kind && (row.label === item.category || row.label === item.title))).length ? <div className="recent-list">{monthTransactions.filter((item) => !sheetRows.some((row) => row.kind === item.kind && (row.label === item.category || row.label === item.title))).map((item) => <div className="recent-row" key={item.id}><span className={`recent-icon recent-${item.kind}`}>{item.kind === "income" ? <ArrowDownLeft /> : <ArrowUpRight />}</span><div><strong>{item.title}</strong><small>{item.category} · {kindLabel(item.kind)}</small></div><b>{item.kind === "income" ? "+" : "−"}{rubles.format(item.amount)}</b><Button variant="ghost" size="icon-sm" aria-label={`Удалить ${item.title}`} onClick={() => void removeTransaction(item.id)}><Trash2 /></Button></div>)}</div> : <p className="empty-recent">Дополнительных операций пока нет</p>}</section>
      </div>
    </main>
  );
}

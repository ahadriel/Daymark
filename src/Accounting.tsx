import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Download, FileText, Plus, Printer, RotateCw, Trash2, Wallet } from 'lucide-react';

type EventKind = 'Daily' | 'Travel' | 'Custom';
type EntryKind = 'income' | 'expense';
type AccountEvent = { id: string; name: string; kind: EventKind; openingBalance: number; startDate: string; description: string; createdAt: string };
type Transaction = { id: string; eventId: string; kind: EntryKind; amount: number; date: string; description: string; category: string; paymentMethod: string; notes: string };
type LedgerData = { events: AccountEvent[]; transactions: Transaction[]; deletedTransactionIds: string[] };
const STORAGE_KEY = 'eonis-accounting-v1';
const today = () => new Date().toISOString().slice(0, 10);
const categories = ['Food', 'Travel', 'Fuel', 'Water', 'Accommodation', 'Shopping', 'Bills', 'Transport', 'Health', 'Entertainment', 'Income', 'Other'];
const emptyData: LedgerData = { events: [], transactions: [], deletedTransactionIds: [] };
function loadLedger(): LedgerData {
  try { const value = localStorage.getItem(STORAGE_KEY); if (!value) return emptyData; const parsed = JSON.parse(value) as LedgerData; return { events: Array.isArray(parsed.events) ? parsed.events : [], transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [], deletedTransactionIds: Array.isArray(parsed.deletedTransactionIds) ? parsed.deletedTransactionIds : [] }; }
  catch { return emptyData; }
}
function mergeLedgers(local: LedgerData, cloud: LedgerData): LedgerData {
  const deletedTransactionIds = Array.from(new Set([...(cloud.deletedTransactionIds ?? []), ...(local.deletedTransactionIds ?? [])]));
  const events = new Map<string, AccountEvent>();
  for (const event of cloud.events ?? []) events.set(event.id, event);
  for (const event of local.events ?? []) events.set(event.id, event);
  const transactions = new Map<string, Transaction>();
  for (const transaction of cloud.transactions ?? []) transactions.set(transaction.id, transaction);
  for (const transaction of local.transactions ?? []) transactions.set(transaction.id, transaction);
  return { events: [...events.values()], transactions: [...transactions.values()].filter((item) => !deletedTransactionIds.includes(item.id)), deletedTransactionIds };
}
function normaliseLedger(value: unknown): LedgerData {
  if (!value || typeof value !== 'object') return emptyData;
  const candidate = value as Partial<LedgerData>;
  return { events: Array.isArray(candidate.events) ? candidate.events : [], transactions: Array.isArray(candidate.transactions) ? candidate.transactions : [], deletedTransactionIds: Array.isArray(candidate.deletedTransactionIds) ? candidate.deletedTransactionIds : [] };
}
function money(value: number) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value); }
function id() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function escapeCsv(value: unknown) { const text = String(value ?? ''); return `"${text.replace(/"/g, '""')}"`; }

export default function Accounting() {
  const [ledger, setLedger] = useState<LedgerData>(() => loadLedger());
  const [session, setSession] = useState<Session | null>(null);
  const [cloudState, setCloudState] = useState<'offline' | 'signed-out' | 'syncing' | 'synced' | 'error'>(supabase ? 'signed-out' : 'offline');
  const [lastSyncedAt, setLastSyncedAt] = useState('');
  const [syncBusy, setSyncBusy] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [showNewTransaction, setShowNewTransaction] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventKind, setEventKind] = useState<EventKind>('Travel');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [eventDate, setEventDate] = useState(today());
  const [eventDescription, setEventDescription] = useState('');
  const [entryKind, setEntryKind] = useState<EntryKind>('expense');
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(today());
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food');
  const [customCategory, setCustomCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [statementStart, setStatementStart] = useState('');
  const [statementEnd, setStatementEnd] = useState('');
  const [statementMode, setStatementMode] = useState(false);
  const [notice, setNotice] = useState('');
  const saveLocal = useCallback((next: LedgerData) => {
    setLedger(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { setNotice('Could not save accounting data on this device. Check available storage.'); }
  }, []);
  const syncToCloud = useCallback(async (snapshot?: LedgerData) => {
    if (!supabase) { setCloudState('offline'); return; }
    const { data: auth } = await supabase.auth.getSession();
    const activeSession = auth.session;
    if (!activeSession) { setCloudState('signed-out'); return; }
    setCloudState('syncing');
    setSyncBusy(true);
    try {
      const local = snapshot ?? loadLedger();
      const { data: remoteRow, error: readError } = await supabase.from('accounting_ledgers').select('data, updated_at').eq('user_id', activeSession.user.id).maybeSingle();
      if (readError) throw readError;
      const cloud = normaliseLedger(remoteRow?.data);
      const merged = mergeLedgers(local, cloud);
      const payload = { user_id: activeSession.user.id, data: merged, updated_at: new Date().toISOString() };
      const { error: writeError } = await supabase.from('accounting_ledgers').upsert(payload, { onConflict: 'user_id' });
      if (writeError) throw writeError;
      saveLocal(merged);
      setLastSyncedAt(new Date().toISOString());
      setCloudState('synced');
    } catch (error) {
      console.error('EONIS Accounting cloud sync failed', error);
      setCloudState('error');
      setNotice('Cloud sync failed. Your changes are still saved locally; tap Sync now to retry.');
    } finally { setSyncBusy(false); }
  }, [saveLocal]);
  const persist = (next: LedgerData) => {
    const normalised = normaliseLedger(next);
    saveLocal(normalised);
    if (session && supabase) void syncToCloud(normalised);
  };
  useEffect(() => {
    if (!supabase) { setCloudState('offline'); return; }
    let active = true;
    void supabase.auth.getSession().then(async ({ data: auth }) => {
      if (!active) return;
      setSession(auth.session);
      if (!auth.session) { setCloudState('signed-out'); return; }
      await syncToCloud(loadLedger());
    }).catch(() => { if (active) setCloudState('error'); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) { setCloudState('signed-out'); return; }
      // Defer Supabase calls until after the auth callback completes.
      window.setTimeout(() => { if (active) void syncToCloud(loadLedger()); }, 0);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [syncToCloud]);
  const selected = ledger.events.find((event) => event.id === selectedId) ?? ledger.events[0];
  const eventTransactions = useMemo(() => selected ? ledger.transactions.filter((transaction) => transaction.eventId === selected.id).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)) : [], [ledger.transactions, selected]);
  const filteredTransactions = useMemo(() => eventTransactions.filter((transaction) => (!statementStart || transaction.date >= statementStart) && (!statementEnd || transaction.date <= statementEnd)), [eventTransactions, statementStart, statementEnd]);
  const closingBalance = (items: Transaction[], opening: number) => opening + items.reduce((total, item) => total + (item.kind === 'income' ? item.amount : -item.amount), 0);
  const balance = selected ? closingBalance(eventTransactions, selected.openingBalance) : 0;
  const statementOpening = selected ? selected.openingBalance + eventTransactions.filter((t) => statementStart && t.date < statementStart).reduce((sum, t) => sum + (t.kind === 'income' ? t.amount : -t.amount), 0) : 0;
  const statementClosing = closingBalance(filteredTransactions, statementOpening);
  const totalIncome = eventTransactions.filter((t) => t.kind === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = eventTransactions.filter((t) => t.kind === 'expense').reduce((sum, t) => sum + t.amount, 0);

  function createEvent(event: FormEvent) {
    event.preventDefault();
    if (!eventName.trim() || !Number.isFinite(Number(openingBalance)) || Number(openingBalance) < 0) return;
    const nextEvent: AccountEvent = { id: id(), name: eventName.trim(), kind: eventKind, openingBalance: Number(openingBalance), startDate: eventDate || today(), description: eventDescription.trim(), createdAt: new Date().toISOString() };
    persist({ ...ledger, events: [nextEvent, ...ledger.events] }); setSelectedId(nextEvent.id); setShowNewEvent(false); setEventName(''); setOpeningBalance('0'); setEventDescription(''); setNotice('Accounting event created.');
  }
  function createTransaction(event: FormEvent) {
    event.preventDefault();
    if (!selected || !description.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return;
    const next: Transaction = { id: id(), eventId: selected.id, kind: entryKind, amount: Number(amount), date: entryDate || today(), description: description.trim(), category: category === 'Other' && customCategory.trim() ? customCategory.trim() : category, paymentMethod, notes: notes.trim() };
    persist({ ...ledger, transactions: [...ledger.transactions, next] }); setShowNewTransaction(false); setAmount(''); setDescription(''); setNotes(''); setCustomCategory(''); setNotice('Transaction saved.');
  }
  function deleteTransaction(transactionId: string) {
    if (!window.confirm('Delete this transaction? The running and closing balances will be recalculated.')) return;
    persist({ ...ledger, transactions: ledger.transactions.filter((transaction) => transaction.id !== transactionId), deletedTransactionIds: Array.from(new Set([...ledger.deletedTransactionIds, transactionId])) }); setNotice('Transaction deleted.');
  }
  function exportStatement() {
    if (!selected) return;
    const rows = [
      ['EONIS ACCOUNTING STATEMENT'], ['Event', selected.name], ['Type', selected.kind], ['Period', `${statementStart || 'Beginning'} to ${statementEnd || 'Present'}`],
      ['Opening balance', statementOpening.toFixed(2)], [], ['Date', 'Description', 'Category', 'Payment method', 'Debit', 'Credit', 'Balance', 'Notes']
    ];
    let running = statementOpening;
    for (const transaction of filteredTransactions) {
      running += transaction.kind === 'income' ? transaction.amount : -transaction.amount;
      rows.push([transaction.date, transaction.description, transaction.category, transaction.paymentMethod, transaction.kind === 'expense' ? transaction.amount.toFixed(2) : '', transaction.kind === 'income' ? transaction.amount.toFixed(2) : '', running.toFixed(2), transaction.notes]);
    }
    rows.push([], ['Total debits', filteredTransactions.filter((t) => t.kind === 'expense').reduce((sum, t) => sum + t.amount, 0).toFixed(2)], ['Total credits', filteredTransactions.filter((t) => t.kind === 'income').reduce((sum, t) => sum + t.amount, 0).toFixed(2)], ['Closing balance', statementClosing.toFixed(2)]);
    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `EONIS-${selected.name.replace(/[^a-z0-9-_]+/gi, '-')}-statement.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <div className="accounting-suite">
    <div className="accounting-heading"><div><span className="overline">MONEY, ACCOUNTED FOR</span><h1>Accounting</h1><p>Every rupee tracked. Every event balanced. Your own personal ledger.</p><div className={`accounting-sync-status ${cloudState}`}><span className="accounting-sync-dot" />{cloudState === 'offline' ? 'Local-only mode · cloud not configured' : cloudState === 'signed-out' ? 'Saved on this device · sign in to sync' : cloudState === 'syncing' ? 'Syncing all ledgers and transactions…' : cloudState === 'synced' ? `Cloud synced${lastSyncedAt ? ' · ' + new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}` : 'Cloud sync needs attention'}</div></div><div className="accounting-heading-actions"><button className="button-soft" onClick={() => void syncToCloud()} disabled={syncBusy || !session || !supabase}><RotateCw size={15} className={syncBusy ? 'accounting-spin' : ''} /> {syncBusy ? 'Syncing…' : 'Sync now'}</button><button className="primary-action" onClick={() => setShowNewEvent(true)}><Plus size={16} /> New event</button></div></div>
    {notice && <div className="accounting-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notice">×</button></div>}
    <div className="accounting-type-row">{(['Daily', 'Travel', 'Custom'] as EventKind[]).map((kind) => <button key={kind} className={eventKind === kind ? 'accounting-type active' : 'accounting-type'} onClick={() => { setEventKind(kind); setShowNewEvent(true); }}><span>{kind === 'Daily' ? '◷' : kind === 'Travel' ? '↗' : '✳'}</span><b>{kind}</b><small>{kind === 'Daily' ? 'Everyday money' : kind === 'Travel' ? 'Trips & journeys' : 'Anything you define'}</small></button>)}</div>
    <div className="accounting-layout">
      <aside className="accounting-events panel"><div className="panel-heading"><div><span className="overline">YOUR LEDGERS</span><h2>Events</h2></div><button className="icon-button" onClick={() => setShowNewEvent(true)} aria-label="Create event"><Plus size={17} /></button></div>
        {ledger.events.length === 0 ? <div className="accounting-empty"><Wallet size={24} /><b>No events yet</b><p>Create a Daily, Travel, or Custom ledger to get started.</p><button className="button-soft" onClick={() => setShowNewEvent(true)}>Create first event</button></div> : <div className="accounting-event-list">{ledger.events.map((event) => <button key={event.id} className={selected?.id === event.id ? 'accounting-event selected' : 'accounting-event'} onClick={() => { setSelectedId(event.id); setStatementMode(false); }}><span className="accounting-event-kind">{event.kind}</span><b>{event.name}</b><small>{event.startDate}</small><strong>{money(closingBalance(ledger.transactions.filter((t) => t.eventId === event.id), event.openingBalance))}</strong></button>)}</div>}
      </aside>
      <section className="accounting-main">
        {selected ? <>
          <div className="accounting-balance-card"><div><span className="overline">{selected.kind.toUpperCase()} EVENT</span><h2>{selected.name}</h2><p>{selected.description || 'Ledger opened ' + selected.startDate}</p></div><div className="accounting-balance-value"><small>Current balance</small><strong>{money(balance)}</strong></div><div className="accounting-mini-stats"><div><span>Opening balance</span><b>{money(selected.openingBalance)}</b></div><div><span>Total income</span><b className="accounting-positive">{money(totalIncome)}</b></div><div><span>Total expenses</span><b className="accounting-negative">{money(totalExpenses)}</b></div></div></div>
          <div className="accounting-actions"><button className="primary-action" onClick={() => setShowNewTransaction(true)}><Plus size={16} /> Add transaction</button><button className={statementMode ? 'button-soft active' : 'button-soft'} onClick={() => setStatementMode(!statementMode)}><FileText size={16} /> {statementMode ? 'Hide statement tools' : 'Custom statement'}</button></div>
          {statementMode && <section className="panel accounting-statement-tools"><div><span className="overline">STATEMENT BUILDER</span><h2>Choose your period</h2><p>Leave either date blank to include the full ledger history.</p></div><div className="accounting-date-filters"><label>From<input type="date" value={statementStart} onChange={(e) => setStatementStart(e.target.value)} /></label><label>To<input type="date" value={statementEnd} onChange={(e) => setStatementEnd(e.target.value)} /></label><button className="primary-action" onClick={exportStatement}><Download size={15} /> Export CSV</button><button className="button-soft" onClick={() => window.print()}><Printer size={15} /> Print statement</button></div></section>}
          <section className="panel accounting-transactions"><div className="panel-heading"><div><span className="overline">{statementMode ? 'STATEMENT ENTRIES' : 'LEDGER'}</span><h2>{statementMode ? 'Transactions in period' : 'Transactions'}</h2></div><span className="accounting-count">{(statementMode ? filteredTransactions : eventTransactions).length} entries</span></div>
            {(statementMode ? filteredTransactions : eventTransactions).length === 0 ? <div className="accounting-empty"><CalendarDays size={23} /><b>No transactions in this period</b><p>Add your first transaction or adjust the statement dates.</p></div> : <div className="accounting-table-wrap"><table className="accounting-table"><thead><tr><th>Date</th><th>Details</th><th>Category</th><th>Debit</th><th>Credit</th><th>Balance</th><th></th></tr></thead><tbody>{(statementMode ? filteredTransactions : eventTransactions).reduce<Array<{ transaction: Transaction; running: number }>>((acc, transaction) => { const previous = acc.length ? acc[acc.length - 1].running : (statementMode ? statementOpening : selected.openingBalance); acc.push({ transaction, running: previous + (transaction.kind === 'income' ? transaction.amount : -transaction.amount) }); return acc; }, []).map(({ transaction, running }) => <tr key={transaction.id}><td>{transaction.date}</td><td><b>{transaction.description}</b><small>{transaction.paymentMethod}{transaction.notes ? ' · ' + transaction.notes : ''}</small></td><td><span className="accounting-category">{transaction.category}</span></td><td className="accounting-negative">{transaction.kind === 'expense' ? money(transaction.amount) : '—'}</td><td className="accounting-positive">{transaction.kind === 'income' ? money(transaction.amount) : '—'}</td><td><b>{money(running)}</b></td><td><button className="icon-button accounting-delete" onClick={() => deleteTransaction(transaction.id)} aria-label={`Delete ${transaction.description}`} title="Delete transaction"><Trash2 size={15} /></button></td></tr>)}</tbody></table></div>}
            <div className="accounting-table-footer"><span>Opening balance <b>{money(statementMode ? statementOpening : selected.openingBalance)}</b></span><span>Closing balance <b>{money(statementMode ? statementClosing : balance)}</b></span></div>
          </section>
        </> : <div className="panel accounting-empty accounting-no-selection"><Wallet size={34} /><h2>Start your first ledger</h2><p>Create an event and enter its starting balance. EONIS will keep the running balance for every transaction.</p><button className="primary-action" onClick={() => setShowNewEvent(true)}><Plus size={16} /> Create event</button></div>}
      </section>
    </div>
    {showNewEvent && <div className="accounting-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowNewEvent(false); }}><section className="accounting-modal panel" role="dialog" aria-modal="true" aria-labelledby="accounting-event-title"><div className="panel-heading"><div><span className="overline">NEW LEDGER</span><h2 id="accounting-event-title">Create accounting event</h2></div><button className="icon-button" onClick={() => setShowNewEvent(false)} aria-label="Close">×</button></div><form onSubmit={createEvent}><label>Event name<input required autoFocus value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder={eventKind === 'Daily' ? 'Everyday expenses' : eventKind === 'Travel' ? 'Goa trip 2026' : 'New project'} /></label><label>Event type<select value={eventKind} onChange={(e) => setEventKind(e.target.value as EventKind)}><option>Daily</option><option>Travel</option><option>Custom</option></select></label><label>Starting balance (₹)<input required type="number" min="0" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} /></label><label>Start date<input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></label><label>Description (optional)<textarea rows={2} value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} placeholder="What is this ledger for?" /></label><div className="accounting-modal-actions"><button type="button" className="button-soft" onClick={() => setShowNewEvent(false)}>Cancel</button><button type="submit" className="primary-action"><Plus size={15} /> Create event</button></div></form></section></div>}
    {showNewTransaction && selected && <div className="accounting-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowNewTransaction(false); }}><section className="accounting-modal panel" role="dialog" aria-modal="true" aria-labelledby="accounting-transaction-title"><div className="panel-heading"><div><span className="overline">{selected.name.toUpperCase()}</span><h2 id="accounting-transaction-title">Add transaction</h2></div><button className="icon-button" onClick={() => setShowNewTransaction(false)} aria-label="Close">×</button></div><form onSubmit={createTransaction}><div className="accounting-kind-toggle"><button type="button" className={entryKind === 'expense' ? 'expense active' : 'expense'} onClick={() => setEntryKind('expense')}><ArrowUpRight size={16} /> Expense</button><button type="button" className={entryKind === 'income' ? 'income active' : 'income'} onClick={() => setEntryKind('income')}><ArrowDownLeft size={16} /> Income</button></div><label>Amount (₹)<input required autoFocus type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label><label>Description<input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Lunch with friends" /></label><div className="accounting-form-grid"><label>Date<input required type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} /></label><label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label></div>{category === 'Other' && <label>Custom category<input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="e.g. Souvenirs" /></label>}<label>Payment method<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option>Cash</option><option>UPI</option><option>Debit card</option><option>Credit card</option><option>Bank transfer</option><option>Other</option></select></label><label>Notes (optional)<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Receipt, people, or extra details" /></label><div className="accounting-modal-actions"><button type="button" className="button-soft" onClick={() => setShowNewTransaction(false)}>Cancel</button><button type="submit" className="primary-action"><Plus size={15} /> Save transaction</button></div></form></section></div>}
  </div>;
}

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Activity, ArrowRight, BarChart3, CalendarDays, Check, CheckCheck, ChevronRight, Circle, Clock3, Cloud, Command, Download, Flag, HardDrive, Home, ListTodo, LogOut, Menu, Moon, Pause, Play, Plus, Search, Settings, SlidersHorizontal, Palette, MonitorCog, Sparkles, StickyNote, Sun, Trash2, Upload, WandSparkles, X } from 'lucide-react';
import { createTask, mergeRecords, newId, type CalendarEvent, type DaymarkData, type DayNote, type Task, type TaskPriority } from './core/model';
import { planMyDay, suggestTask } from './core/planner';
import { parseQuickCapture } from './core/quick-capture';
import { readData, writeData } from './data/local-store';
import { fromTaskRow, supabase, toTaskRow } from './lib/supabase';

type View = 'Today' | 'Tasks' | 'Calendar' | 'Timeline' | 'Planner' | 'Notes' | 'Insights' | 'Settings';
type TaskFilter = 'all' | 'open' | 'completed' | 'today' | 'upcoming' | 'overdue' | 'high' | 'unscheduled';
const nav: Array<{ label: View; icon: typeof Home }> = [
  { label: 'Today', icon: Home }, { label: 'Tasks', icon: ListTodo }, { label: 'Calendar', icon: CalendarDays }, { label: 'Timeline', icon: Clock3 },
  { label: 'Planner', icon: WandSparkles }, { label: 'Notes', icon: StickyNote }, { label: 'Insights', icon: BarChart3 }, { label: 'Settings', icon: Settings },
];
const filters: Array<{ label: string; value: TaskFilter }> = [
  { label: 'All tasks', value: 'all' }, { label: 'Open', value: 'open' }, { label: 'Completed', value: 'completed' }, { label: 'Today', value: 'today' },
  { label: 'Upcoming', value: 'upcoming' }, { label: 'Overdue', value: 'overdue' }, { label: 'High priority', value: 'high' }, { label: 'No due date', value: 'unscheduled' },
];
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function dayLabel(value: string | Date, options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) { return new Intl.DateTimeFormat(undefined, options).format(typeof value === 'string' ? new Date(value) : value); }
function timeLabel(value: string | Date) { return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(typeof value === 'string' ? new Date(value) : value); }
function active(tasks: Task[]) { return tasks.filter((task) => !task.deletedAt); }
function makeEvent(title: string, startsAt: Date): CalendarEvent {
  const endsAt = new Date(startsAt.getTime() + 60 * 60_000); const now = new Date().toISOString();
  return { id: newId(), title, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), source: 'daymark', externalId: null, location: '', notes: '', createdAt: now, updatedAt: now, deletedAt: null, revision: 1 };
}

function App() {
  const [data, setData] = useState<DaymarkData>(() => readData());
  const dataRef = useRef(data);
  const [view, setView] = useState<View>('Today');
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [query, setQuery] = useState('');
  const [capture, setCapture] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [status, setStatus] = useState('');
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [focusRunning, setFocusRunning] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const tasks = active(data.tasks);
  const openTasks = tasks.filter((task) => task.status === 'open');
  const completedTasks = tasks.filter((task) => task.status === 'completed');
  const today = new Date();
  const overdueTasks = openTasks.filter((task) => task.dueAt && new Date(task.dueAt) < today);
  const todayTasks = openTasks.filter((task) => !task.dueAt || new Date(task.dueAt) <= today || sameDay(new Date(task.dueAt), today));
  const chosenFocusTask = tasks.find((task) => task.id === focusTaskId);

  function updateData(change: (current: DaymarkData) => DaymarkData) {
    const next = change(dataRef.current); dataRef.current = next; setData(next); writeData(next); return next;
  }
  function commitTask(task: Task) {
    const updated = { ...task, updatedAt: new Date().toISOString(), revision: task.revision + 1 };
    updateData((current) => ({ ...current, tasks: mergeRecords(current.tasks, [updated]) }));
    if (session && supabase) void supabase.from('tasks').upsert(toTaskRow(updated, session.user.id)).then(({ error }) => { if (error) setStatus(`Saved on this device. Cloud sync will retry: ${error.message}`); });
  }

  useEffect(() => { document.documentElement.dataset.theme = data.preferences.theme; document.documentElement.dataset.density = data.preferences.density; document.documentElement.style.setProperty('--accent', data.preferences.accent); }, [data.preferences]);
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data: result }) => setSession(result.session));
    const { data: auth } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => auth.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!supabase || !session) return;
    const client = supabase;
    let stopped = false;
    const channel = client.channel(`daymark-tasks-${session.user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${session.user.id}` }, (payload) => {
      if (payload.eventType === 'DELETE') return;
      const incoming = fromTaskRow(payload.new as Record<string, unknown>);
      updateData((current) => ({ ...current, tasks: mergeRecords(current.tasks, [incoming]) }));
    }).subscribe();
    void (async () => {
      const { data: rows, error } = await client.from('tasks').select('*').eq('user_id', session.user.id);
      if (stopped) return;
      if (error) { setStatus(`Signed in. Cloud sync needs attention: ${error.message}`); return; }
      const remote = (rows ?? []).map((row) => fromTaskRow(row as Record<string, unknown>));
      const merged = mergeRecords(dataRef.current.tasks, remote);
      updateData((current) => ({ ...current, tasks: merged }));
      const remoteById = new Map(remote.map((task) => [task.id, task]));
      const localWins = merged.filter((task) => !remoteById.has(task.id) || task.updatedAt > remoteById.get(task.id)!.updatedAt);
      if (localWins.length) {
        const { error: saveError } = await client.from('tasks').upsert(localWins.map((task) => toTaskRow(task, session.user.id)));
        if (saveError) setStatus(`Signed in. Some tasks could not sync: ${saveError.message}`);
      }
      if (!stopped) setStatus('Tasks synced with Supabase.');
    })();
    return () => { stopped = true; void client.removeChannel(channel); };
  }, [session?.user.id]);
  useEffect(() => {
    if (!focusRunning) return;
    const timer = window.setInterval(() => setFocusSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [focusRunning]);
  useEffect(() => {
    const onKeys = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(true); }
      if (event.key === 'Escape') { setCommandOpen(false); setMobileNav(false); setFocusRunning(false); }
    };
    window.addEventListener('keydown', onKeys); return () => window.removeEventListener('keydown', onKeys);
  }, []);

  const visibleTasks = useMemo(() => {
    let list = [...tasks];
    switch (filter) {
      case 'open': list = list.filter((task) => task.status === 'open'); break;
      case 'completed': list = list.filter((task) => task.status === 'completed'); break;
      case 'today': list = list.filter((task) => task.dueAt && sameDay(new Date(task.dueAt), today)); break;
      case 'upcoming': list = list.filter((task) => task.dueAt && new Date(task.dueAt) > today); break;
      case 'overdue': list = list.filter((task) => task.status === 'open' && task.dueAt && new Date(task.dueAt) < new Date()); break;
      case 'high': list = list.filter((task) => task.priority === 'high' || task.priority === 'urgent'); break;
      case 'unscheduled': list = list.filter((task) => !task.dueAt); break;
    }
    if (query.trim()) list = list.filter((task) => `${task.title} ${task.details} ${task.category} ${task.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
    return list.sort((a, b) => a.status === b.status ? (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') : a.status === 'open' ? -1 : 1);
  }, [tasks, filter, query]);
  const setPreference = <K extends keyof DaymarkData['preferences']>(key: K, value: DaymarkData['preferences'][K]) => updateData((current) => ({ ...current, preferences: { ...current.preferences, [key]: value } }));
  function addTask() {
    const parsed = parseQuickCapture(capture); if (!parsed.title) return;
    const task = createTask(parsed.title, parsed.dueAt);
    updateData((current) => ({ ...current, tasks: [task, ...current.tasks] }));
    if (session && supabase) void supabase.from('tasks').upsert(toTaskRow(task, session.user.id));
    setCapture(''); setStatus('Task added.');
  }
  function toggleTask(task: Task) { const done = task.status !== 'completed'; commitTask({ ...task, status: done ? 'completed' : 'open', completedAt: done ? new Date().toISOString() : null }); }
  function changePriority(task: Task, priority: TaskPriority) { commitTask({ ...task, priority }); }
  function deleteTask(task: Task) { commitTask({ ...task, deletedAt: new Date().toISOString() }); }
  function rescheduleOverdue(days: 0 | 1) { for (const task of overdueTasks) { const due = new Date(); due.setDate(due.getDate() + days); due.setHours(17, 0, 0, 0); commitTask({ ...task, dueAt: due.toISOString() }); } setStatus(days === 0 ? "Overdue tasks moved to today." : "Overdue tasks moved to tomorrow."); }
  function go(next: View) { setView(next); setMobileNav(false); setCommandOpen(false); }
  function addCalendarEvent() {
    const title = window.prompt('Event name'); if (!title?.trim()) return;
    const start = new Date(); start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30, 0, 0);
    const event = makeEvent(title.trim(), start); updateData((current) => ({ ...current, events: [event, ...current.events] }));
  }
  function addNote() {
    const title = window.prompt('Note title'); if (!title?.trim()) return;
    const now = new Date().toISOString();
    const note: DayNote = { id: newId(), title: title.trim(), body: '', day: now.slice(0, 10), createdAt: now, updatedAt: now, deletedAt: null, revision: 1 };
    updateData((current) => ({ ...current, notes: [note, ...current.notes] }));
  }
  async function submitAuth(event: FormEvent) {
    event.preventDefault(); if (!supabase) return; setStatus('Connecting…');
    const result = authMode === 'sign-up' ? await supabase.auth.signUp({ email: authEmail, password: authPassword }) : await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    setStatus(result.error ? result.error.message : authMode === 'sign-up' ? 'Account created. Check your email if confirmation is enabled.' : 'Signed in. Syncing tasks…');
  }
  function exportData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `daymark-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
  }
  async function importData(file?: File) {
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text()) as DaymarkData;
      if (imported.schemaVersion !== 1 || !Array.isArray(imported.tasks)) throw new Error('This is not a Daymark backup.');
      if (!window.confirm('Import this backup and replace the data on this device?')) return;
      updateData(() => imported); setStatus('Backup restored on this device.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not read that backup.'); }
  }
  function runCommand() {
    const command = commandQuery.toLowerCase(); const target = nav.find((item) => command.includes(item.label.toLowerCase()));
    if (target) { go(target.label); return; }
    if (command.includes('overdue')) { setFilter('overdue'); go('Tasks'); return; }
    if (command.includes('dark')) { setPreference('theme', data.preferences.theme === 'dark' ? 'light' : 'dark'); setCommandOpen(false); return; }
    if (command.includes('add task')) { setCommandOpen(false); document.getElementById('quick-capture')?.focus(); return; }
    setQuery(commandQuery); go('Tasks');
  }
  function startFocus(task: Task) { setFocusTaskId(task.id); setFocusSeconds(25 * 60); setFocusRunning(true); }

  const plan = planMyDay(openTasks, data.events);
  const recommendation = suggestTask(openTasks);
  const percent = tasks.length ? Math.round(completedTasks.length / tasks.length * 100) : 0;
  const focusClock = `${String(Math.floor(focusSeconds / 60)).padStart(2, '0')}:${String(focusSeconds % 60).padStart(2, '0')}`;

  return <div className="app-frame">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-symbol" aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false"><circle cx="16" cy="11" r="4.5" /><path d="M5 19.5h22M8 25l6-6 3.5 3.5L25 14" /></svg></div><div><b>daymark</b><span>MAKE ROOM FOR WHAT MATTERS</span></div><button className="icon-button mobile-only" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18} /></button></div>
      <div className="workspace-label">WORKSPACE <span>LOCAL FIRST</span></div>
      <nav className="main-nav" aria-label="Main navigation">{nav.map(({ label, icon: Icon }) => <button key={label} className={`nav-link ${view === label ? 'selected' : ''}`} onClick={() => go(label)}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{label === 'Tasks' && <small>{openTasks.length}</small>}</button>)}</nav>
      <div className="sidebar-nudge"><Sparkles size={16} /><span className="eyebrow">A small reminder</span><p>Progress is a practice, not a performance.</p></div>
      <div className="sidebar-bottom"><span className={`connection-dot ${session ? 'connected' : ''}`} />{session ? 'Synced with Supabase' : 'Saved on this device'}<button className="icon-button theme-button" onClick={() => setPreference('theme', data.preferences.theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">{data.preferences.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button></div>
    </aside>
    {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    <main className="main-area">
      <header className="topbar"><button className="icon-button mobile-only" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={19} /></button><div className="crumb"><span>Daymark</span><ChevronRight size={14} /><b>{view}</b></div><div className="top-actions"><div className="top-date">{dayLabel(today, { weekday: 'long', month: 'long', day: 'numeric' })}</div><button className="search-trigger" onClick={() => setCommandOpen(true)}><Search size={15} /><span>Search Daymark</span><kbd><Command size={10} /> K</kbd></button><button className="profile-chip" onClick={() => go('Settings')} title="Account settings">{session?.user.email?.slice(0, 1).toUpperCase() ?? 'S'}</button></div></header>
      <div className="page-content">
        {view === 'Today' && <>
          <section className="welcome-row"><div><span className="overline">{dayLabel(today, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span><h1>A clearer day<br /><em>starts here.</em></h1><p>Choose what matters. Make a little room to do it.</p></div><div className="progress-card"><div className="progress-top"><span>Today’s progress</span><Activity size={17} /></div><div className="progress-number">{percent}<small>%</small></div><div className="progress-track"><span style={{ width: `${percent}%` }} /></div><div className="progress-caption"><span>{completedTasks.length} finished</span><span>{openTasks.length} to go</span></div></div></section>
          <div className="quick-capture"><div className="capture-plus"><Plus size={18} /></div><input id="quick-capture" value={capture} onChange={(event) => setCapture(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addTask(); }} placeholder="Add a task — try ‘Read chapter tomorrow at 5pm’" /><button onClick={addTask} disabled={!capture.trim()}>Add task <span>↵</span></button></div>
          <section className="two-column dashboard-grid"><div className="panel task-panel"><div className="panel-heading"><div><span className="overline">YOUR DAY</span><h2>On your mind</h2></div><button className="text-link" onClick={() => go('Tasks')}>All tasks <ArrowRight size={14} /></button></div>{todayTasks.length ? <TaskList items={todayTasks.slice(0, 6)} onToggle={toggleTask} onDelete={deleteTask} onFocus={startFocus} onPriority={changePriority} /> : <Empty title="A little breathing room." text="Capture a task when something needs your attention." />}</div><div className="side-stack"><div className="panel nudge-panel"><div className="panel-heading"><div><span className="overline">ONE GOOD NEXT STEP</span><h2>What now?</h2></div><span className="spark-icon"><Sparkles size={16} /></span></div>{recommendation ? <><p className="recommendation-title">{recommendation.title}</p><div className="task-meta"><PriorityPill priority={recommendation.priority} />{recommendation.dueAt && <span>{dayLabel(recommendation.dueAt)}</span>}</div><button className="primary-action" onClick={() => startFocus(recommendation)}>Start a focus session <ArrowRight size={15} /></button></> : <p className="muted-copy">You’re all caught up. Take a breath or add something for later.</p>}</div><div className="mini-stats"><div><span className="stat-icon"><CheckCheck size={17} /></span><b>{completedTasks.length}</b><small>done</small></div><div><span className="stat-icon warm"><Flag size={17} /></span><b>{openTasks.filter((task) => task.priority === 'high' || task.priority === 'urgent').length}</b><small>important</small></div><div><span className="stat-icon cool"><CalendarDays size={17} /></span><b>{data.events.filter((event) => sameDay(new Date(event.startsAt), today)).length}</b><small>events</small></div></div></div></section>
        </>}

        {view === 'Tasks' && <PageHeading eyebrow="THE WHOLE PICTURE" title="Tasks" text="Keep the next step easy to find." action={<button className="button-soft" onClick={() => document.getElementById('quick-capture')?.focus()}><Plus size={16} /> Quick add</button>}><div className="quick-capture compact-capture"><div className="capture-plus"><Plus size={17} /></div><input id="quick-capture" value={capture} onChange={(event) => setCapture(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addTask(); }} placeholder="What do you need to do?" /><button onClick={addTask} disabled={!capture.trim()}>Add <span>↵</span></button></div>{overdueTasks.length > 0 && <div className="rescue-banner"><div><b>{overdueTasks.length} past due</b><small>Choose an easy reset.</small></div><button onClick={() => rescheduleOverdue(0)}>Today</button><button onClick={() => rescheduleOverdue(1)}>Tomorrow</button><button onClick={() => setFilter('overdue')}>Review</button></div>}<div className="task-toolbar"><div className="filter-chips">{filters.map(({ label, value }) => <button key={value} className={filter === value ? 'chip-active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div><label className="inline-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter tasks" /></label></div><div className="panel task-panel full-task-panel">{visibleTasks.length ? <TaskList items={visibleTasks} onToggle={toggleTask} onDelete={deleteTask} onFocus={startFocus} onPriority={changePriority} /> : <Empty title="Nothing in this view yet." text="Try another filter or add a task above." />}</div></PageHeading>}

        {view === 'Calendar' && <PageHeading eyebrow="MAKE SPACE FOR IT" title="Calendar" text="Your Daymark tasks and planned events, together." action={<button className="button-soft" onClick={addCalendarEvent}><Plus size={16} /> Add event</button>}><div className="week-strip">{Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + index); const count = tasks.filter((task) => task.dueAt && sameDay(new Date(task.dueAt), date)).length + data.events.filter((event) => sameDay(new Date(event.startsAt), date)).length; return <div key={index} className={`week-day ${sameDay(date, today) ? 'is-today' : ''}`}><span>{dayLabel(date, { weekday: 'short' })}</span><b>{date.getDate()}</b><i>{count || '·'}</i></div>; })}</div><div className="panel calendar-agenda"><div className="panel-heading"><div><span className="overline">THIS WEEK</span><h2>Upcoming</h2></div></div>{[...tasks.filter((task) => task.dueAt), ...data.events].sort((a, b) => new Date('dueAt' in a ? a.dueAt! : a.startsAt).getTime() - new Date('dueAt' in b ? b.dueAt! : b.startsAt).getTime()).slice(0, 12).map((item) => 'startsAt' in item ? <div className="agenda-row" key={item.id}><span className="agenda-date">{dayLabel(item.startsAt, { weekday: 'short', day: 'numeric' })}<small>{timeLabel(item.startsAt)}</small></span><span className="agenda-marker event-marker" /><div><b>{item.title}</b><small>{item.source === 'google' ? 'Google Calendar' : 'Daymark event'}</small></div><button className="icon-button" onClick={() => updateData((current) => ({ ...current, events: current.events.filter((event) => event.id !== item.id) }))} aria-label={`Remove ${item.title}`}><Trash2 size={15} /></button></div> : <div className={`agenda-row ${item.status === 'completed' ? 'is-complete' : ''}`} key={item.id}><span className="agenda-date">{dayLabel(item.dueAt!, { weekday: 'short', day: 'numeric' })}</span><span className="agenda-marker task-marker" /><div><b>{item.title}</b><small>Task · {item.priority} priority</small></div><button className="icon-button" onClick={() => toggleTask(item)} aria-label="Toggle task"><Check size={16} /></button></div>)}{!tasks.some((task) => task.dueAt) && !data.events.length && <Empty title="Your week is open." text="Add tasks with dates or schedule an event to see your week take shape." />}</div></PageHeading>}

        {view === 'Timeline' && <PageHeading eyebrow="A DAY AT A GLANCE" title="Timeline" text="See where your time is going today."><div className="panel timeline-panel">{Array.from({ length: 14 }, (_, i) => i + 7).map((hour) => { const atHour = [...data.events.filter((event) => { const date = new Date(event.startsAt); return sameDay(date, today) && date.getHours() === hour; }).map((event) => ({ title: event.title, time: new Date(event.startsAt), kind: 'event' })), ...tasks.filter((task) => task.dueAt && sameDay(new Date(task.dueAt), today) && new Date(task.dueAt).getHours() === hour).map((task) => ({ title: task.title, time: new Date(task.dueAt!), kind: 'task' }))]; return <div className="timeline-hour" key={hour}><span className="timeline-time">{new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date().setHours(hour, 0, 0, 0))}</span><div className="timeline-line">{atHour.map((item) => <div key={`${item.kind}-${item.title}`} className={`timeline-item ${item.kind}`}><b>{item.title}</b><small>{timeLabel(item.time)}</small></div>)}</div></div>; })}</div></PageHeading>}

        {view === 'Planner' && <PageHeading eyebrow="A PLAN WITH ROOM TO BREATHE" title="Plan my day" text="A sensible first draft based on priority, time, and what’s already scheduled." action={<button className="button-soft" onClick={() => setStatus('Plan refreshed using your open tasks and events.')}><WandSparkles size={16} /> Refresh plan</button>}><div className="planner-callout"><Sparkles size={19} /><div><b>Start with a good-enough plan.</b><span>Daymark keeps 10 minutes between tasks and avoids your calendar events.</span></div></div><div className="panel plan-list">{plan.length ? plan.map((block) => <div className="plan-row" key={block.task.id}><div className="plan-time">{timeLabel(block.startsAt)}<small>{timeLabel(block.endsAt)}</small></div><div className="plan-marker" /><div className="plan-content"><b>{block.task.title}</b><div className="task-meta"><PriorityPill priority={block.task.priority} /><span>{block.task.durationMinutes} min</span></div></div><button className="icon-button" onClick={() => startFocus(block.task)} aria-label={`Focus on ${block.task.title}`}><Play size={15} /></button></div>) : <Empty title="No tasks to plan." text="Add open tasks and Daymark will find a sensible order for your day." />}</div><p className="subtle-note">Suggestions are a starting point. Your schedule stays yours.</p></PageHeading>}

        {view === 'Notes' && <PageHeading eyebrow="THOUGHTS, KEPT CLOSE" title="Notes" text="A quiet place for the bits you don’t want to lose." action={<button className="button-soft" onClick={addNote}><Plus size={16} /> New note</button>}><div className="notes-grid">{data.notes.filter((note) => !note.deletedAt).map((note) => <article className="note-card" key={note.id}><input aria-label="Note title" value={note.title} onChange={(event) => updateData((current) => ({ ...current, notes: current.notes.map((item) => item.id === note.id ? { ...item, title: event.target.value, updatedAt: new Date().toISOString(), revision: item.revision + 1 } : item) }))} /><textarea aria-label="Note body" value={note.body} placeholder="Start writing…" onChange={(event) => updateData((current) => ({ ...current, notes: current.notes.map((item) => item.id === note.id ? { ...item, body: event.target.value, updatedAt: new Date().toISOString(), revision: item.revision + 1 } : item) }))} /><div className="note-footer"><span>{dayLabel(note.updatedAt)}</span><button className="icon-button" onClick={() => updateData((current) => ({ ...current, notes: current.notes.filter((item) => item.id !== note.id) }))} aria-label="Delete note"><Trash2 size={14} /></button></div></article>)}{!data.notes.length && <div className="empty-card"><Empty title="Keep a thought here." text="Add a note for ideas, reflections, or anything you want beside your plan." /><button className="button-soft" onClick={addNote}><Plus size={15} /> Create your first note</button></div>}</div></PageHeading>}

        {view === 'Insights' && <PageHeading eyebrow="NOTICE YOUR PROGRESS" title="Insights" text="A gentle look at the work you’ve done."><div className="insight-cards"><div className="insight-card"><span className="overline">COMPLETED TASKS</span><b>{completedTasks.length}</b><small>All-time marks</small></div><div className="insight-card"><span className="overline">OPEN TASKS</span><b>{openTasks.length}</b><small>Still in your hands</small></div><div className="insight-card"><span className="overline">COMPLETION</span><b>{percent}%</b><small>Of current task list</small></div></div><div className="panel heatmap-panel"><div className="panel-heading"><div><span className="overline">LAST 28 DAYS</span><h2>Your steady marks</h2></div><span className="muted-copy">Completed tasks by day</span></div><div className="heatmap">{Array.from({ length: 28 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (27 - index)); const count = completedTasks.filter((task) => task.completedAt && sameDay(new Date(task.completedAt), date)).length; return <span key={index} className={`heat-cell heat-${Math.min(4, count)}`} title={`${dayLabel(date)} · ${count} complete`} />; })}</div><div className="heat-legend"><span>Less</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={`heat-cell heat-${level}`} />)}<span>More</span></div></div><div className="achievements"><h2>Good things you’ve done</h2><div className="achievement-row"><span className="achievement-icon"><Sparkles size={18} /></span><div><b>{tasks.length ? 'You started.' : 'The first mark is waiting.'}</b><small>{tasks.length ? 'Your Daymark is taking shape.' : 'Add one task to begin your history.'}</small></div></div><div className="achievement-row"><span className="achievement-icon"><CheckCheck size={18} /></span><div><b>{completedTasks.length >= 10 ? 'Ten tasks complete.' : `${10 - completedTasks.length} more to your first ten.`}</b><small>Small finishes add up.</small></div></div></div></PageHeading>}

        {view === 'Settings' && <PageHeading eyebrow="MAKE DAYMARK YOURS" title="Settings" text="Your preferences, account, and data tools."><div className="settings-layout">
          <section className="panel settings-panel"><div className="panel-heading"><div><span className="overline">ACCOUNT & SYNC</span><h2>{session ? 'Cloud sync is on' : 'Connect your devices'}</h2></div>{session ? <Cloud className="settings-status-icon" size={19} /> : <HardDrive className="settings-status-icon" size={19} />}</div><p>{session ? `Signed in as ${session.user.email}. Task changes sync through Supabase.` : supabase ? 'Sign in to sync your tasks across Daymark on the web, Windows, and Android.' : 'Supabase is not configured yet. Your data is stored locally on this device.'}</p>{!supabase && <div className="setup-hint">Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your GitHub Actions secrets and local <code>.env</code> file to enable accounts.</div>}{supabase && !session && <form className="auth-form" onSubmit={submitAuth}><input type="email" required autoComplete="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="Email address" /><input type="password" required minLength={8} autoComplete={authMode === 'sign-in' ? 'current-password' : 'new-password'} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Password" /><button className="primary-action" type="submit">{authMode === 'sign-in' ? 'Sign in' : 'Create account'} <ArrowRight size={15} /></button><button className="text-link" type="button" onClick={() => setAuthMode(authMode === 'sign-in' ? 'sign-up' : 'sign-in')}>{authMode === 'sign-in' ? 'New to Daymark? Create an account' : 'Already have an account? Sign in'}</button></form>}{session && <button className="button-soft" onClick={() => void supabase?.auth.signOut()}><LogOut size={15} /> Sign out</button>}<div className="setup-hint">{status || (session ? 'Task updates sync live when you are online.' : 'Your local data stays available if you are offline.')}</div></section>
          <section className="panel settings-panel"><div className="panel-heading"><div><span className="overline">APPEARANCE</span><h2>Make it feel right</h2></div></div><div className="setting-row"><div className="setting-label"><span className="setting-icon theme-setting-icon">{data.preferences.theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}</span><div><b>Theme</b><small>Choose a light or dark workspace</small></div></div><button className="button-soft" onClick={() => setPreference('theme', data.preferences.theme === 'dark' ? 'light' : 'dark')}>{data.preferences.theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}{data.preferences.theme === 'dark' ? 'Dark' : 'Light'}</button></div><div className="setting-row"><div className="setting-label"><span className="setting-icon accent-setting-icon"><Palette size={18} /></span><div><b>Accent color</b><small>A small detail that makes Daymark yours</small></div></div><input className="color-input" type="color" value={data.preferences.accent} onChange={(event) => setPreference('accent', event.target.value)} aria-label="Accent color" /></div><div className="setting-row"><div className="setting-label"><span className="setting-icon density-setting-icon"><MonitorCog size={18} /></span><div><b>Layout density</b><small>Choose comfortable or compact spacing</small></div></div><select value={data.preferences.density} onChange={(event) => setPreference('density', event.target.value as 'comfortable' | 'compact')}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></div></section>
          <section className="panel settings-panel"><div className="panel-heading"><div><span className="overline">YOUR DATA</span><h2>Always yours</h2></div></div><p>Export a portable JSON backup or restore one on this device.</p><div className="setting-actions"><button className="button-soft" onClick={exportData}><Download size={15} /> Export backup</button><button className="button-soft" onClick={() => importRef.current?.click()}><Upload size={15} /> Import backup</button><input ref={importRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importData(event.target.files?.[0])} /></div></section>
          <section className="panel settings-panel"><div className="panel-heading"><div><span className="overline">CONNECTED SERVICES</span><h2>Room to grow</h2></div></div><div className="integration-row"><div className="integration-icon google-icon">G</div><div><b>Google Calendar</b><small>Two-way event sync is planned; connection setup is not enabled yet.</small></div><span className="coming-soon">SOON</span></div><div className="integration-row"><div className="integration-icon jarvis-icon"><Sparkles size={16} /></div><div><b>JARVIS integration</b><small>A versioned API layer is reserved for a future assistant connection.</small></div><span className="coming-soon">LATER</span></div></section>
        </div><footer className="settings-foot">Daymark keeps the parts of your day that matter close.</footer></PageHeading>}
        <footer className="page-footer"><span>Daymark · Make room for what matters</span><span>Private by default · Built for today</span></footer>
      </div>
    </main>
    {commandOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}><section className="command-modal"><div className="command-search"><Search size={18} /><input autoFocus value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') runCommand(); }} placeholder="Search or run a command…" /><kbd>ESC</kbd></div><span className="overline command-label">SUGGESTED</span><div className="command-options">{nav.filter((item) => !commandQuery || item.label.toLowerCase().includes(commandQuery.toLowerCase())).slice(0, 5).map(({ label, icon: Icon }) => <button key={label} onClick={() => go(label)}><Icon size={16} /> Open {label}<ArrowRight size={14} /></button>)}<button onClick={() => { setCommandOpen(false); document.getElementById('quick-capture')?.focus(); }}><Plus size={16} /> Add a task <kbd>↵</kbd></button><button onClick={() => { setPreference('theme', data.preferences.theme === 'dark' ? 'light' : 'dark'); setCommandOpen(false); }}><Moon size={16} /> Toggle dark mode</button></div><div className="command-foot">Type “overdue”, “dark mode”, or a view name</div></section></div>}
    {chosenFocusTask && <div className="modal-backdrop focus-backdrop"><section className="focus-modal"><button className="icon-button focus-close" onClick={() => { setFocusRunning(false); setFocusTaskId(null); }} aria-label="Close focus mode"><X size={18} /></button><span className="overline">FOCUS SESSION</span><h2>{chosenFocusTask.title}</h2><div className="focus-clock">{focusClock}</div><div className="focus-controls"><button className="primary-action" onClick={() => setFocusRunning((running) => !running)}>{focusRunning ? <Pause size={16} /> : <Play size={16} />}{focusRunning ? 'Pause' : 'Resume'}</button><button className="button-soft" onClick={() => { setFocusRunning(false); setFocusSeconds(25 * 60); }}><span className="reset-icon">↻</span> Restart</button><button className="button-soft" onClick={() => { toggleTask(chosenFocusTask); setFocusTaskId(null); setFocusRunning(false); }}><Check size={16} /> Complete</button></div><p>One thing at a time. Take a short break when the timer ends.</p></section></div>}
  </div>;
}

function PageHeading({ eyebrow, title, text, action, children }: { eyebrow: string; title: string; text: string; action?: ReactNode; children: ReactNode }) { return <><div className="page-heading"><div><span className="overline">{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>{action}</div>{children}</>; }
function TaskList({ items, onToggle, onDelete, onFocus, onPriority }: { items: Task[]; onToggle: (task: Task) => void; onDelete: (task: Task) => void; onFocus: (task: Task) => void; onPriority: (task: Task, priority: TaskPriority) => void }) {
  return <div className="task-list">{items.map((task) => <article className={`task-row ${task.status === 'completed' ? 'task-done' : ''}`} key={task.id}><button className={`task-check ${task.status === 'completed' ? 'checked' : ''}`} onClick={() => onToggle(task)} aria-label={task.status === 'completed' ? 'Reopen task' : 'Complete task'}>{task.status === 'completed' ? <Check size={14} /> : <Circle size={15} />}</button><div className="task-main"><b>{task.title}</b><div className="task-meta"><select className="priority-select" aria-label={`Priority for ${task.title}`} value={task.priority} onChange={(event) => onPriority(task, event.target.value as TaskPriority)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select>{task.dueAt && <span><CalendarDays size={12} />{dayLabel(task.dueAt, { month: 'short', day: 'numeric' })}</span>}<span>{task.durationMinutes} min</span>{task.category !== 'Personal' && <span>{task.category}</span>}</div></div><div className="task-actions"><button className="icon-button" onClick={() => onFocus(task)} title="Focus"><Play size={14} /></button><button className="icon-button delete-action" onClick={() => onDelete(task)} title="Delete"><Trash2 size={14} /></button></div></article>)}</div>;
}
function PriorityPill({ priority }: { priority: TaskPriority }) { return <span className={`priority-pill priority-${priority}`}><i />{priority}</span>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className="empty-state"><span className="empty-spark"><Sparkles size={19} /></span><b>{title}</b><p>{text}</p></div>; }

export default App;

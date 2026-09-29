import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Archive,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Command,
  ListTodo,
  Menu,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  X,
  Zap,
} from 'lucide-react';

type Filter = 'all' | 'active' | 'completed';
type Task = { id: string; title: string; completed: boolean; createdAt: string };

const STORAGE_KEY = 'daymark-tasks';
const seedTasks: Task[] = [
  { id: 'seed-1', title: 'Map out the three things that matter today', completed: true, createdAt: new Date().toISOString() },
  { id: 'seed-2', title: 'Finish the thing you have been putting off', completed: false, createdAt: new Date().toISOString() },
  { id: 'seed-3', title: 'Make space for something that is just for you', completed: false, createdAt: new Date().toISOString() },
];

function readTasks(): Task[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedTasks)); return seedTasks; }
    const parsed = JSON.parse(saved) as Task[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return seedTasks; }
}
function saveTasks(tasks: Task[]) { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch {} }
function dateParts() {
  const now = new Date();
  return {
    weekday: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now),
    date: new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(now),
  };
}

function App() {
  const [tasks, setTasks] = useState<Task[]>(readTasks);
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [activeNav, setActiveNav] = useState('Today');
  const { weekday, date } = dateParts();

  const completedCount = tasks.filter(t => t.completed).length;
  const activeCount = tasks.length - completedCount;
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  const visibleTasks = useMemo(() => {
    let list = filter === 'active' ? tasks.filter(t => !t.completed) : filter === 'completed' ? tasks.filter(t => t.completed) : tasks;
    if (query.trim()) list = list.filter(t => t.title.toLowerCase().includes(query.toLowerCase()));
    return list;
  }, [filter, tasks, query]);

  const updateTasks = (next: Task[]) => { setTasks(next); saveTasks(next); };
  const addTask = () => {
    const title = draft.trim(); if (!title) return;
    setAdding(true);
    updateTasks([{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, completed: false, createdAt: new Date().toISOString() }, ...tasks]);
    setDraft(''); window.setTimeout(() => setAdding(false), 300);
  };
  const toggleTask = (id: string) => updateTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  const removeTask = (id: string) => updateTasks(tasks.filter(t => t.id !== id));
  const clearCompleted = () => { updateTasks(tasks.filter(t => !t.completed)); setFilter('all'); };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setQuery(''); document.getElementById('daymark-search')?.focus(); }
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navItems = [
    { label: 'Today', icon: CalendarDays },
    { label: 'All tasks', icon: ListTodo },
    { label: 'Completed', icon: CheckCircle2 },
  ];

  return (
    <main className="daymark-shell">
      <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><span>DM</span></div>
          <div><div className="brand-name">daymark</div><div className="brand-sub">your daily command centre</div></div>
          <button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>

        <div className="sidebar-section">
          <div className="eyebrow">Workspace</div>
          <nav className="nav-list">
            {navItems.map(({ label, icon: Icon }) => (
              <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} onClick={() => { setActiveNav(label); setFilter(label === 'Completed' ? 'completed' : label === 'All tasks' ? 'all' : 'active'); setMenuOpen(false); }}>
                <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
                <span className="nav-count">{label === 'Today' ? activeCount : label === 'All tasks' ? tasks.length : completedCount}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-card">
          <div className="mini-orbit"><Sparkles size={15} /></div>
          <div className="eyebrow">Daily intention</div>
          <p>Do less. Notice more. Finish what matters.</p>
          <div className="tiny-rule" />
          <span className="mono">PRIVATE · LOCAL · SIMPLE</span>
        </div>

        <div className="sidebar-bottom">
          <div className="storage-dot"><span /> Saved on this device</div>
          <div className="sidebar-version">DAYMARK / 01</div>
        </div>
      </aside>

      {menuOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

      <section className="main-panel">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={21} /></button>
          <div className="topbar-context"><span className="live-dot" /> Today / {weekday}</div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} /><input id="daymark-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your day" aria-label="Search tasks" /><kbd><Command size={10} />K</kbd>
            </label>
            <button className="icon-btn" title="Quick add" onClick={() => document.getElementById('new-task')?.focus()}><Plus size={18} /></button>
          </div>
        </header>

        <div className="content-wrap">
          <section className="hero-grid">
            <div className="hero-copy">
              <div className="date-line"><span>{date}</span><span className="date-line-mark">/</span><span className="mono">{activeCount} {activeCount === 1 ? 'open item' : 'open items'}</span></div>
              <h1>Make today<br /><em>count.</em></h1>
              <p>Keep the important things close. Daymark turns a noisy list into a clear little plan you can actually live with.</p>
              <div className="hero-actions">
                <button className="primary-btn" onClick={() => document.getElementById('new-task')?.focus()}><Plus size={17} /> Add something</button>
                <button className="ghost-btn" onClick={() => setFilter('active')}><Target size={16} /> Focus mode <ArrowUpRight size={14} /></button>
              </div>
            </div>

            <div className="progress-card">
              <div className="card-topline"><span className="eyebrow">Daily progress</span><Zap size={17} /></div>
              <div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as CSSProperties}>
                <div><strong>{progress}</strong><span>%</span><small>complete</small></div>
              </div>
              <div className="progress-meta"><span>{completedCount} finished</span><span>{activeCount} remaining</span></div>
              <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
              <p>{progress === 100 ? 'Everything is wrapped. Beautiful.' : progress === 0 ? 'Fresh page. Start with one.' : 'Keep the momentum. One mark at a time.'}</p>
            </div>
          </section>

          <section className="stat-strip">
            <div><span className="stat-icon warm"><Clock3 size={17} /></span><div><b>{activeCount}</b><span>open now</span></div></div>
            <div><span className="stat-icon green"><CheckCircle2 size={17} /></span><div><b>{completedCount}</b><span>completed</span></div></div>
            <div><span className="stat-icon blue"><Archive size={17} /></span><div><b>{tasks.length}</b><span>total marks</span></div></div>
            <div className="stat-note"><span className="mono">01</span><span>Your list stays on this device. No account. No noise.</span></div>
          </section>

          <section className="tasks-section">
            <div className="section-heading"><div><span className="eyebrow">The list</span><h2>What needs you?</h2></div><div className="heading-note"><span className="status-pulse" /> Live</div></div>

            <div className="composer" data-testid="form-add-task">
              <div className="composer-icon"><Plus size={19} /></div>
              <input id="new-task" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTask(); }} placeholder="What would feel good to finish?" aria-label="New task" />
              <button onClick={addTask} disabled={!draft.trim() || adding} className="composer-submit">{adding ? 'Adding…' : 'Add task'} <kbd>↵</kbd></button>
            </div>

            <div className="list-toolbar">
              <div className="filters" role="group" aria-label="Filter tasks">
                {(['all', 'active', 'completed'] as Filter[]).map(item => {
                  const count = item === 'all' ? tasks.length : item === 'active' ? activeCount : completedCount;
                  return <button key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}<span>{count}</span></button>;
                })}
              </div>
              {completedCount > 0 && <button className="clear-btn" onClick={clearCompleted}><Trash2 size={14} /> Clear completed</button>}
            </div>

            <div className="task-list" aria-live="polite">
              {visibleTasks.length ? visibleTasks.map((task, index) => (
                <article className={`task-card ${task.completed ? 'done' : ''}`} key={task.id} style={{ animationDelay: `${index * 45}ms` }}>
                  <button className={`task-check ${task.completed ? 'checked' : ''}`} onClick={() => toggleTask(task.id)} aria-label={task.completed ? `Mark ${task.title} active` : `Complete ${task.title}`}>
                    {task.completed ? <Check size={14} strokeWidth={3} /> : <Circle size={14} />}
                  </button>
                  <div className="task-body"><span className="task-index">{String(index + 1).padStart(2, '0')}</span><span className="task-title">{task.title}</span></div>
                  <div className="task-end"><span className="task-status">{task.completed ? 'Done' : 'Open'}</span><button className="delete-btn" onClick={() => removeTask(task.id)} aria-label={`Delete ${task.title}`}><Trash2 size={15} /></button><ChevronRight size={15} className="chevron" /></div>
                </article>
              )) : (
                <div className="empty-state"><div className="empty-icon"><Sparkles size={22} /></div><h3>{filter === 'completed' ? 'Nothing finished yet.' : filter === 'active' ? 'You are all caught up.' : 'A clear little slate.'}</h3><p>{query ? `No task matches “${query}”.` : 'Add one small thing above and let the day take shape.'}</p>{(filter !== 'all' || query) && <button onClick={() => { setFilter('all'); setQuery(''); }}>Show everything</button>}</div>
              )}
            </div>
          </section>

          <footer className="footer"><span><span className="footer-mark">●</span> Daymark keeps things deliberately simple.</span><span className="mono">BUILT FOR TODAY · {new Date().getFullYear()}</span></footer>
        </div>
      </section>
    </main>
  );
}
export default App;

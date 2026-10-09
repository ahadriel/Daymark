export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'open' | 'completed';
export type CalendarSource = 'daymark' | 'google';

export interface SyncRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  revision: number;
}

export interface Task extends SyncRecord {
  title: string;
  details: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  durationMinutes: number;
  category: string;
  tags: string[];
  completedAt: string | null;
  recurrence: string | null;
}

export interface CalendarEvent extends SyncRecord {
  title: string;
  startsAt: string;
  endsAt: string;
  source: CalendarSource;
  externalId: string | null;
  location: string;
  notes: string;
}

export interface DayNote extends SyncRecord {
  title: string;
  body: string;
  day: string;
}

export interface DailyTemplate {
  id: string;
  name: string;
  startHour: number;
  blocks: Array<{ title: string; startMinute: number; durationMinutes: number }>;
}

export interface Preferences {
  theme: 'light' | 'dark';
  accent: string;
  density: 'comfortable' | 'compact';
  weekStartsOn: 0 | 1;
}

export interface DaymarkData {
  schemaVersion: 1;
  tasks: Task[];
  events: CalendarEvent[];
  notes: DayNote[];
  templates: DailyTemplate[];
  preferences: Preferences;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    return (char === 'x' ? random : (random & 0x3 | 0x8)).toString(16);
  });
}

export function createTask(title: string, dueAt: string | null = null): Task {
  const now = new Date().toISOString();
  return {
    id: newId(), title, details: '', status: 'open', priority: 'medium', dueAt,
    durationMinutes: 30, category: 'Personal', tags: [], completedAt: null,
    recurrence: null, createdAt: now, updatedAt: now, deletedAt: null, revision: 1,
  };
}

export function mergeRecords<T extends SyncRecord>(local: T[], remote: T[]): T[] {
  const merged = new Map<string, T>();
  for (const record of [...local, ...remote]) {
    const current = merged.get(record.id);
    if (!current || record.updatedAt > current.updatedAt ||
      (record.updatedAt === current.updatedAt && record.revision > current.revision)) {
      merged.set(record.id, record);
    }
  }
  return [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createDefaultData(): DaymarkData {
  return {
    schemaVersion: 1,
    tasks: [],
    events: [],
    notes: [],
    templates: [
      { id: 'school-day', name: 'School day', startHour: 7, blocks: [
        { title: 'Morning routine', startMinute: 420, durationMinutes: 60 },
        { title: 'Study block', startMinute: 960, durationMinutes: 90 },
      ] },
      { id: 'weekend', name: 'Weekend', startHour: 9, blocks: [
        { title: 'Slow morning', startMinute: 540, durationMinutes: 90 },
        { title: 'Personal project', startMinute: 660, durationMinutes: 90 },
      ] },
    ],
    preferences: { theme: 'light', accent: '#5276c5', density: 'comfortable', weekStartsOn: 1 },
  };
}

import { createDefaultData, type DaymarkData } from '../core/model';

const STORAGE_KEY = 'daymark:data:v1';

export function readData(): DaymarkData {
  const defaults = createDefaultData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<DaymarkData>;
    if (parsed.schemaVersion !== 1) return defaults;
    return {
      ...defaults,
      ...parsed,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : defaults.tasks,
      events: Array.isArray(parsed.events) ? parsed.events : defaults.events,
      notes: Array.isArray(parsed.notes) ? parsed.notes : defaults.notes,
      templates: Array.isArray(parsed.templates) ? parsed.templates : defaults.templates,
      preferences: { ...defaults.preferences, ...parsed.preferences },
    };
  } catch {
    return defaults;
  }
}

export function writeData(data: DaymarkData): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch (error) { console.warn('Daymark could not save to this device.', error); }
}

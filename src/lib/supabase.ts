import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabase = url && key ? createClient(url, key, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
}) : null;

export function toTaskRow(task: import('../core/model').Task, userId: string) {
  return {
    id: task.id, user_id: userId, title: task.title, details: task.details,
    status: task.status, priority: task.priority, due_at: task.dueAt,
    duration_minutes: task.durationMinutes, category: task.category, tags: task.tags,
    completed_at: task.completedAt, recurrence: task.recurrence,
    created_at: task.createdAt, updated_at: task.updatedAt, deleted_at: task.deletedAt,
    revision: task.revision,
  };
}

export function fromTaskRow(row: Record<string, unknown>): import('../core/model').Task {
  return {
    id: String(row.id), title: String(row.title ?? ''), details: String(row.details ?? ''),
    status: row.status === 'completed' ? 'completed' : 'open',
    priority: row.priority === 'low' || row.priority === 'high' || row.priority === 'urgent' ? row.priority : 'medium',
    dueAt: typeof row.due_at === 'string' ? row.due_at : null,
    durationMinutes: Number(row.duration_minutes ?? 30), category: String(row.category ?? 'Personal'),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    completedAt: typeof row.completed_at === 'string' ? row.completed_at : null,
    recurrence: typeof row.recurrence === 'string' ? row.recurrence : null,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    deletedAt: typeof row.deleted_at === 'string' ? row.deleted_at : null,
    revision: Number(row.revision ?? 1),
  };
}

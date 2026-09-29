import type { CalendarEvent, Task } from './model';

export interface PlanBlock { task: Task; startsAt: Date; endsAt: Date; }

const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 } as const;

export function rankTasks(tasks: Task[], now = new Date()): Task[] {
  return tasks.filter((task) => task.status === 'open' && !task.deletedAt).sort((a, b) => {
    const dueA = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const dueB = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const scoreA = priorityWeight[a.priority] * 10 - Math.max(0, (dueA - now.getTime()) / 86_400_000);
    const scoreB = priorityWeight[b.priority] * 10 - Math.max(0, (dueB - now.getTime()) / 86_400_000);
    return scoreB - scoreA;
  });
}

export function planMyDay(tasks: Task[], events: CalendarEvent[], now = new Date()): PlanBlock[] {
  const dayStart = new Date(now); dayStart.setHours(9, 0, 0, 0);
  let cursor = new Date(Math.max(now.getTime(), dayStart.getTime()));
  const endOfDay = new Date(now); endOfDay.setHours(21, 0, 0, 0);
  const busy = events.filter((event) => !event.deletedAt && new Date(event.endsAt) > cursor && new Date(event.startsAt) < endOfDay)
    .map((event) => ({ start: new Date(event.startsAt), end: new Date(event.endsAt) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const plan: PlanBlock[] = [];
  for (const task of rankTasks(tasks, now)) {
    const duration = Math.min(180, Math.max(15, task.durationMinutes || 30)) * 60_000;
    for (const event of busy) if (cursor < event.end && cursor.getTime() + duration > event.start.getTime()) cursor = new Date(event.end);
    if (cursor.getTime() + duration > endOfDay.getTime()) break;
    const startsAt = new Date(cursor);
    const endsAt = new Date(cursor.getTime() + duration);
    plan.push({ task, startsAt, endsAt });
    cursor = new Date(endsAt.getTime() + 10 * 60_000);
  }
  return plan;
}

export function suggestTask(tasks: Task[], now = new Date()): Task | undefined {
  return rankTasks(tasks, now).find((task) => !task.dueAt || new Date(task.dueAt).getTime() <= now.getTime() + 7 * 86_400_000);
}

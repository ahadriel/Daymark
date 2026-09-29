export function parseQuickCapture(input: string, now = new Date()): { title: string; dueAt: string | null } {
  let title = input.trim();
  if (!title) return { title: '', dueAt: null };
  const hasTomorrow = /\btomorrow\b/i.test(title);
  const hasToday = /\btoday\b/i.test(title);
  const timeMatch = title.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i)
    ?? title.match(/\bat\s*(\d{1,2})(?::(\d{2}))?\b/i);
  let dueAt: string | null = null;
  if (hasTomorrow || hasToday || timeMatch) {
    const day = new Date(now);
    if (hasTomorrow) day.setDate(day.getDate() + 1);
    let hour = timeMatch ? Number(timeMatch[1]) : 17;
    const minute = timeMatch?.[2] ? Number(timeMatch[2]) : 0;
    const meridiem = timeMatch?.[3]?.toLowerCase();
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    day.setHours(hour, minute, 0, 0);
    dueAt = day.toISOString();
  }
  title = title.replace(/\b(?:today|tomorrow)\b/ig, ' ');
  if (timeMatch) title = title.replace(timeMatch[0], ' ');
  return { title: title.replace(/\s+/g, ' ').trim(), dueAt };
}

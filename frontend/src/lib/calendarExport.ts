/**
 * Client-side calendar export helpers (.ics for bulk export, a Google Calendar URL for
 * single events). Due dates are date-only, stored as an ISO string at UTC midnight — every
 * exported event uses DATE-valued DTSTART/DTEND (all-day) to sidestep timezone ambiguity,
 * so the calendar day the user picked is the day that shows up regardless of viewer timezone.
 */

/** Minimal shape this module needs — decoupled from the full `Task` type. */
export interface ExportableTask {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string | null;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function pad4(n: number): string {
  return n.toString().padStart(4, '0');
}

/** Extracts the UTC calendar-day parts, matching how due dates are stored. */
function utcDateParts(iso: string): { y: number; m: number; d: number } {
  const date = new Date(iso);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth(), d: date.getUTCDate() };
}

/** `YYYYMMDD` for the due date itself. */
function formatDateOnly(iso: string): string {
  const { y, m, d } = utcDateParts(iso);
  return `${pad4(y)}${pad2(m + 1)}${pad2(d)}`;
}

/** `YYYYMMDD` for the day after — DATE-valued DTEND is exclusive per RFC 5545. */
function formatDateOnlyNextDay(iso: string): string {
  const { y, m, d } = utcDateParts(iso);
  const next = new Date(Date.UTC(y, m, d + 1));
  return `${pad4(next.getUTCFullYear())}${pad2(next.getUTCMonth() + 1)}${pad2(next.getUTCDate())}`;
}

/** `YYYYMMDDTHHMMSSZ` — used for DTSTAMP, which must be a UTC date-time. */
function formatUtcTimestamp(date: Date): string {
  return (
    `${pad4(date.getUTCFullYear())}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  );
}

/** Escapes TEXT-type values per RFC 5545 §3.3.11. */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Folds a content line to <=75 octets per RFC 5545 §3.1, splitting on UTF-8
 * byte boundaries (never mid-codepoint) with CRLF + single-space continuation.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const chunks: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < line.length) {
    let end = start;
    let bytes = 0;
    while (end < line.length) {
      const charBytes = encoder.encode(line[end]).length;
      if (bytes + charBytes > limit) break;
      bytes += charBytes;
      end++;
    }
    if (end === start) end = start + 1; // never stall on an oversized single char
    chunks.push((chunks.length === 0 ? '' : ' ') + line.slice(start, end));
    start = end;
    limit = 74; // continuation lines lose 1 octet to the leading space
  }
  return chunks.join('\r\n');
}

/** Builds a full `VCALENDAR` document containing one `VEVENT` per dated task. */
export function buildICS(tasks: ExportableTask[]): string {
  const dtstamp = formatUtcTimestamp(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TeamFlow//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const task of tasks) {
    if (!task.dueDate) continue;
    lines.push('BEGIN:VEVENT');
    lines.push(foldLine(`UID:${task.id}@teamflow.app`));
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(task.dueDate)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDateOnlyNextDay(task.dueDate)}`);
    lines.push(foldLine(`SUMMARY:${escapeICSText(task.title)}`));
    if (task.description) {
      lines.push(foldLine(`DESCRIPTION:${escapeICSText(task.description)}`));
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

/** Generates the .ics file client-side and triggers a browser download. */
export function downloadICSFile(tasks: ExportableTask[], filename = 'teamflow-tasks.ics'): void {
  const ics = buildICS(tasks);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Google Calendar's URL-based "add a single event" link — no auth needed. */
export function buildGoogleCalendarUrl(task: ExportableTask): string {
  if (!task.dueDate) return '';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: task.title,
    dates: `${formatDateOnly(task.dueDate)}/${formatDateOnlyNextDay(task.dueDate)}`,
  });
  if (task.description) params.set('details', task.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

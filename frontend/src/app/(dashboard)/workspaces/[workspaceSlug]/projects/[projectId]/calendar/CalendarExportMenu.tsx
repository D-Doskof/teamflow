'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarPlus, Download, ExternalLink } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { buildGoogleCalendarUrl, downloadICSFile, ExportableTask } from '@/lib/calendarExport';
import { useT } from '@/lib/i18n/useT';

interface CalendarExportMenuProps {
  /** All tasks with a due date, project-wide (already loaded by the calendar page). */
  tasks: ExportableTask[];
}

export function CalendarExportMenu({ tasks }: CalendarExportMenuProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const sortedTasks = [...tasks].sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={tasks.length === 0}
        className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors flex-shrink-0 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <CalendarPlus className="h-3.5 w-3.5" />
        {t.calendar.export.button}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-w-[90vw] bg-card rounded-2xl shadow-lg border border-border py-3 z-50">
          <p className="px-4 pb-2 text-xs font-semibold text-foreground">
            {t.calendar.export.menuTitle}
          </p>

          {/* Apple Calendar / Outlook — bulk .ics download */}
          <div className="px-4 py-2 border-b border-border">
            <p className="text-sm font-medium text-foreground mb-1">{t.calendar.export.icsTitle}</p>
            <p className="text-xs text-muted-foreground mb-2">
              {t.calendar.export.icsHint(tasks.length)}
            </p>
            <button
              onClick={() => {
                downloadICSFile(tasks);
                setOpen(false);
              }}
              className="w-full flex items-center justify-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              {t.calendar.export.icsDownload}
            </button>
          </div>

          {/* Google Calendar — one event at a time, per-task links */}
          <div className="px-4 pt-2">
            <p className="text-sm font-medium text-foreground mb-1">
              {t.calendar.export.googleTitle}
            </p>
            <p className="text-xs text-muted-foreground mb-2">{t.calendar.export.googleHint}</p>
            {sortedTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t.calendar.export.googleEmpty}</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-0.5 -mx-1">
                {sortedTasks.map((task) => (
                  <a
                    key={task.id}
                    href={buildGoogleCalendarUrl(task)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t.calendar.export.googleAdd}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-xs hover:bg-secondary transition-colors',
                    )}
                  >
                    <span className="flex-1 min-w-0 truncate text-foreground">{task.title}</span>
                    <span className="text-muted-foreground flex-shrink-0">
                      {task.dueDate && formatDate(task.dueDate)}
                    </span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

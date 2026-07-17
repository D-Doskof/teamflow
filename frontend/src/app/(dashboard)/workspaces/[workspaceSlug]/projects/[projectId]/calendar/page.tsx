'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQueries } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useBoards } from '@/features/board/hooks/useBoard';
import { taskKeys } from '@/features/task/hooks/useTask';
import { taskApi } from '@/features/task/api/task.api';
import { TaskDetailModal } from '@/features/task/components/TaskDetailModal';
import { useMyPermissions } from '@/features/workspace/hooks/useWorkspace';
import { Task } from '@/types';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/useT';
import { CalendarExportMenu } from './CalendarExportMenu';

type BoardPath = { workspaceSlug: string; projectId: string; boardId: string };

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-500',
  HIGH: 'bg-orange-400',
  MEDIUM: 'bg-yellow-400',
  LOW: 'bg-blue-400',
  NONE: 'bg-gray-400',
};

const STATUS_COLORS: Record<string, string> = {
  DONE: 'opacity-50 line-through',
  IN_REVIEW: '',
  IN_PROGRESS: '',
  TODO: '',
};

type TaskWithBoard = Task & { boardId: string };

export default function CalendarPage() {
  const t = useT();
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedTask, setSelectedTask] = useState<TaskWithBoard | null>(null);

  const { data: boards } = useBoards(workspaceSlug, projectId);
  const perms = useMyPermissions(workspaceSlug);
  const canEdit = perms?.canEditContent ?? false;
  const canDelete = perms?.canDeleteContent ?? false;
  const canComment = perms?.canComment ?? false;

  const taskQueries = useQueries({
    queries: (boards ?? []).map((board) => {
      const path: BoardPath = { workspaceSlug, projectId, boardId: board.id };
      return {
        queryKey: taskKeys.board(path),
        queryFn: () => taskApi.getByBoard(path),
        enabled: !!boards?.length,
        staleTime: 30_000,
      };
    }),
  });

  const allTasks: TaskWithBoard[] = useMemo(() => {
    if (!boards) return [];
    return taskQueries.flatMap((q, i) => {
      const boardId = boards[i]?.id ?? '';
      return (q.data?.data ?? []).filter((t) => !!t.dueDate).map((t) => ({ ...t, boardId }));
    });
  }, [taskQueries, boards]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build calendar grid: 6 rows × 7 cols
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  const tasksByDay = useMemo(() => {
    const map: Record<number, TaskWithBoard[]> = {};
    allTasks.forEach((task) => {
      if (!task.dueDate) return;
      const d = new Date(task.dueDate);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(task);
      }
    });
    return map;
  }, [allTasks, year, month]);

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const isLoading = !boards || taskQueries.some((q) => q.isLoading);
  const boardPathForTask = selectedTask
    ? { workspaceSlug, projectId, boardId: selectedTask.boardId }
    : null;

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 bg-card border-b border-border flex items-center gap-3">
        <CalendarDays className="h-5 w-5 text-primary flex-shrink-0" />
        <div className="flex items-center gap-2 flex-1">
          <button
            onClick={prevMonth}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base sm:text-lg font-semibold text-foreground min-w-[160px] text-center">
            {t.calendar.months[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={goToday}
          className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors flex-shrink-0"
        >
          {t.calendar.today}
        </button>
        <CalendarExportMenu tasks={allTasks} />
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto p-3 sm:p-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {t.calendar.weekdays.map((d) => (
            <div
              key={d}
              className="py-1.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
          {calendarDays.map((day, i) => {
            const tasks = day ? (tasksByDay[day] ?? []) : [];
            const overflow = tasks.length > 3;
            return (
              <div
                key={i}
                className={cn(
                  'bg-card p-1.5 sm:p-2 min-h-[80px] sm:min-h-[110px]',
                  !day && 'bg-secondary/50',
                )}
              >
                {day && (
                  <>
                    <div
                      className={cn(
                        'h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium mb-1 mx-auto sm:mx-0',
                        isToday(day) ? 'bg-primary text-primary-foreground' : 'text-foreground',
                      )}
                    >
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {tasks.slice(0, 3).map((task) => (
                        <button
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className={cn(
                            'w-full text-left rounded px-1 py-0.5 text-[10px] sm:text-xs flex items-center gap-1 hover:opacity-80 transition-opacity',
                            'bg-primary/10 text-primary',
                            STATUS_COLORS[task.status],
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full flex-shrink-0',
                              PRIORITY_COLORS[task.priority],
                            )}
                          />
                          <span className="truncate">{task.title}</span>
                        </button>
                      ))}
                      {overflow && (
                        <p className="text-[10px] text-muted-foreground pl-1">
                          {t.calendar.more(tasks.length - 3)}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* No tasks message */}
        {!isLoading && allTasks.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">{t.calendar.empty}</div>
        )}
      </div>

      {/* Task detail modal */}
      {selectedTask && boardPathForTask && (
        <TaskDetailModal
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          taskId={selectedTask.id}
          initialTask={selectedTask}
          boardPath={boardPathForTask}
          canEdit={canEdit}
          canDelete={canDelete}
          canComment={canComment}
        />
      )}
    </div>
  );
}

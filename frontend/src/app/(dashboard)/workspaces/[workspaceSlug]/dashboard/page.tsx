'use client';

import { useParams } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ListTodo,
  FolderKanban,
  Kanban,
  Users,
} from 'lucide-react';
import { useWorkspaceStats } from '@/features/workspace/hooks/useWorkspace';
import { useWorkspace } from '@/features/workspace/hooks/useWorkspace';
import { useT } from '@/lib/i18n/useT';

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-500',
  HIGH: 'bg-orange-400',
  MEDIUM: 'bg-yellow-400',
  LOW: 'bg-blue-400',
  NONE: 'bg-gray-300 dark:bg-gray-600',
};

const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-gray-400',
  IN_PROGRESS: 'bg-blue-500',
  IN_REVIEW: 'bg-violet-500',
  DONE: 'bg-green-500',
};

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function BarChart({
  data,
  colors,
  labels,
}: {
  data: Record<string, number>;
  colors: Record<string, string>;
  labels: Record<string, string>;
}) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  if (total === 0) return <p className="text-sm text-muted-foreground py-4 text-center">—</p>;

  return (
    <div className="space-y-2.5">
      {Object.entries(data).map(([key, count]) => (
        <div key={key} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-24 flex-shrink-0 truncate">
            {labels[key] ?? key}
          </span>
          <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${colors[key] ?? 'bg-muted-foreground'}`}
              style={{ width: total > 0 ? `${Math.round((count / total) * 100)}%` : '0%' }}
            />
          </div>
          <span className="text-xs font-semibold text-foreground w-6 text-right flex-shrink-0">
            {count}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const t = useT();
  const { data: workspace } = useWorkspace(workspaceSlug);
  const { data: stats, isLoading } = useWorkspaceStats(workspaceSlug);

  const priorityLabels: Record<string, string> = {
    URGENT: t.dashboard.priority_URGENT,
    HIGH: t.dashboard.priority_HIGH,
    MEDIUM: t.dashboard.priority_MEDIUM,
    LOW: t.dashboard.priority_LOW,
    NONE: t.dashboard.priority_NONE,
  };
  const statusLabels: Record<string, string> = {
    TODO: t.dashboard.status_TODO,
    IN_PROGRESS: t.dashboard.status_IN_PROGRESS,
    IN_REVIEW: t.dashboard.status_IN_REVIEW,
    DONE: t.dashboard.status_DONE,
  };

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-8 space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t.dashboard.title}</h1>
        <p className="mt-1 text-muted-foreground">
          {workspace?.name ?? '...'} · {t.dashboard.subtitle}
        </p>
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 h-24 animate-pulse bg-secondary" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={t.dashboard.totalTasks}
            value={stats?.totalTasks ?? 0}
            icon={<ListTodo className="h-6 w-6 text-white" />}
            color="bg-primary"
          />
          <StatCard
            label={t.dashboard.done}
            value={stats?.doneTasks ?? 0}
            icon={<CheckCircle2 className="h-6 w-6 text-white" />}
            color="bg-green-500"
          />
          <StatCard
            label={t.dashboard.inProgress}
            value={stats?.inProgressTasks ?? 0}
            icon={<Clock className="h-6 w-6 text-white" />}
            color="bg-blue-500"
          />
          <StatCard
            label={t.dashboard.overdue}
            value={stats?.overdueTasks ?? 0}
            icon={<AlertTriangle className="h-6 w-6 text-white" />}
            color={stats?.overdueTasks ? 'bg-red-500' : 'bg-gray-400'}
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">{t.dashboard.byPriority}</h2>
          {isLoading ? (
            <div className="space-y-2.5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 rounded animate-pulse bg-secondary" />
              ))}
            </div>
          ) : (
            <BarChart
              data={stats?.byPriority ?? {}}
              colors={PRIORITY_COLORS}
              labels={priorityLabels}
            />
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">{t.dashboard.byStatus}</h2>
          {isLoading ? (
            <div className="space-y-2.5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-4 rounded animate-pulse bg-secondary" />
              ))}
            </div>
          ) : (
            <BarChart data={stats?.byStatus ?? {}} colors={STATUS_COLORS} labels={statusLabels} />
          )}
        </div>
      </div>

      {/* Bottom counters */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: t.dashboard.projects,
            value: stats?.totalProjects ?? 0,
            icon: <FolderKanban className="h-5 w-5 text-primary" />,
          },
          {
            label: t.dashboard.boards,
            value: stats?.totalBoards ?? 0,
            icon: <Kanban className="h-5 w-5 text-primary" />,
          },
          {
            label: t.dashboard.members,
            value: stats?.totalMembers ?? 0,
            icon: <Users className="h-5 w-5 text-emerald-500" />,
          },
        ].map(({ label, value, icon }) => (
          <div key={label} className="card p-5 flex flex-col items-center gap-2 text-center">
            {icon}
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

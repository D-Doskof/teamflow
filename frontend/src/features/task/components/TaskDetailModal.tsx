'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  Tag,
  User,
  MessageSquare,
  Trash2,
  Edit3,
  Check,
  X,
  UserPlus,
  ChevronDown,
  Activity,
  Eye,
  CheckSquare,
  Paperclip,
  Plus,
  Download,
  File as FileIcon,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import {
  useTask,
  useUpdateTask,
  useDeleteTask,
  useTaskComments,
  useAddComment,
  useDeleteComment,
  useAddAssignee,
  useRemoveAssignee,
  useAddLabel,
  useRemoveLabel,
  useTaskActivity,
  useSubtasks,
  useCreateSubtask,
  useUpdateSubtask,
  useDeleteSubtask,
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
} from '../hooks/useTask';
import { taskApi } from '../api/task.api';
import { useWorkspaceMembers } from '@/features/workspace/hooks/useWorkspace';
import { useProjectLabels } from '@/features/project/hooks/useProject';
import { Task } from '@/types';
import { formatRelativeDate, getErrorMessage, cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useT } from '@/lib/i18n/useT';

type BoardPath = { workspaceSlug: string; projectId: string; boardId: string };

const PRIORITY_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  NONE: {
    dot: 'bg-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-600 dark:text-gray-300',
  },
  LOW: {
    dot: 'bg-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
  },
  MEDIUM: {
    dot: 'bg-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-300',
  },
  HIGH: {
    dot: 'bg-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-300',
  },
  URGENT: {
    dot: 'bg-red-500',
    bg: 'bg-red-50 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
  },
};

function PriorityPicker({
  value,
  onChange,
  label,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  disabled?: boolean;
}) {
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

  const priorities = [
    { value: 'NONE', label: t.tasks.priority_NONE },
    { value: 'LOW', label: t.tasks.priority_LOW },
    { value: 'MEDIUM', label: t.tasks.priority_MEDIUM },
    { value: 'HIGH', label: t.tasks.priority_HIGH },
    { value: 'URGENT', label: t.tasks.priority_URGENT },
  ];

  const current = priorities.find((p) => p.value === value) ?? priorities[0];
  const colors = PRIORITY_COLORS[value] ?? PRIORITY_COLORS.NONE;

  return (
    <div ref={ref} className="flex-1 relative">
      <p className="block text-sm font-medium text-foreground mb-1">{label}</p>
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          `w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium ${colors.bg} ${colors.text} transition-colors`,
          disabled ? 'cursor-default opacity-70' : '',
        )}
      >
        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${colors.dot}`} />
        <span className="flex-1 text-left">{current.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-full bg-card rounded-2xl shadow-lg border border-border py-1 z-50">
          {priorities.map((p) => {
            const c = PRIORITY_COLORS[p.value];
            return (
              <button
                key={p.value}
                onClick={() => {
                  onChange(p.value);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-secondary transition-colors"
              >
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${c.dot}`} />
                <span className={`${c.text} font-medium`}>{p.label}</span>
                {value === p.value && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LabelPicker({
  taskId,
  boardPath,
  currentLabels,
  canEdit = true,
}: {
  taskId: string;
  boardPath: BoardPath;
  currentLabels: Array<{ id: string; label: { id: string; name: string; color: string } }>;
  canEdit?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: projectLabels } = useProjectLabels(boardPath.workspaceSlug, boardPath.projectId);
  const addLabel = useAddLabel(boardPath, taskId);
  const removeLabel = useRemoveLabel(boardPath, taskId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const attachedIds = new Set(currentLabels.map((tl) => tl.label.id));

  const toggle = (labelId: string) => {
    if (attachedIds.has(labelId)) removeLabel.mutate(labelId);
    else addLabel.mutate(labelId);
  };

  return (
    <div ref={ref} className="relative">
      <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
        <Tag className="h-3 w-3" /> {t.tasks.labels}
      </p>
      <div className="flex items-center gap-1 flex-wrap min-h-[28px]">
        {currentLabels.map(({ id, label }) => (
          <span
            key={id}
            className={cn(
              'group relative flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white',
              canEdit ? 'cursor-pointer' : '',
            )}
            style={{ backgroundColor: label.color }}
            onClick={() => canEdit && removeLabel.mutate(label.id)}
          >
            {label.name}
            {canEdit && (
              <X className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </span>
        ))}
        {currentLabels.length === 0 && (
          <span className="text-sm text-muted-foreground">{t.labels.noLabels}</span>
        )}
        {canEdit && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="w-7 h-7 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors ml-1"
            title={t.labels.addLabel}
          >
            <Tag className="h-3 w-3" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-card rounded-2xl shadow-lg border border-border py-1 z-50">
          {projectLabels?.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">{t.labels.empty}</p>
          )}
          {projectLabels?.map((label) => {
            const isAttached = attachedIds.has(label.id);
            return (
              <button
                key={label.id}
                onClick={() => toggle(label.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-secondary transition-colors"
              >
                <span
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: label.color }}
                />
                <span className="flex-1 text-left text-foreground">{label.name}</span>
                {isAttached && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  boardPath: BoardPath;
  initialTask?: Task;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canComment?: boolean;
}

function CommentItem({
  comment,
  boardPath,
  taskId,
}: {
  comment: {
    id: string;
    content: string;
    createdAt: string;
    author: { id: string; name: string; avatar: string | null };
  };
  boardPath: BoardPath;
  taskId: string;
}) {
  const { user } = useAuthStore();
  const deleteComment = useDeleteComment(boardPath, taskId);
  return (
    <div className="flex gap-3">
      <Avatar name={comment.author.name} src={comment.author.avatar} size="sm" />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{comment.author.name}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {formatRelativeDate(comment.createdAt)}
            </span>
            {user?.id === comment.author.id && (
              <button
                onClick={() => deleteComment.mutate(comment.id)}
                className="text-muted-foreground hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{comment.content}</p>
      </div>
    </div>
  );
}

function AssigneePicker({
  taskId,
  boardPath,
  currentAssignees,
  canEdit = true,
}: {
  taskId: string;
  boardPath: BoardPath;
  currentAssignees: Array<{
    id: string;
    user: { id: string; name: string; avatar: string | null };
  }>;
  canEdit?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: members } = useWorkspaceMembers(boardPath.workspaceSlug);
  const addAssignee = useAddAssignee(boardPath, taskId);
  const removeAssignee = useRemoveAssignee(boardPath, taskId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const assignedIds = new Set(currentAssignees.map((a) => a.user.id));

  const toggle = (userId: string) => {
    if (assignedIds.has(userId)) removeAssignee.mutate(userId);
    else addAssignee.mutate(userId);
  };

  return (
    <div ref={ref} className="relative">
      <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
        <User className="h-3 w-3" /> {t.tasks.assignees}
      </p>
      <div className="flex items-center gap-1 flex-wrap min-h-[28px]">
        {currentAssignees.map(({ user: u, id }) => (
          <div key={id} className="group relative">
            <Avatar name={u.name} src={u.avatar} size="sm" />
            {canEdit && (
              <button
                onClick={() => removeAssignee.mutate(u.id)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hidden group-hover:flex items-center justify-center"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        ))}
        {currentAssignees.length === 0 && (
          <span className="text-sm text-muted-foreground">{t.tasks.unassigned}</span>
        )}
        {canEdit && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="w-7 h-7 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors ml-1"
          >
            <UserPlus className="h-3 w-3" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-card rounded-2xl shadow-lg border border-border py-1 z-50">
          {members?.map((m) => {
            const isAssigned = assignedIds.has(m.user.id);
            return (
              <button
                key={m.id}
                onClick={() => toggle(m.user.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
              >
                <Avatar name={m.user.name} src={m.user.avatar} size="sm" />
                <span className="flex-1 text-left truncate">{m.user.name}</span>
                {isAssigned && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
              </button>
            );
          })}
          {!members?.length && (
            <p className="px-3 py-2 text-xs text-muted-foreground">{t.members.empty}</p>
          )}
        </div>
      )}
    </div>
  );
}

function SubtasksTab({
  boardPath,
  taskId,
  canEdit,
}: {
  boardPath: BoardPath;
  taskId: string;
  canEdit: boolean;
}) {
  const { data: subtasks, isLoading } = useSubtasks(boardPath, taskId);
  const createSubtask = useCreateSubtask(boardPath, taskId);
  const updateSubtask = useUpdateSubtask(boardPath, taskId);
  const deleteSubtask = useDeleteSubtask(boardPath, taskId);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const handleAdd = () => {
    if (!newTitle.trim()) {
      setAdding(false);
      return;
    }
    createSubtask.mutate(newTitle.trim(), {
      onSuccess: () => {
        setNewTitle('');
        setAdding(false);
      },
    });
  };

  const done = subtasks?.filter((s) => s.completed).length ?? 0;
  const total = subtasks?.length ?? 0;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  if (isLoading)
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );

  return (
    <div className="space-y-2">
      {total > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {done}/{total}
          </span>
        </div>
      )}

      {subtasks?.map((subtask) => (
        <div key={subtask.id} className="group flex items-center gap-2 py-1">
          <button
            onClick={() =>
              canEdit &&
              updateSubtask.mutate({
                subtaskId: subtask.id,
                data: { completed: !subtask.completed },
              })
            }
            className={cn(
              'h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors',
              subtask.completed ? 'bg-primary border-primary' : 'border-border',
              canEdit ? 'cursor-pointer' : 'cursor-default',
            )}
          >
            {subtask.completed && <Check className="h-2.5 w-2.5 text-white" />}
          </button>
          <span
            className={cn(
              'flex-1 text-sm',
              subtask.completed ? 'line-through text-muted-foreground' : 'text-foreground',
            )}
          >
            {subtask.title}
          </span>
          {canEdit && (
            <button
              onClick={() => deleteSubtask.mutate(subtask.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}

      {canEdit &&
        (adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd();
            }}
            className="flex items-center gap-2 mt-1"
          >
            <div className="h-4 w-4 rounded border border-border flex-shrink-0" />
            <input
              ref={inputRef}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setAdding(false);
                  setNewTitle('');
                }
              }}
              placeholder="Subtask title…"
              className="flex-1 text-sm bg-transparent border-b border-primary outline-none py-0.5 text-foreground placeholder-muted-foreground"
            />
            <button
              type="submit"
              className="p-1.5 text-primary flex-shrink-0 hover:bg-primary/10 rounded transition-colors"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setNewTitle('');
              }}
              className="p-1.5 text-muted-foreground flex-shrink-0 hover:bg-secondary rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-1 py-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add subtask
          </button>
        ))}
    </div>
  );
}

function AttachmentsTab({
  boardPath,
  taskId,
  canEdit,
}: {
  boardPath: BoardPath;
  taskId: string;
  canEdit: boolean;
}) {
  const { data: attachments, isLoading } = useAttachments(boardPath, taskId);
  const uploadAttachment = useUploadAttachment(boardPath, taskId);
  const deleteAttachment = useDeleteAttachment(boardPath, taskId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAttachment.mutate(file);
    e.target.value = '';
  };

  const handleDownload = async (attachmentId: string, name: string) => {
    try {
      const att = await taskApi.getAttachment(boardPath, taskId, attachmentId);
      if (!att.data) return;
      const a = document.createElement('a');
      a.href = att.data;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {}
  };

  if (isLoading)
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );

  return (
    <div className="space-y-2">
      {attachments?.map((att) => (
        <div
          key={att.id}
          className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card"
        >
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileIcon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{att.name}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(att.size)}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleDownload(att.id, att.name)}
              className="p-2 text-muted-foreground hover:text-primary rounded-lg transition-colors"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => deleteAttachment.mutate(att.id)}
                className="p-2 text-muted-foreground hover:text-red-400 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ))}

      {!attachments?.length && (
        <p className="text-sm text-muted-foreground text-center py-4">No attachments yet</p>
      )}

      {canEdit && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept="*/*"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadAttachment.isPending}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-1 disabled:opacity-50"
          >
            {uploadAttachment.isPending ? (
              <>
                <Spinner />
                <span className="ml-1">Uploading…</span>
              </>
            ) : (
              <>
                <Paperclip className="h-3.5 w-3.5" /> Attach file
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}

function ActivityTab({ boardPath, taskId }: { boardPath: BoardPath; taskId: string }) {
  const t = useT();
  const { data: activities, isLoading } = useTaskActivity(boardPath, taskId);

  const getActionText = (action: string, newValue: string | null) => {
    const key = action as keyof typeof t.activity;
    const label = t.activity[key] ?? action;
    if (
      newValue &&
      [
        'changed_title',
        'changed_status',
        'changed_priority',
        'changed_due_date',
        'added_assignee',
        'removed_assignee',
        'added_label',
        'removed_label',
      ].includes(action)
    ) {
      return `${label} "${newValue}"`;
    }
    return label;
  };

  if (isLoading)
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );

  if (!activities?.length)
    return <div className="py-8 text-center text-sm text-muted-foreground">{t.activity.empty}</div>;

  return (
    <div className="space-y-3">
      {activities.map((act) => (
        <div key={act.id} className="flex gap-3 items-start">
          {act.user ? (
            <Avatar name={act.user.name} src={act.user.avatar} size="sm" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground">
              <span className="font-medium">{act.user?.name ?? t.tasks.systemUser}</span>{' '}
              <span className="text-muted-foreground">
                {getActionText(act.action, act.newValue)}
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatRelativeDate(act.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TaskDetailModal({
  isOpen,
  onClose,
  taskId,
  boardPath,
  initialTask,
  onDelete,
  canEdit = true,
  canDelete = true,
  canComment = true,
}: TaskDetailModalProps) {
  const t = useT();
  const { data: fetchedTask } = useTask(boardPath, taskId);
  // Show initialTask (from card) immediately; replace with full server data once loaded
  const task = fetchedTask ?? initialTask;
  const { data: comments } = useTaskComments(boardPath, taskId);
  const updateTask = useUpdateTask(boardPath);
  const deleteTask = useDeleteTask(boardPath);
  const addComment = useAddComment(boardPath, taskId);
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<
    'details' | 'subtasks' | 'attachments' | 'comments' | 'activity'
  >('details');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [commentText, setCommentText] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingDueDate, setAddingDueDate] = useState(false);
  const { data: subtasks } = useSubtasks(boardPath, taskId);
  const { data: attachmentsList } = useAttachments(boardPath, taskId);

  const statusOptions = [
    { value: 'TODO', label: t.tasks.status_TODO },
    { value: 'IN_PROGRESS', label: t.tasks.status_IN_PROGRESS },
    { value: 'IN_REVIEW', label: t.tasks.status_IN_REVIEW },
    { value: 'DONE', label: t.tasks.status_DONE },
  ];

  const handleTitleSave = () => {
    if (titleValue.trim() && titleValue !== task?.title)
      updateTask.mutate({ taskId, data: { title: titleValue.trim() } });
    setEditingTitle(false);
  };

  const handleDescSave = () => {
    updateTask.mutate({ taskId, data: { description: descValue.trim() || (null as never) } });
    setEditingDesc(false);
  };

  const handleDelete = () => {
    deleteTask.mutate(taskId, {
      onSuccess: () => {
        onClose();
        onDelete?.();
      },
    });
    setConfirmDelete(false);
  };

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    addComment.mutate(commentText.trim(), { onSuccess: () => setCommentText('') });
  };

  const dueDateValue = task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';

  const doneSubtasks = subtasks?.filter((s) => s.completed).length ?? 0;
  const totalSubtasks = subtasks?.length ?? task?._count?.subtasks ?? 0;

  const tabs = [
    { id: 'details' as const, label: t.tasks.description, icon: Edit3 },
    {
      id: 'subtasks' as const,
      label: t.tasks.subtasks,
      icon: CheckSquare,
      count: totalSubtasks > 0 ? `${doneSubtasks}/${totalSubtasks}` : undefined,
    },
    {
      id: 'attachments' as const,
      label: t.tasks.files,
      icon: Paperclip,
      count: attachmentsList?.length ?? task?._count?.attachments,
    },
    {
      id: 'comments' as const,
      label: t.tasks.comments,
      icon: MessageSquare,
      count: comments?.length,
    },
    { id: 'activity' as const, label: t.activity.title, icon: Activity },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.tasks.detail} size="xl">
      {!task ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-5 overflow-x-hidden pr-1">
          {/* Viewer banner */}
          {!canEdit && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs">
              <Eye className="h-3.5 w-3.5 flex-shrink-0" />
              {t.members.viewerReadOnly}
            </div>
          )}

          {/* Title */}
          <div className="group">
            {canEdit && editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  className="flex-1 text-xl font-semibold border-b-2 border-primary outline-none py-1 bg-transparent text-foreground"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSave();
                    if (e.key === 'Escape') setEditingTitle(false);
                  }}
                />
                <button onClick={handleTitleSave} className="text-green-500">
                  <Check className="h-5 w-5" />
                </button>
                <button onClick={() => setEditingTitle(false)} className="text-muted-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div
                className={cn(
                  'flex items-start justify-between rounded -mx-1 px-1 py-0.5',
                  canEdit ? 'cursor-pointer hover:bg-secondary/50' : '',
                )}
                onClick={() => {
                  if (canEdit) {
                    setTitleValue(task.title);
                    setEditingTitle(true);
                  }
                }}
              >
                <h2 className="text-xl font-semibold text-foreground">{task.title}</h2>
                {canEdit && (
                  <Edit3 className="h-4 w-4 text-muted-foreground/60 group-hover:text-muted-foreground flex-shrink-0 mt-1" />
                )}
              </div>
            )}
          </div>

          {/* Status + Priority */}
          <div className="flex flex-col xs:flex-row gap-3 sm:gap-4">
            <Select
              label={t.tasks.status}
              options={statusOptions}
              value={task.status}
              onChange={(e) =>
                canEdit && updateTask.mutate({ taskId, data: { status: e.target.value as never } })
              }
              className="flex-1"
              disabled={!canEdit}
            />
            <PriorityPicker
              label={t.tasks.priority}
              value={task.priority}
              onChange={(v) => updateTask.mutate({ taskId, data: { priority: v as never } })}
              disabled={!canEdit}
            />
          </div>

          {/* Due date + Assignees + Labels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-3 border-y border-border">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {t.tasks.dueDate}
              </p>
              <div className="relative">
                {!dueDateValue && !addingDueDate ? (
                  // Plain clickable label instead of an <input type="date"> — avoids fighting the
                  // browser's own "dd.mm.yyyy" placeholder segments, which overlapped this text
                  // when it was drawn on top of an (invisible) native date input.
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => canEdit && setAddingDueDate(true)}
                    className={cn(
                      'text-sm text-muted-foreground bg-transparent border border-border rounded-lg px-2.5 py-1.5 w-full text-left',
                      canEdit
                        ? 'cursor-pointer hover:border-foreground/30'
                        : 'opacity-70 cursor-default',
                    )}
                  >
                    {t.tasks.noDueDate}
                  </button>
                ) : (
                  <input
                    type="date"
                    value={dueDateValue}
                    disabled={!canEdit}
                    autoFocus={addingDueDate}
                    onChange={(e) => {
                      if (!canEdit) return;
                      updateTask.mutate({
                        taskId,
                        data: {
                          dueDate: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : (null as never),
                        },
                      });
                      if (!e.target.value) setAddingDueDate(false);
                    }}
                    onBlur={() => {
                      if (!dueDateValue) setAddingDueDate(false);
                    }}
                    className={cn(
                      'text-sm text-foreground bg-transparent border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring w-full dark:color-scheme-dark',
                      canEdit ? 'cursor-pointer' : 'opacity-70 cursor-default',
                    )}
                  />
                )}
              </div>
            </div>
            <AssigneePicker
              taskId={taskId}
              boardPath={boardPath}
              currentAssignees={task.assignees as never}
              canEdit={canEdit}
            />
          </div>

          {/* Labels */}
          <LabelPicker
            taskId={taskId}
            boardPath={boardPath}
            currentLabels={task.labels as never}
            canEdit={canEdit}
          />

          {/* Tabs */}
          <div className="border-b border-border">
            <div
              className="flex gap-0 overflow-x-auto [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: 'none' }}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {tab.count !== undefined && tab.count !== 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-secondary text-secondary-foreground">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          {activeTab === 'details' && (
            <div>
              {canEdit && editingDesc ? (
                <div>
                  <textarea
                    autoFocus
                    rows={4}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring bg-card text-foreground"
                    value={descValue}
                    onChange={(e) => setDescValue(e.target.value)}
                  />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={handleDescSave} isLoading={updateTask.isPending}>
                      {t.common.save}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingDesc(false)}>
                      {t.common.cancel}
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    'text-sm text-foreground rounded p-2 -mx-2 min-h-[40px]',
                    canEdit ? 'cursor-pointer hover:bg-secondary/50' : '',
                  )}
                  onClick={() => {
                    if (canEdit) {
                      setDescValue(task.description ?? '');
                      setEditingDesc(true);
                    }
                  }}
                >
                  {task.description ?? (
                    <span className="text-muted-foreground italic">{t.tasks.noDesc}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'comments' && (
            <div>
              <div className="space-y-4 mb-4">
                {comments?.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment as never}
                    boardPath={boardPath}
                    taskId={taskId}
                  />
                ))}
                {!comments?.length && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t.tasks.commentPlaceholder}
                  </p>
                )}
              </div>
              {canComment ? (
                <div className="flex gap-2">
                  <Avatar name={user?.name ?? 'U'} src={user?.avatar} size="sm" />
                  <div className="flex-1">
                    <textarea
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring bg-card text-foreground placeholder-muted-foreground"
                      rows={2}
                      placeholder={t.tasks.commentPlaceholder}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) handleAddComment();
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={handleAddComment}
                      isLoading={addComment.isPending}
                      className="mt-2"
                    >
                      {t.tasks.comment}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  {t.members.viewerReadOnly}
                </p>
              )}
            </div>
          )}

          {activeTab === 'subtasks' && (
            <SubtasksTab boardPath={boardPath} taskId={taskId} canEdit={canEdit} />
          )}
          {activeTab === 'attachments' && (
            <AttachmentsTab boardPath={boardPath} taskId={taskId} canEdit={canEdit} />
          )}
          {activeTab === 'activity' && <ActivityTab boardPath={boardPath} taskId={taskId} />}

          {/* Footer */}
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {t.tasks.created} {formatRelativeDate(task.createdAt)}
            </p>
            {canDelete && !confirmDelete && (
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4 mr-1" /> {t.tasks.delete}
              </Button>
            )}
            {canDelete && confirmDelete && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 dark:text-red-400">
                  {t.tasks.deleteConfirm}
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  isLoading={deleteTask.isPending}
                >
                  {t.common.confirm}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  {t.common.cancel}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

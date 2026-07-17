'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useCreateTask } from '../hooks/useTask';
import { getErrorMessage } from '@/lib/utils';
import { TaskList } from '@/types';
import { useT } from '@/lib/i18n/useT';

type FormValues = {
  title: string;
  description?: string;
  priority: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  taskListId: string;
};

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskLists: TaskList[];
  defaultTaskListId?: string;
  boardPath: { workspaceSlug: string; projectId: string; boardId: string };
}

export function CreateTaskModal({
  isOpen,
  onClose,
  taskLists,
  defaultTaskListId,
  boardPath,
}: CreateTaskModalProps) {
  const t = useT();
  const schema = useMemo(
    () =>
      z.object({
        title: z.string().min(1, t.validation.titleRequired).max(255),
        description: z.string().optional(),
        priority: z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT']),
        taskListId: z.string().min(1, t.validation.columnRequired),
      }),
    [t],
  );
  const createTask = useCreateTask(boardPath);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'NONE', taskListId: defaultTaskListId },
  });

  // The modal is mounted once for the board's whole lifetime (only its inner <Modal>
  // conditionally renders), so react-hook-form's defaultValues only ever apply at that
  // one mount — reopening with a different defaultTaskListId (e.g. a different lane's
  // "+" button) silently kept whichever list was selected the very first time. Reset
  // explicitly whenever the modal (re)opens so the destination list actually follows
  // which lane the user meant.
  useEffect(() => {
    if (isOpen)
      reset({ title: '', description: '', priority: 'NONE', taskListId: defaultTaskListId });
  }, [isOpen, defaultTaskListId, reset]);

  const priorityOptions = [
    { value: 'NONE', label: t.tasks.priority_NONE },
    { value: 'LOW', label: t.tasks.priority_LOW },
    { value: 'MEDIUM', label: t.tasks.priority_MEDIUM },
    { value: 'HIGH', label: t.tasks.priority_HIGH },
    { value: 'URGENT', label: t.tasks.priority_URGENT },
  ];

  const onSubmit = (data: FormValues) => {
    createTask.mutate(
      {
        taskListId: data.taskListId,
        data: { title: data.title, description: data.description, priority: data.priority },
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.tasks.create} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label={t.tasks.title}
          placeholder={t.tasks.titlePlaceholder}
          error={errors.title?.message}
          {...register('title')}
        />
        <Textarea
          label={t.tasks.description}
          placeholder={t.tasks.descPlaceholder}
          {...register('description')}
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t.tasks.column}
            options={taskLists.map((tl) => ({ value: tl.id, label: tl.name }))}
            error={errors.taskListId?.message}
            {...register('taskListId')}
          />
          <Select label={t.tasks.priority} options={priorityOptions} {...register('priority')} />
        </div>
        {createTask.error && (
          <p className="text-sm text-red-600">{getErrorMessage(createTask.error)}</p>
        )}
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose} type="button">
            {t.common.cancel}
          </Button>
          <Button type="submit" isLoading={createTask.isPending}>
            {t.tasks.create}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

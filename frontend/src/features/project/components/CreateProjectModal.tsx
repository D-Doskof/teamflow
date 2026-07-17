'use client';

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { useCreateProject } from '../hooks/useProject';
import { getErrorMessage } from '@/lib/utils';
import { useT } from '@/lib/i18n/useT';

type FormValues = { name: string; description?: string };

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
}

export function CreateProjectModal({ isOpen, onClose, workspaceSlug }: CreateProjectModalProps) {
  const t = useT();
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(2, t.validation.nameMin2).max(100),
        description: z.string().optional(),
      }),
    [t],
  );
  const createProject = useCreateProject(workspaceSlug);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormValues) => {
    createProject.mutate(
      { name: data.name, description: data.description },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.projects.modal.title} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label={t.projects.modal.name}
          placeholder={t.projects.modal.namePlaceholder}
          error={errors.name?.message}
          {...register('name')}
        />
        <Textarea
          label={t.projects.modal.desc}
          placeholder={t.projects.modal.descPlaceholder}
          {...register('description')}
        />
        {createProject.error && (
          <p className="text-sm text-destructive">{getErrorMessage(createProject.error)}</p>
        )}
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose} type="button">
            {t.common.cancel}
          </Button>
          <Button type="submit" isLoading={createProject.isPending}>
            {t.projects.modal.submit}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useCreateBoard } from '@/features/board/hooks/useBoard';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/utils';
import { Board } from '@/types';
import { useT } from '@/lib/i18n/useT';

export function CreateBoardModal({
  isOpen,
  onClose,
  workspaceSlug,
  projectId,
}: {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projectId: string;
}) {
  const t = useT();
  const createBoard = useCreateBoard(workspaceSlug, projectId);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{
    name: string;
    description?: string;
  }>();

  const onSubmit = (data: { name: string; description?: string }) => {
    createBoard.mutate(data, {
      onSuccess: (board: Board) => {
        reset();
        onClose();
        router.push(`/workspaces/${workspaceSlug}/projects/${projectId}/boards/${board.id}`);
      },
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.boards.modal.title}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label={t.boards.modal.name}
          placeholder={t.boards.modal.namePlaceholder}
          error={errors.name?.message}
          {...register('name', { required: t.validation.required })}
        />
        <Input
          label={t.boards.modal.desc}
          placeholder={t.boards.modal.descPlaceholder}
          {...register('description')}
        />
        {createBoard.error && (
          <p className="text-sm text-destructive">{getErrorMessage(createBoard.error)}</p>
        )}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} type="button">
            {t.common.cancel}
          </Button>
          <Button type="submit" isLoading={createBoard.isPending}>
            {t.boards.modal.submit}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

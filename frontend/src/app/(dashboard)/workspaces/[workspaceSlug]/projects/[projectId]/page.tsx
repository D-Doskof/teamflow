'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, Kanban } from 'lucide-react';
import { useBoards } from '@/features/board/hooks/useBoard';
import { CreateBoardModal } from '@/features/board/components/CreateBoardModal';
import { Button } from '@/components/ui/Button';
import { PageLoader } from '@/components/ui/Spinner';
import { useT } from '@/lib/i18n/useT';

export default function ProjectPage() {
  const t = useT();
  const { workspaceSlug, projectId } = useParams<{
    workspaceSlug: string;
    projectId: string;
  }>();
  const router = useRouter();
  const { data: boards, isLoading } = useBoards(workspaceSlug, projectId);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (boards && boards.length > 0) {
      router.replace(`/workspaces/${workspaceSlug}/projects/${projectId}/boards/${boards[0].id}`);
    }
  }, [boards, workspaceSlug, projectId, router]);

  if (isLoading || (boards && boards.length > 0)) return <PageLoader />;

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] p-8">
      <Kanban className="h-16 w-16 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold text-foreground mb-2">{t.boards.empty.title}</h2>
      <p className="text-muted-foreground mb-6">{t.boards.empty.subtitle}</p>
      <Button onClick={() => setCreateOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        {t.boards.empty.action}
      </Button>

      <CreateBoardModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
      />
    </div>
  );
}

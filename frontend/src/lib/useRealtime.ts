'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { taskKeys } from '@/features/task/hooks/useTask';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

type BoardChangePayload = {
  workspaceSlug: string;
  projectId: string;
  boardId: string;
  taskId: string | null;
};

export function useRealtime(enabled: boolean) {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    function connect() {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) return;

      const url = `${API_URL}/events?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener('board:change', (e) => {
        try {
          const { workspaceSlug, projectId, boardId }: BoardChangePayload = JSON.parse(e.data);
          const path = { workspaceSlug, projectId, boardId };
          queryClient.invalidateQueries({ queryKey: taskKeys.board(path) });
        } catch {}
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        // Reconnect after 4 seconds
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(connect, 4_000);
      };
    }

    connect();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [enabled, queryClient]);
}

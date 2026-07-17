'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Loader2, FolderKanban, Kanban, CheckSquare } from 'lucide-react';
import { searchApi, SearchResults } from '../api/search.api';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/utils';

const PRIORITY_DOT: Record<string, string> = {
  NONE: 'bg-gray-400',
  LOW: 'bg-blue-400',
  MEDIUM: 'bg-yellow-400',
  HIGH: 'bg-orange-400',
  URGENT: 'bg-red-500',
};

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await searchApi.search(q.trim());
      setResults(data);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 300);
  };

  const navigate = (href: string) => {
    router.push(href);
    onClose();
  };

  const hasResults =
    results && results.tasks.length + results.projects.length + results.boards.length > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl mx-4 bg-card rounded-2xl shadow-2xl overflow-hidden border border-border">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          {loading ? (
            <Loader2 className="h-5 w-5 text-muted-foreground animate-spin flex-shrink-0" />
          ) : (
            <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder={t.search.placeholder}
            className="flex-1 text-base bg-transparent outline-none text-foreground placeholder-muted-foreground"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setResults(null);
                inputRef.current?.focus();
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {!query && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {t.search.typeToSearch}
            </div>
          )}

          {query && query.trim().length < 2 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {t.search.typeToSearch}
            </div>
          )}

          {query.trim().length >= 2 && !loading && results && !hasResults && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {t.search.noResults} <span className="font-medium text-foreground">"{query}"</span>
            </div>
          )}

          {hasResults && (
            <div className="p-2 space-y-1">
              {results.tasks.length > 0 && (
                <div>
                  <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t.search.tasks}
                  </p>
                  {results.tasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() =>
                        navigate(
                          `/workspaces/${task.workspaceSlug}/projects/${task.projectId}/boards/${task.boardId}`,
                        )
                      }
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary text-left transition-colors"
                    >
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full flex-shrink-0 mt-0.5',
                          PRIORITY_DOT[task.priority] ?? 'bg-muted-foreground',
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {task.projectName} · {task.boardName}
                        </p>
                      </div>
                      <CheckSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {results.projects.length > 0 && (
                <div>
                  <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t.search.projects}
                  </p>
                  {results.projects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() =>
                        navigate(`/workspaces/${proj.workspace?.slug}/projects/${proj.id}`)
                      }
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary text-left transition-colors"
                    >
                      <div
                        className="h-6 w-6 rounded-md flex-shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: proj.color ?? '#6366f1' }}
                      >
                        <FolderKanban className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{proj.name}</p>
                        {proj.workspace && (
                          <p className="text-xs text-muted-foreground truncate">
                            {proj.workspace.name}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.boards.length > 0 && (
                <div>
                  <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t.search.boards}
                  </p>
                  {results.boards.map((board) => (
                    <button
                      key={board.id}
                      onClick={() =>
                        navigate(
                          `/workspaces/${board.workspaceSlug}/projects/${board.projectId}/boards/${board.id}`,
                        )
                      }
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary text-left transition-colors"
                    >
                      <Kanban className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{board.name}</p>
                        {board.projectName && (
                          <p className="text-xs text-muted-foreground truncate">
                            {board.projectName}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
          {t.search.hint}
        </div>
      </div>
    </div>
  );
}

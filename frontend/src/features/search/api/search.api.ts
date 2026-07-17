import { api } from '@/lib/axios';
import { ApiResponse } from '@/types';

export interface SearchResults {
  tasks: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    boardId: string;
    projectId: string;
    workspaceSlug: string;
    projectName: string;
    boardName: string;
  }>;
  projects: Array<{
    id: string;
    name: string;
    color: string | null;
    workspace: { id: string; name: string; slug: string } | null;
  }>;
  boards: Array<{
    id: string;
    name: string;
    projectId: string;
    projectName: string | undefined;
    workspaceSlug: string | undefined;
  }>;
}

export const searchApi = {
  search: (q: string) =>
    api.get<ApiResponse<SearchResults>>('/search', { params: { q } }).then((r) => r.data.data!),
};

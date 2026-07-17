import { ISearchRepository } from '../repositories/search.repository';

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

const EMPTY_RESULTS: SearchResults = { tasks: [], projects: [], boards: [] };

// Same 2-char floor the frontend applies (SearchModal's `doSearch`) — kept here too so a
// direct API call can't force a `contains: ''` full-table scan.
const MIN_QUERY_LENGTH = 2;

export interface ISearchService {
  search(userId: string, query: string): Promise<SearchResults>;
}

export class SearchService implements ISearchService {
  constructor(private readonly searchRepository: ISearchRepository) {}

  async search(userId: string, query: string): Promise<SearchResults> {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) return EMPTY_RESULTS;

    const [tasks, projects, boards] = await Promise.all([
      this.searchRepository.searchTasks(userId, q),
      this.searchRepository.searchProjects(userId, q),
      this.searchRepository.searchBoards(userId, q),
    ]);

    return {
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        status: t.status,
        boardId: t.taskList.boardId,
        projectId: t.taskList.board.projectId,
        workspaceSlug: t.taskList.board.project.workspace.slug,
        projectName: t.taskList.board.project.name,
        boardName: t.taskList.board.name,
      })),
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        workspace: p.workspace,
      })),
      boards: boards.map((b) => ({
        id: b.id,
        name: b.name,
        projectId: b.projectId,
        projectName: b.project?.name,
        workspaceSlug: b.project?.workspace?.slug,
      })),
    };
  }
}

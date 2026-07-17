import { describe, it, expect, beforeEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { SearchService } from './search.service';
import { ISearchRepository } from '../repositories/search.repository';

let searchRepository: MockProxy<ISearchRepository>;
let searchService: SearchService;

beforeEach(() => {
  searchRepository = mock<ISearchRepository>();
  searchService = new SearchService(searchRepository);
});

// Regression coverage for the "search doesn't work" report: the backend route/service/
// repository didn't exist at all (frontend was fully scaffolded against a 404). Locks in
// the two things a caller actually depends on: the < 2 char short-circuit (mirrors the
// frontend's own debounce guard in SearchModal, so a stray direct API call can't force a
// `contains: ''` scan) and that raw Prisma rows get flattened into the exact shape
// frontend/src/features/search/api/search.api.ts's SearchResults type expects.
describe('searchService.search', () => {
  it('short-circuits queries under 2 characters without hitting the repository', async () => {
    const results = await searchService.search('user_1', ' a ');

    expect(results).toEqual({ tasks: [], projects: [], boards: [] });
    expect(searchRepository.searchTasks).not.toHaveBeenCalled();
    expect(searchRepository.searchProjects).not.toHaveBeenCalled();
    expect(searchRepository.searchBoards).not.toHaveBeenCalled();
  });

  it('flattens nested task/project/board rows into the flat shape the frontend expects', async () => {
    searchRepository.searchTasks.mockResolvedValue([
      {
        id: 'task_1',
        title: 'Fuel the Rocket',
        priority: 'HIGH',
        status: 'TODO',
        taskList: {
          boardId: 'board_1',
          board: {
            name: 'Launch Board',
            projectId: 'proj_1',
            project: { name: 'Rocket Project', workspace: { slug: 'acme' } },
          },
        },
      },
    ] as never);
    searchRepository.searchProjects.mockResolvedValue([
      {
        id: 'proj_1',
        name: 'Rocket Project',
        color: '#fff',
        workspace: { id: 'ws_1', name: 'Acme', slug: 'acme' },
      },
    ] as never);
    searchRepository.searchBoards.mockResolvedValue([
      {
        id: 'board_1',
        name: 'Launch Board',
        projectId: 'proj_1',
        project: { name: 'Rocket Project', workspace: { slug: 'acme' } },
      },
    ] as never);

    const results = await searchService.search('user_1', 'rocket');

    expect(results.tasks).toEqual([
      {
        id: 'task_1',
        title: 'Fuel the Rocket',
        priority: 'HIGH',
        status: 'TODO',
        boardId: 'board_1',
        projectId: 'proj_1',
        workspaceSlug: 'acme',
        projectName: 'Rocket Project',
        boardName: 'Launch Board',
      },
    ]);
    expect(results.projects).toEqual([
      {
        id: 'proj_1',
        name: 'Rocket Project',
        color: '#fff',
        workspace: { id: 'ws_1', name: 'Acme', slug: 'acme' },
      },
    ]);
    expect(results.boards).toEqual([
      {
        id: 'board_1',
        name: 'Launch Board',
        projectId: 'proj_1',
        projectName: 'Rocket Project',
        workspaceSlug: 'acme',
      },
    ]);
  });
});

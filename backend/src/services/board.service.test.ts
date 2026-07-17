import { describe, it, expect, beforeEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { BoardService } from './board.service';
import { IBoardRepository } from '../repositories/board.repository';
import { IProjectRepository } from '../repositories/project.repository';
import { IUserRepository } from '../repositories/user.repository';

let boardRepository: MockProxy<IBoardRepository>;
let projectRepository: MockProxy<IProjectRepository>;
let userRepository: MockProxy<IUserRepository>;
let boardService: BoardService;

beforeEach(() => {
  boardRepository = mock<IBoardRepository>();
  projectRepository = mock<IProjectRepository>();
  userRepository = mock<IUserRepository>();
  userRepository.findById.mockResolvedValue({ locale: 'ru' } as never);
  boardService = new BoardService(boardRepository, projectRepository, userRepository);
});

// Regression coverage: a brand-new board used to come back with zero task lists, forcing
// users to manually add every column via "Add column" before they could do anything with
// it. create() must now seed 3 default lists (in position order) whose names line up with
// KanbanBoard's inferStatus() keyword matching, so cards dropped there get TODO/IN_PROGRESS/
// DONE for free.
describe('boardService.create', () => {
  it('seeds 3 default task lists positioned 0/1/2 alongside the board', async () => {
    projectRepository.findById.mockResolvedValue({ id: 'proj_1' } as never);
    boardRepository.create.mockResolvedValue({ id: 'board_1', name: 'Sprint 1' } as never);

    await boardService.create('proj_1', { name: 'Sprint 1' } as never, 'user_1');

    expect(boardRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Sprint 1',
        taskLists: {
          create: [
            { name: 'Сделать', position: 0 },
            { name: 'В работе', position: 1 },
            { name: 'Готово', position: 2 },
          ],
        },
      }),
    );
  });

  it("seeds default task lists in the creating user's own locale", async () => {
    projectRepository.findById.mockResolvedValue({ id: 'proj_1' } as never);
    boardRepository.create.mockResolvedValue({ id: 'board_1', name: 'Sprint 1' } as never);
    userRepository.findById.mockResolvedValue({ locale: 'en' } as never);

    await boardService.create('proj_1', { name: 'Sprint 1' } as never, 'user_1');

    expect(boardRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        taskLists: {
          create: [
            { name: 'To Do', position: 0 },
            { name: 'In Progress', position: 1 },
            { name: 'Done', position: 2 },
          ],
        },
      }),
    );
  });

  it('falls back to the default locale when the user has no locale set', async () => {
    projectRepository.findById.mockResolvedValue({ id: 'proj_1' } as never);
    boardRepository.create.mockResolvedValue({ id: 'board_1', name: 'Sprint 1' } as never);
    userRepository.findById.mockResolvedValue(null);

    await boardService.create('proj_1', { name: 'Sprint 1' } as never, 'user_1');

    expect(boardRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        taskLists: {
          create: [
            { name: 'To Do', position: 0 },
            { name: 'In Progress', position: 1 },
            { name: 'Done', position: 2 },
          ],
        },
      }),
    );
  });

  it('throws NotFoundError when the parent project does not exist', async () => {
    projectRepository.findById.mockResolvedValue(null);

    await expect(
      boardService.create('missing_proj', { name: 'X' } as never, 'user_1'),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(boardRepository.create).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { Role } from '@prisma/client';
import { WorkspaceService } from './workspace.service';
import { IWorkspaceRepository } from '../repositories/workspace.repository';
import { IUserRepository } from '../repositories/user.repository';

function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member_1',
    workspaceId: 'ws_1',
    userId: 'user_1',
    role: Role.MEMBER,
    joinedAt: new Date('2026-01-01'),
    customPermissions: null,
    ...overrides,
  } as never;
}

let workspaceRepository: MockProxy<IWorkspaceRepository>;
let userRepository: MockProxy<IUserRepository>;
let workspaceService: WorkspaceService;

beforeEach(() => {
  workspaceRepository = mock<IWorkspaceRepository>();
  userRepository = mock<IUserRepository>();
  workspaceService = new WorkspaceService(workspaceRepository, userRepository);
});

// Regression coverage for the 2026-07-02 bug: GET /workspaces/:slug/members returned raw member
// rows with no `permissions` field, so every user (including OWNERs) always saw `canEditContent`
// as false on the frontend, which made boards appear completely un-editable. `getMembers` and
// `getMyPermissions` must always attach a computed `permissions` object.
describe('workspaceService permission computation', () => {
  it.each([
    [
      Role.OWNER,
      {
        canEditContent: true,
        canDeleteContent: true,
        canManageMembers: true,
        canManageAdmins: true,
        canComment: true,
      },
    ],
    [
      Role.ADMIN,
      {
        canEditContent: true,
        canDeleteContent: true,
        canManageMembers: true,
        canManageAdmins: false,
        canComment: true,
      },
    ],
    [
      Role.MEMBER,
      {
        canEditContent: true,
        canDeleteContent: false,
        canManageMembers: false,
        canManageAdmins: false,
        canComment: true,
      },
    ],
    [
      Role.VIEWER,
      {
        canEditContent: false,
        canDeleteContent: false,
        canManageMembers: false,
        canManageAdmins: false,
        canComment: true,
      },
    ],
  ])('getMyPermissions computes the right flags for %s', async (role, expected) => {
    workspaceRepository.findMember.mockResolvedValue(makeMember({ role }));

    const perms = await workspaceService.getMyPermissions('ws_1', 'user_1');

    expect(perms).toEqual(expected);
  });

  it('rejects getMyPermissions for a non-member', async () => {
    workspaceRepository.findMember.mockResolvedValue(null);

    await expect(workspaceService.getMyPermissions('ws_1', 'stranger')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('getMembers attaches computed permissions to every member in the list', async () => {
    workspaceRepository.findMembers.mockResolvedValue([
      makeMember({ userId: 'owner_1', role: Role.OWNER }),
      makeMember({ userId: 'viewer_1', role: Role.VIEWER }),
    ] as never);

    const members = await workspaceService.getMembers('ws_1');

    expect(members).toHaveLength(2);
    expect(members[0].permissions.canEditContent).toBe(true);
    expect(members[1].permissions.canEditContent).toBe(false);
  });

  it('customPermissions overrides the role-derived defaults', async () => {
    workspaceRepository.findMember.mockResolvedValue(
      makeMember({ role: Role.VIEWER, customPermissions: { canEditContent: true } }),
    );

    const perms = await workspaceService.getMyPermissions('ws_1', 'user_1');

    // VIEWER defaults to canEditContent: false, but the explicit override wins.
    expect(perms.canEditContent).toBe(true);
    expect(perms.canDeleteContent).toBe(false);
  });
});

describe('workspaceService.updateMemberRole', () => {
  it('only the OWNER may change roles', async () => {
    workspaceRepository.findMember.mockResolvedValue(makeMember({ role: Role.ADMIN }));

    await expect(
      workspaceService.updateMemberRole('ws_1', 'target', { role: Role.VIEWER }, 'admin_1'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects changing your own role', async () => {
    workspaceRepository.findMember.mockResolvedValue(
      makeMember({ role: Role.OWNER, userId: 'owner_1' }),
    );

    await expect(
      workspaceService.updateMemberRole('ws_1', 'owner_1', { role: Role.MEMBER }, 'owner_1'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects promoting someone to OWNER', async () => {
    workspaceRepository.findMember
      .mockResolvedValueOnce(makeMember({ role: Role.OWNER, userId: 'owner_1' }))
      .mockResolvedValueOnce(makeMember({ role: Role.MEMBER, userId: 'target' }));

    await expect(
      workspaceService.updateMemberRole('ws_1', 'target', { role: Role.OWNER }, 'owner_1'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('workspaceService.removeMember', () => {
  it('the OWNER cannot remove themselves without transferring ownership first', async () => {
    workspaceRepository.findMember.mockResolvedValue(
      makeMember({ role: Role.OWNER, userId: 'owner_1' }),
    );

    await expect(workspaceService.removeMember('ws_1', 'owner_1', 'owner_1')).rejects.toMatchObject(
      { statusCode: 403 },
    );
  });

  it('a MEMBER cannot remove other members', async () => {
    workspaceRepository.findMember.mockResolvedValue(
      makeMember({ role: Role.MEMBER, userId: 'member_1' }),
    );

    await expect(workspaceService.removeMember('ws_1', 'other', 'member_1')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('the workspace owner can never be removed, even by an ADMIN', async () => {
    workspaceRepository.findMember
      .mockResolvedValueOnce(makeMember({ role: Role.ADMIN, userId: 'admin_1' }))
      .mockResolvedValueOnce(makeMember({ role: Role.OWNER, userId: 'owner_1' }));

    await expect(workspaceService.removeMember('ws_1', 'owner_1', 'admin_1')).rejects.toMatchObject(
      { statusCode: 403 },
    );
  });
});

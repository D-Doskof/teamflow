'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  UserPlus,
  Crown,
  Shield,
  User,
  Eye,
  Trash2,
  Mail,
  Clock,
  Settings2,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import {
  useWorkspaceMembers,
  useSendInvitation,
  useRemoveMember,
  useUpdateMemberRole,
  useWorkspaceInvitations,
  useCancelInvitation,
  useUpdateMemberPermissions,
} from '@/features/workspace/hooks/useWorkspace';
import { useAuthStore } from '@/store/auth.store';
import { useT } from '@/lib/i18n/useT';
import { formatRelativeDate } from '@/lib/utils';
import type { MemberPermissions, WorkspaceMember } from '@/types';

const ROLE_PERM_DEFAULTS: Record<string, MemberPermissions> = {
  OWNER: {
    canEditContent: true,
    canDeleteContent: true,
    canManageMembers: true,
    canManageAdmins: true,
    canComment: true,
  },
  ADMIN: {
    canEditContent: true,
    canDeleteContent: true,
    canManageMembers: true,
    canManageAdmins: false,
    canComment: true,
  },
  MEMBER: {
    canEditContent: true,
    canDeleteContent: false,
    canManageMembers: false,
    canManageAdmins: false,
    canComment: true,
  },
  VIEWER: {
    canEditContent: false,
    canDeleteContent: false,
    canManageMembers: false,
    canManageAdmins: false,
    canComment: false,
  },
};

function effectivePerms(member: WorkspaceMember): MemberPermissions {
  return member.permissions ?? ROLE_PERM_DEFAULTS[member.role] ?? ROLE_PERM_DEFAULTS.VIEWER;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  OWNER: <Crown className="h-3.5 w-3.5 text-yellow-500" />,
  ADMIN: <Shield className="h-3.5 w-3.5 text-blue-500" />,
  MEMBER: <User className="h-3.5 w-3.5 text-muted-foreground" />,
  VIEWER: <Eye className="h-3.5 w-3.5 text-muted-foreground" />,
};

const ROLE_COLORS: Record<string, string> = {
  OWNER:
    'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  ADMIN:
    'bg-blue-50  dark:bg-blue-900/20  text-blue-700  dark:text-blue-300  border-blue-200  dark:border-blue-800',
  MEMBER: 'bg-secondary text-secondary-foreground border-border',
  VIEWER: 'bg-secondary text-muted-foreground border-border',
};

const PERM_KEYS: (keyof MemberPermissions)[] = [
  'canEditContent',
  'canDeleteContent',
  'canManageMembers',
  'canManageAdmins',
  'canComment',
];

function PermissionRow({
  member,
  slug,
  canManageAdmins,
}: {
  member: WorkspaceMember;
  slug: string;
  canManageAdmins: boolean;
}) {
  const t = useT();
  const updatePerms = useUpdateMemberPermissions(slug);

  const [local, setLocal] = useState<Partial<MemberPermissions>>({});
  // Track member identity — when it changes the server has responded, clear local overrides
  const memberRef = useRef(member);
  useEffect(() => {
    if (memberRef.current !== member) {
      memberRef.current = member;
      setLocal({});
    }
  }, [member]);

  const serverPerms = effectivePerms(member);
  const perms: MemberPermissions = { ...serverPerms, ...local };
  const hasCustom =
    member.customPermissions != null && Object.keys(member.customPermissions).length > 0;

  const toggle = (key: keyof MemberPermissions) => {
    const next = !perms[key];
    setLocal((prev) => ({ ...prev, [key]: next }));
    updatePerms.mutate({ userId: member.user.id, permissions: { [key]: next } });
  };

  const reset = () => {
    setLocal({});
    updatePerms.mutate({ userId: member.user.id, permissions: { reset: true } as never });
  };

  return (
    <div className="px-5 py-3 bg-secondary/50 border-t border-dashed border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t.members.permissions.title}
        </span>
        {hasCustom && (
          <button
            onClick={reset}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" />
            {t.members.permissions.reset}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {PERM_KEYS.map((key) => {
          const disabled = key === 'canManageAdmins' && !canManageAdmins;
          const active = perms[key];
          const isOverridden =
            (member.customPermissions != null && key in member.customPermissions) || key in local;

          return (
            <div
              key={key}
              onClick={() => {
                if (!disabled) toggle(key);
              }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors select-none ${
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-secondary'
              }`}
            >
              <div
                className={`relative flex-shrink-0 w-8 h-4 rounded-full transition-colors duration-200 ${active ? 'bg-primary' : 'bg-border'}`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200 ${active ? 'translate-x-4' : 'translate-x-0'}`}
                />
              </div>

              <span className="text-xs text-foreground flex-1">
                {t.members.permissions[key as keyof typeof t.members.permissions] as string}
              </span>

              {isOverridden && (
                <span className="text-[10px] bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-md font-medium flex-shrink-0">
                  {t.members.permissions.customized}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MembersPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const t = useT();
  const { user: me } = useAuthStore();
  const { data: members, isLoading } = useWorkspaceMembers(workspaceSlug);
  const { data: invitations } = useWorkspaceInvitations(workspaceSlug);
  const sendInvitation = useSendInvitation(workspaceSlug);
  const removeMember = useRemoveMember(workspaceSlug);
  const updateRole = useUpdateMemberRole(workspaceSlug);
  const cancelInvitation = useCancelInvitation(workspaceSlug);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [inviteMsg, setInviteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [expandedPerms, setExpandedPerms] = useState<Set<string>>(new Set());

  const myMember = members?.find((m) => m.user.id === me?.id);
  const myRole = myMember?.role;
  const canManage = !members || myRole === 'OWNER' || myRole === 'ADMIN';
  const canManageAdmins = myMember ? effectivePerms(myMember).canManageAdmins : false;

  const togglePerms = (memberId: string) => {
    setExpandedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const handleInvite = () => {
    if (!email.trim()) return;
    sendInvitation.mutate(
      { email: email.trim(), role },
      {
        onSuccess: () => {
          setEmail('');
          setInviteMsg({ type: 'success', text: t.members.inviteSent });
          setTimeout(() => setInviteMsg(null), 3000);
        },
        onError: (e: Error) =>
          setInviteMsg({ type: 'error', text: e.message || t.members.inviteError }),
      },
    );
  };

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-10 px-4 sm:px-8 space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t.members.title}</h1>
        <p className="mt-1 text-muted-foreground">{t.members.subtitle}</p>
      </div>

      {/* Invite form */}
      {canManage && (
        <div className="card p-6">
          <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" /> {t.members.inviteTitle}
          </h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleInvite();
              }}
              placeholder={t.members.emailPlaceholder}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              name={`invite-email-${workspaceSlug}`}
              className="flex-1 border border-border rounded-xl px-4 py-2.5 text-sm bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="border border-border rounded-xl px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="MEMBER">{t.members.roles.MEMBER}</option>
                <option value="ADMIN">{t.members.roles.ADMIN}</option>
                <option value="VIEWER">{t.members.roles.VIEWER}</option>
              </select>
              <Button
                onClick={handleInvite}
                isLoading={sendInvitation.isPending}
                className="flex-1 sm:flex-none"
              >
                {t.common.invite}
              </Button>
            </div>
          </div>
          {inviteMsg && (
            <p
              className={`mt-2.5 text-sm ${inviteMsg.type === 'success' ? 'text-green-600' : 'text-destructive'}`}
            >
              {inviteMsg.text}
            </p>
          )}
        </div>
      )}

      {/* Members list */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
          {members?.length ?? 0} {t.members.title.toLowerCase()}
        </h2>
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{t.members.empty}</div>
          ) : (
            members?.map((member, idx) => {
              const isMe = member.user.id === me?.id;
              const isOwner = member.role === 'OWNER';
              const canEdit = canManage && !isOwner;
              const isExpanded = expandedPerms.has(member.id);
              const hasCustom =
                member.customPermissions && Object.keys(member.customPermissions).length > 0;

              return (
                <div
                  key={member.id}
                  className={`divide-y divide-border ${idx > 0 ? 'border-t border-border' : ''}`}
                >
                  {/* Member row */}
                  <div className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/50 transition-colors">
                    <Avatar name={member.user.name} src={member.user.avatar} size="md" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {member.user.name}
                        </span>
                        {isMe && (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-medium">
                            {t.members.you}
                          </span>
                        )}
                        {hasCustom && !isExpanded && (
                          <span className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-md font-medium">
                            {t.members.permissions.customized}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {(member.user as { email?: string }).email ?? ''}
                      </span>
                    </div>

                    {/* Role select or badge */}
                    {canEdit ? (
                      <select
                        value={member.role}
                        onChange={(e) =>
                          updateRole.mutate({ userId: member.user.id, role: e.target.value })
                        }
                        className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                      >
                        <option value="ADMIN">{t.members.roles.ADMIN}</option>
                        <option value="MEMBER">{t.members.roles.MEMBER}</option>
                        <option value="VIEWER">{t.members.roles.VIEWER}</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${ROLE_COLORS[member.role]}`}
                      >
                        {ROLE_ICONS[member.role]}
                        {t.members.roles[member.role as keyof typeof t.members.roles]}
                      </span>
                    )}

                    {/* Customize permissions button */}
                    {canEdit && (
                      <button
                        onClick={() => togglePerms(member.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isExpanded
                            ? 'text-primary bg-primary/10'
                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                        }`}
                        title={t.members.permissions.customize}
                      >
                        <Settings2 className="h-4 w-4" />
                      </button>
                    )}

                    {canEdit && !isMe && (
                      <button
                        onClick={() => removeMember.mutate(member.user.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        title={t.members.remove}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Expanded permissions panel */}
                  {isExpanded && canEdit && (
                    <PermissionRow
                      member={member}
                      slug={workspaceSlug}
                      canManageAdmins={canManageAdmins}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Pending invitations */}
      {invitations && invitations.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" /> {t.members.pending}
          </h2>
          <div className="card divide-y divide-border overflow-hidden">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.members.roles[inv.role as keyof typeof t.members.roles]} ·{' '}
                    {formatRelativeDate(inv.createdAt)}
                  </p>
                </div>
                <span className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 px-2.5 py-1 rounded-lg font-medium">
                  Pending
                </span>
                {canManage && (
                  <button
                    onClick={() => cancelInvitation.mutate(inv.id)}
                    className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded-lg hover:bg-destructive/10 transition-colors"
                  >
                    {t.common.cancel}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Bell, Check, CheckCheck, UserPlus } from 'lucide-react';
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
} from '@/features/notification/hooks/useNotification';
import { useAcceptInvitation, useDeclineInvitation } from '@/features/workspace/hooks/useWorkspace';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatRelativeDate, cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/useT';

function InvitationActions({
  notifId,
  invitationId,
  isRead,
  onResponded,
}: {
  notifId: string;
  invitationId: string;
  isRead: boolean;
  onResponded: () => void;
}) {
  const t = useT();
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();
  const markAsRead = useMarkAsRead();

  const handleAccept = () => {
    // A stale "already responded to" error (e.g. answered in another tab/session)
    // should also hide the buttons, not just a real success.
    accept.mutate(invitationId, { onSuccess: onResponded, onError: onResponded });
    if (!isRead) markAsRead.mutate(notifId);
  };

  const handleDecline = () => {
    decline.mutate(invitationId, { onSuccess: onResponded, onError: onResponded });
    if (!isRead) markAsRead.mutate(notifId);
  };

  return (
    <div className="flex gap-2 mt-2">
      <Button size="sm" onClick={handleAccept} isLoading={accept.isPending}>
        {t.notifications.accept}
      </Button>
      <Button size="sm" variant="secondary" onClick={handleDecline} isLoading={decline.isPending}>
        {t.notifications.decline}
      </Button>
    </div>
  );
}

export default function NotificationsPage() {
  const { data, isLoading } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const t = useT();
  // "Read" just controls the unread dot/badge — it says nothing about whether an
  // invitation was actually accepted/declined (e.g. "mark all as read" shouldn't be
  // able to make the accept/decline buttons vanish), so track that separately.
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());

  const notifications = data?.data ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="page-container max-w-2xl">
      <div className="flex items-center justify-between mb-5 sm:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.notifications.title}</h1>
          {unreadCount > 0 && (
            <p className="text-muted-foreground mt-1">{t.notifications.unread(unreadCount)}</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => markAllAsRead.mutate()}
            isLoading={markAllAsRead.isPending}
          >
            <CheckCheck className="h-4 w-4 mr-2" /> {t.notifications.markAll}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-4 flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="card p-12 text-center">
          <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {t.notifications.empty.title}
          </h3>
          <p className="text-muted-foreground">{t.notifications.empty.subtitle}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const isInvite = notification.type === 'INVITATION';
            const invitationId = isInvite
              ? ((notification.data?.invitationId as string | undefined) ?? null)
              : null;
            // Backend enriches INVITATION notifications with the invite's live status — an
            // already accepted/declined invite (e.g. from another tab) must not show working
            // buttons just because this page hasn't locally marked it as responded.
            const invitationStatus =
              (notification.data?.invitationStatus as string | null | undefined) ?? null;
            const isResolved =
              respondedIds.has(notification.id) ||
              (invitationStatus !== null && invitationStatus !== 'PENDING');

            return (
              <div
                key={notification.id}
                className={cn(
                  'card p-4 flex items-start gap-4 transition-colors',
                  !notification.isRead && 'border-primary/30 bg-primary/5',
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {isInvite ? (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserPlus className="h-4 w-4 text-primary" />
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full mt-2',
                        notification.isRead ? 'bg-border' : 'bg-primary',
                      )}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm">{notification.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{notification.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatRelativeDate(notification.createdAt)}
                  </p>
                  {isInvite && invitationId && !isResolved && (
                    <InvitationActions
                      notifId={notification.id}
                      invitationId={invitationId}
                      isRead={notification.isRead}
                      onResponded={() =>
                        setRespondedIds((prev) => new Set(prev).add(notification.id))
                      }
                    />
                  )}
                  {isInvite && isResolved && (
                    <p className="text-xs text-muted-foreground mt-1 italic">— answered</p>
                  )}
                </div>
                {!notification.isRead && !isInvite && (
                  <button
                    onClick={() => markAsRead.mutate(notification.id)}
                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors flex-shrink-0"
                    title={t.notifications.markOne}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

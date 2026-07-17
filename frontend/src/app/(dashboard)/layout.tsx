'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Bell,
  LogOut,
  Settings,
  LayoutDashboard,
  Search,
  Menu,
  X,
  Building2,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useLogout } from '@/features/auth/hooks/useAuth';
import { useUnreadCount } from '@/features/notification/hooks/useNotification';
import { useWorkspaces } from '@/features/workspace/hooks/useWorkspace';
import { warmCache } from '@/lib/prefetch';
import { Avatar } from '@/components/ui/Avatar';
import { PageLoader } from '@/components/ui/Spinner';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ThemePicker } from '@/components/ui/ThemePicker';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { SearchModal } from '@/features/search/components/SearchModal';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import { useQueryClient } from '@tanstack/react-query';
import { useT } from '@/lib/i18n/useT';
import { useRealtime } from '@/lib/useRealtime';

// Mobile navigation menu — shows on non-workspace pages when hamburger is pressed.
// Workspace pages have their own sidebar via [workspaceSlug]/layout.tsx.
function MobileNavMenu() {
  const { isOpen, close } = useSidebar();
  const pathname = usePathname();
  const { data: workspaces } = useWorkspaces();
  const logout = useLogout();
  const t = useT();

  // Workspace pages have their own sidebar; this menu only handles other pages
  const isWorkspacePage = /^\/workspaces\/[^/]+/.test(pathname ?? '');
  if (isWorkspacePage || !isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[4999] md:hidden" onClick={close} />
      <div className="fixed top-0 left-0 bottom-0 w-64 bg-card border-r border-border z-[5000] flex flex-col md:hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-semibold text-sm text-foreground">Menu</span>
          <button
            onClick={close}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {/* Workspaces */}
          <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t.nav.workspaces}
          </p>
          {workspaces?.map((ws) => (
            <Link
              key={ws.id}
              href={`/workspaces/${ws.slug}/projects`}
              onClick={close}
              className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors"
            >
              <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm flex-shrink-0">
                {ws.name[0]?.toUpperCase()}
              </div>
              <span className="truncate flex-1">{ws.name}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            </Link>
          ))}
          <Link
            href="/workspaces"
            onClick={close}
            className="flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors mt-1"
          >
            <Building2 className="h-4 w-4 flex-shrink-0" />
            <span>All workspaces</span>
          </Link>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border p-3 space-y-1">
          <Link
            href="/settings"
            onClick={close}
            className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Settings className="h-4 w-4 flex-shrink-0" />
            <span>Settings</span>
          </Link>
          <div className="flex items-center gap-2 px-2 py-1">
            <LanguageSwitcher />
            <ThemeToggle />
            <ThemePicker />
          </div>
        </div>
      </div>
    </>
  );
}

// Navbar as a sub-component so it can read useSidebar() from the provider above
function MainNav({
  user,
  onSearchOpen,
}: {
  user: { name: string; avatar?: string | null };
  onSearchOpen: () => void;
}) {
  const { toggle } = useSidebar();
  const logout = useLogout();
  const { data: unreadCount } = useUnreadCount();
  const t = useT();

  return (
    <nav className="bg-card border-b border-border px-3 sm:px-6 lg:px-8 flex-shrink-0 z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-14 sm:h-16">
        <div className="flex items-center gap-2 sm:gap-6">
          {/* Hamburger: only on mobile */}
          <button
            onClick={toggle}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/workspaces" className="font-bold text-lg sm:text-xl text-primary">
            TeamFlow
          </Link>
          <Link
            href="/workspaces"
            className="hidden md:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <LayoutDashboard className="h-4 w-4" />
            {t.nav.workspaces}
          </Link>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Search: full button on sm+, icon-only on mobile */}
          <button
            onClick={onSearchOpen}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-secondary hover:bg-secondary/70 rounded-lg transition-colors border border-border"
          >
            <Search className="h-4 w-4" />
            <span>{t.search.title}</span>
            <kbd className="ml-2 text-xs bg-card border border-border rounded px-1.5 py-0.5 text-muted-foreground">
              Ctrl K
            </kbd>
          </button>
          <button
            onClick={onSearchOpen}
            className="sm:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* Lang + Theme: hidden on mobile — moved to sidebar footer */}
          <div className="hidden md:flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
            <ThemePicker />
          </div>

          <Link
            href="/notifications"
            className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
          >
            <Bell className="h-5 w-5" />
            {!!unreadCount && unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
          <Link
            href="/settings"
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
          >
            <Settings className="h-5 w-5" />
          </Link>

          <div className="flex items-center gap-1 sm:gap-2 pl-2 sm:pl-3 border-l border-border">
            <Avatar name={user.name} src={user.avatar} size="sm" />
            <span className="hidden sm:block text-sm font-medium text-foreground">{user.name}</span>
            <button
              onClick={() => logout.mutate()}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              title={t.nav.signOut}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

// Prefetches critical data as soon as the user is authenticated,
// so first page navigations are instant from cache.
function AppPrefetch() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Warm the full navigation path: workspaces → projects → boards → board+tasks.
    // Runs once after auth is confirmed. Non-blocking — errors are swallowed internally.
    warmCache(queryClient);
  }, [queryClient]);

  return null;
}

// Real-time sync via SSE: invalidates React Query cache when another client mutates data.
function AppRealtime() {
  const { isAuthenticated } = useAuthStore();
  useRealtime(isAuthenticated);
  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (user && !user.isEmailVerified) router.replace('/verify-email');
  }, [hydrated, isAuthenticated, user, router]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(true);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!hydrated || !isAuthenticated || !user) return <PageLoader />;

  return (
    <SidebarProvider>
      <div className="h-screen flex flex-col overflow-hidden">
        <MainNav user={user} onSearchOpen={() => setSearchOpen(true)} />
        {/* Mobile menu for non-workspace pages */}
        <MobileNavMenu />
        <main className="flex-1 flex flex-col overflow-y-auto min-h-0">{children}</main>
        <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        <AppPrefetch />
        <AppRealtime />
      </div>
    </SidebarProvider>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, ExternalLink, LogOut, Menu, User, X } from 'lucide-react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { STORE_URL } from '@/lib/api';
import { cn } from '@/lib/utils';
import { usePanelAuthStore } from '@/stores/panelAuthStore';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  /** Gerekli yetki — yoksa öğe gizlenir. */
  perm?: string | string[];
  /** Sayaç rozeti (bekleyen iş, yeni sipariş) */
  badgeKey?: string;
}

export interface NavGroup {
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

interface Props {
  topItems: NavItem[];
  groups: NavGroup[];
  /** Menü rozetlerini besleyen sayaçlar: { orders_paid: 3 } */
  badges?: Record<string, number>;
}

/**
 * Yönetim panelinin kabuğu.
 *
 * Menü, kullanıcının YETKİLERİNE göre süzülür: yetkisi olmayan öğe gizlenir,
 * grubun tüm öğeleri gizlenirse grup da görünmez. Böylece "tıkladım, yetkiniz
 * yok dedi" deneyimi oluşmaz.
 */
export default function PanelLayout({ topItems, groups, badges = {} }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, can, logout } = usePanelAuthStore();

  const storageKey = 'chc_admin_nav_open';
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    } catch {
      return [];
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => !item.perm || can(item.perm)),
        }))
        .filter((group) => group.items.length > 0),
    [groups, can],
  );

  const visibleTopItems = useMemo(
    () => topItems.filter((item) => !item.perm || can(item.perm)),
    [topItems, can],
  );

  const isActive = (item: NavItem) =>
    item.exact ? location.pathname === item.href : location.pathname.startsWith(item.href);

  // Aktif sayfanın grubunu otomatik aç
  useEffect(() => {
    const active = visibleGroups.find((group) => group.items.some(isActive));

    if (active && !openGroups.includes(active.label)) {
      setOpenGroups((prev) => [...prev, active.label]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, visibleGroups]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(openGroups));
  }, [openGroups]);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));

  const handleLogout = async () => {
    await logout();
    navigate('/giris', { replace: true });
  };

  const totalBadges = Object.values(badges).reduce((sum, n) => sum + n, 0);

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* ── Yan menü ─────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Marka */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-ikon.png" alt="" className="size-8 object-contain" />
            <div className="min-w-0">
              <p className="truncate text-sm font-black leading-none">Chiconom</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Yönetim Paneli</p>
            </div>
          </Link>

          <Button
            variant="ghost" size="icon"
            className="ml-auto size-8 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Menüyü kapat"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Menü */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 scrollbar-thin">
          {visibleTopItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item)} badge={badges[item.badgeKey ?? '']} />
          ))}

          {visibleGroups.map((group) => {
            const open = openGroups.includes(group.label);
            const groupBadge = group.items.reduce(
              (sum, item) => sum + (badges[item.badgeKey ?? ''] ?? 0),
              0,
            );

            return (
              <div key={group.label} className="pt-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold uppercase
                             tracking-wide text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <group.icon className="size-3.5 shrink-0" />
                  <span className="flex-1 text-left">{group.label}</span>
                  {groupBadge > 0 && !open && (
                    <Badge variant="deal" className="h-4 min-w-4 px-1 text-[10px]">{groupBadge}</Badge>
                  )}
                  <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
                </button>

                {open && (
                  <div className="mt-0.5 space-y-0.5 pl-2">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.href}
                        item={item}
                        active={isActive(item)}
                        badge={badges[item.badgeKey ?? '']}
                        nested
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <a
            href={STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="size-3.5" /> Mağazayı görüntüle
          </a>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── İçerik ───────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
          <Button
            variant="ghost" size="icon" className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Menü"
          >
            <Menu className="size-5" />
          </Button>

          {totalBadges > 0 && (
            <Badge variant="deal" className="gap-1">
              {totalBadges} bekleyen iş
            </Badge>
          )}

          <div className="relative ml-auto">
            <Button
              variant="ghost" size="sm" className="gap-2"
              onClick={() => setUserMenuOpen((v) => !v)}
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-brand">
                <User className="size-4" />
              </span>
              <span className="hidden text-sm font-medium sm:block">{user?.name}</span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-border bg-card py-1 shadow-lg">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-semibold">{user?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                    {user?.roles?.length ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <Badge key={role} variant="soft" className="text-[10px]">{role}</Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <Separator />
                  <Link
                    to="/sifre"
                    onClick={() => setUserMenuOpen(false)}
                    className="block px-3 py-2 text-sm transition-colors hover:bg-muted"
                  >
                    Şifre Değiştir
                  </Link>
                  <Separator />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-muted"
                  >
                    <LogOut className="size-4" /> Çıkış Yap
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 lg:p-6">
          {/*
            Sınır İÇERİDE, kenar menü ile üst çubuğun arasındadır: çöken bir
            ekran menüyü silmez, kullanıcı başka ekrana geçebilir.
          */}
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

function NavLink({
  item, active, badge, nested,
}: {
  item: NavItem; active: boolean; badge?: number; nested?: boolean;
}) {
  return (
    <Link
      to={item.href}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-brand-soft font-semibold text-brand'
          : 'text-foreground hover:bg-muted',
        nested && 'py-1.5 text-[13px]',
      )}
    >
      <item.icon className={cn('shrink-0', nested ? 'size-3.5' : 'size-4')} />
      <span className="flex-1 truncate">{item.label}</span>
      {badge ? (
        <Badge variant="deal" className="h-4 min-w-4 px-1 text-[10px]">{badge > 99 ? '99+' : badge}</Badge>
      ) : (
        active && !nested && <ChevronRight className="size-3.5 opacity-50" />
      )}
    </Link>
  );
}

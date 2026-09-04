import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  BarChart3, Bell, Boxes, CheckCircle2, Clock, FileText, FolderTree, Gift, Grid3x3, HelpCircle,
  Image, Inbox, Kanban, LayoutDashboard, LayoutList, Loader2, Mail, Megaphone, MessageCircleQuestion,
  MessageSquare, Newspaper, Package, PackageCheck, PackageOpen, Plug, Receipt, RotateCcw,
  ScrollText, Settings, ShieldCheck, ShoppingBag, Store, Tag, Ticket, Truck, UserCog, Users, Wallet, XCircle, Zap,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import PanelLayout, { type NavGroup, type NavItem } from '@/components/panel/PanelLayout';
import { adminApi } from '@/lib/api';
import { usePanelAuthStore } from '@/stores/panelAuthStore';

const AdminDashboard = lazy(() => import('./AdminDashboard'));
const AdminOrderPipeline = lazy(() => import('./AdminOrderPipeline'));
const AdminReports = lazy(() => import('./AdminReports'));
const AdminIntegrations = lazy(() => import('./AdminIntegrations'));
const AdminProductDetail = lazy(() => import('./AdminProductDetail'));
const AdminProducts = lazy(() => import('./AdminProducts'));
const AdminOrders = lazy(() => import('./AdminOrders'));
const AdminCampaignDetail = lazy(() => import('./AdminCampaignDetail'));
const AdminCampaigns = lazy(() => import('./AdminCampaigns'));
const AdminContracts = lazy(() => import('./AdminContracts'));
const AdminMenus = lazy(() => import('./AdminMenus'));
const AdminCustomers = lazy(() => import('./AdminCustomers'));
const AdminCancellations = lazy(() => import('./AdminCancellations'));
const AdminReturns = lazy(() => import('./AdminReturns'));
const AdminInvoices = lazy(() => import('./AdminInvoices'));
const AdminEInvoice = lazy(() => import('./AdminEInvoice'));
const AdminTrendyol = lazy(() => import('./AdminTrendyol'));
const AdminUsers = lazy(() => import('./AdminUsers'));
const AdminOrderDetail = lazy(() => import('./AdminOrderDetail'));
const AdminCategories = lazy(() => import('./AdminCategories'));
const AdminReviews = lazy(() => import('./AdminReviews'));
const AdminRoles = lazy(() => import('./AdminRoles'));
const AdminSettings = lazy(() => import('./AdminSettings'));
const AdminMedia = lazy(() => import('./AdminMedia'));
const AdminSupport = lazy(() => import('./AdminSupport'));
const AdminQuestions = lazy(() => import('./AdminQuestions'));
const AdminResource = lazy(() => import('./AdminResource'));
const PanelPassword = lazy(() => import('@/pages/PanelPassword'));

/** Üst seviye kısayollar. */
const TOP_ITEMS: NavItem[] = [
  { href: '/', label: 'Kontrol Paneli', icon: LayoutDashboard, exact: true, perm: 'dashboard.view' },
  { href: '/siparis-panosu', label: 'Sipariş Panosu', icon: Kanban, perm: 'orders.view', badgeKey: 'orders_open' },
  { href: '/raporlar', label: 'Raporlar', icon: BarChart3, perm: 'reports.view' },
];

/**
 * Menü grupları. Yeni ekran eklerken ilgili grubun `items` dizisine bir satır
 * eklemek yeterlidir; yetkisi olmayan kullanıcıda öğe otomatik gizlenir.
 *
 * Sipariş durumlarının her birinin AYRI SAYFASI vardır (aynı liste bileşeni,
 * farklı süzgeç); pano ise hepsini tek ekranda gösterir.
 */
const GROUPS: NavGroup[] = [
  {
    label: 'Siparişler',
    icon: ShoppingBag,
    items: [
      { href: '/siparisler', label: 'Tüm Siparişler', icon: ShoppingBag, exact: true, perm: 'orders.view' },
      { href: '/siparisler/durum/pending', label: 'Ödeme Bekleyen', icon: Clock, perm: 'orders.view', badgeKey: 'orders_pending_payment' },
      { href: '/siparisler/durum/paid', label: 'Hazırlanacak (Ödendi)', icon: Inbox, perm: 'orders.view', badgeKey: 'orders_paid' },
      { href: '/siparisler/durum/processing', label: 'Hazırlanıyor', icon: PackageOpen, perm: 'orders.view' },
      { href: '/siparisler/durum/shipped', label: 'Kargoda', icon: Truck, perm: 'orders.view', badgeKey: 'orders_shipped' },
      { href: '/siparisler/durum/delivered', label: 'Teslim Edildi', icon: PackageCheck, perm: 'orders.view' },
      { href: '/siparisler/durum/completed', label: 'Tamamlanan', icon: CheckCircle2, perm: 'orders.view' },
      { href: '/siparisler/durum/closed', label: 'İptal & İade Edilen', icon: XCircle, perm: 'orders.view' },
      { href: '/iptaller', label: 'İptal Talepleri', icon: RotateCcw, perm: 'returns.manage', badgeKey: 'cancellations' },
      { href: '/iadeler', label: 'İade Talepleri', icon: RotateCcw, perm: 'returns.manage', badgeKey: 'returns_open' },
      { href: '/faturalar', label: 'Faturalar', icon: Receipt, perm: 'invoices.view', badgeKey: 'invoices_missing' },
      { href: '/e-fatura', label: 'e-Fatura (BirFatura)', icon: Receipt, perm: 'invoices.manage' },
    ],
  },
  {
    label: 'Trendyol',
    icon: Store,
    items: [
      { href: '/trendyol', label: 'Trendyol İlanları & Fiyatlar', icon: Store, perm: 'trendyol.manage' },
    ],
  },
  {
    label: 'Müşteri',
    icon: Users,
    items: [
      { href: '/musteriler', label: 'Müşteriler', icon: Users, perm: 'customers.view' },
      { href: '/yorumlar', label: 'Değerlendirmeler', icon: MessageSquare, perm: 'reviews.manage', badgeKey: 'reviews' },
      { href: '/sorular', label: 'Ürün Soruları', icon: MessageCircleQuestion, perm: 'reviews.manage', badgeKey: 'questions' },
      { href: '/destek', label: 'Destek Talepleri', icon: Ticket, perm: 'support.view', badgeKey: 'support_open' },
      { href: '/kaynak/contact-messages', label: 'İletişim Mesajları', icon: Mail, perm: 'support.manage' },
    ],
  },
  {
    label: 'Katalog',
    icon: Boxes,
    items: [
      { href: '/urunler', label: 'Ürünler', icon: Package, perm: 'products.view', badgeKey: 'low_stock' },
      { href: '/kategoriler', label: 'Kategoriler', icon: FolderTree, perm: 'categories.manage' },
      { href: '/kaynak/brands', label: 'Markalar', icon: Tag, perm: 'brands.manage' },
      { href: '/kaynak/attributes', label: 'Özellikler & Filtreler', icon: Grid3x3, perm: 'attributes.manage' },
    ],
  },
  {
    label: 'Pazarlama',
    icon: Zap,
    items: [
      { href: '/kampanyalar', label: 'Kampanyalar', icon: Zap, perm: 'campaigns.view' },
      { href: '/kaynak/coupons', label: 'Kuponlar', icon: Gift, perm: 'coupons.manage' },
      { href: '/kaynak/hero-slides', label: 'Anasayfa Slaytları', icon: Image, perm: 'content.manage' },
      { href: '/kaynak/banners', label: 'Bannerlar', icon: Image, perm: 'content.manage' },
      { href: '/kaynak/announcements', label: 'Duyuru Barı', icon: Megaphone, perm: 'content.manage' },
    ],
  },
  {
    label: 'İçerik',
    icon: Newspaper,
    items: [
      { href: '/kaynak/pages', label: 'Sayfalar', icon: FileText, perm: 'content.manage' },
      { href: '/kaynak/faqs', label: 'Sıkça Sorulanlar', icon: HelpCircle, perm: 'content.manage' },
      { href: '/kaynak/blog-posts', label: 'Blog', icon: Newspaper, perm: 'content.manage' },
      { href: '/menuler', label: 'Menüler', icon: LayoutList, perm: 'content.manage' },
      { href: '/medya', label: 'Medya Merkezi', icon: Image, perm: 'media.manage' },
    ],
  },
  {
    label: 'Sistem',
    icon: Settings,
    items: [
      { href: '/kullanicilar', label: 'Kullanıcılar', icon: UserCog, perm: 'users.view' },
      { href: '/roller', label: 'Roller & Yetkiler', icon: ShieldCheck, perm: 'roles.manage' },
      { href: '/kaynak/mail-templates', label: 'Mail Şablonları', icon: Bell, perm: 'templates.manage' },
      { href: '/kaynak/sms-templates', label: 'SMS Şablonları', icon: Bell, perm: 'templates.manage' },
      { href: '/kaynak/shipping-companies', label: 'Kargo Firmaları', icon: Truck, perm: 'settings.manage' },
      { href: '/sozlesmeler', label: 'Sözleşmeler', icon: ScrollText, perm: 'settings.manage' },
      { href: '/ayarlar/entegrasyonlar', label: 'Entegrasyonlar (PayTR, BirFatura, Trendyol…)', icon: Plug, perm: 'settings.manage' },
      { href: '/ayarlar', label: 'Ayarlar', icon: Wallet, perm: 'settings.manage' },
    ],
  },
];

function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-brand" />
    </div>
  );
}

const S = (el: React.ReactNode) => <Suspense fallback={<Loading />}>{el}</Suspense>;

export default function AdminRoutes() {
  const { isLoggedIn, refresh } = usePanelAuthStore();

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Menü rozetleri kontrol panelindeki "bekleyen işler" sayaçlarından beslenir
  const { data: dashboard } = useQuery({
    queryKey: ['admin-badges'],
    queryFn: async () => (await adminApi.get('/dashboard')).data,
    enabled: isLoggedIn,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (!isLoggedIn) return <Navigate to="/giris" replace />;

  const pending = dashboard?.pending ?? {};
  const badges: Record<string, number> = {
    orders_open: (pending.orders_paid ?? 0) + (pending.orders_shipped ?? 0),
    orders_pending_payment: pending.orders_pending_payment ?? 0,
    orders_paid: pending.orders_paid ?? 0,
    orders_shipped: pending.orders_shipped ?? 0,
    cancellations: pending.cancellations ?? 0,
    returns_open: pending.returns_open ?? 0,
    invoices_missing: pending.invoices_missing ?? 0,
    reviews: pending.reviews ?? 0,
    questions: pending.questions ?? 0,
    support_open: pending.support_open ?? 0,
    low_stock: pending.low_stock ?? 0,
  };

  return (
    <Routes>
      <Route element={<PanelLayout topItems={TOP_ITEMS} groups={GROUPS} badges={badges} />}>
        <Route index element={S(<AdminDashboard />)} />
        <Route path="siparis-panosu" element={S(<AdminOrderPipeline />)} />
        <Route path="raporlar" element={S(<AdminReports />)} />

        {/* Siparişler: liste, durum sayfaları, detay */}
        <Route path="siparisler" element={S(<AdminOrders />)} />
        <Route path="siparisler/durum/:status" element={S(<AdminOrders />)} />
        {/* :orderNumber sipariş numarasıdır (ID değil) */}
        <Route path="siparisler/:orderNumber" element={S(<AdminOrderDetail />)} />
        <Route path="iptaller" element={S(<AdminCancellations />)} />
        <Route path="iadeler" element={S(<AdminReturns />)} />
        <Route path="faturalar" element={S(<AdminInvoices />)} />
        <Route path="e-fatura" element={S(<AdminEInvoice />)} />
        <Route path="trendyol" element={S(<AdminTrendyol />)} />

        <Route path="musteriler" element={S(<AdminCustomers />)} />
        <Route path="yorumlar" element={S(<AdminReviews />)} />
        <Route path="sorular" element={S(<AdminQuestions />)} />
        <Route path="destek" element={S(<AdminSupport />)} />

        <Route path="urunler" element={S(<AdminProducts />)} />
        <Route path="urunler/:id" element={S(<AdminProductDetail />)} />
        <Route path="kategoriler" element={S(<AdminCategories />)} />
        <Route path="kampanyalar" element={S(<AdminCampaigns />)} />
        <Route path="kampanyalar/:id" element={S(<AdminCampaignDetail />)} />
        <Route path="sozlesmeler" element={S(<AdminContracts />)} />
        <Route path="menuler" element={S(<AdminMenus />)} />

        <Route path="medya" element={S(<AdminMedia />)} />
        <Route path="kullanicilar" element={S(<AdminUsers />)} />
        <Route path="roller" element={S(<AdminRoles />)} />
        <Route path="ayarlar" element={S(<AdminSettings />)} />
        <Route path="ayarlar/entegrasyonlar" element={S(<AdminIntegrations />)} />
        <Route path="sifre" element={S(<PanelPassword />)} />

        {/* Ortak kaynaklar (marka, kupon, sayfa, SSS, şablon…) tek ekranla yönetilir */}
        <Route path="kaynak/:resource" element={S(<AdminResource />)} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

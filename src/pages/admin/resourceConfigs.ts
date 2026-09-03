import {
  Bell, FileText, Gift, Grid3x3, HelpCircle, Image, LayoutList,
  Mail, Megaphone, Newspaper, Tag, Truck,
} from 'lucide-react';

export interface FieldConfig {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'currency' | 'textarea' | 'html' | 'boolean' | 'select' | 'date' | 'image';
  required?: boolean;
  hint?: string;
  placeholder?: string;
  wide?: boolean;
  default?: unknown;
  options?: Array<{ label: string; value: string }>;
}

export interface ColumnConfig {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'currency' | 'boolean' | 'date' | 'badge' | 'image' | 'color';
}

export interface ResourceConfig {
  title: string;
  singular: string;
  description: string;
  icon: React.ElementType;
  columns: ColumnConfig[];
  fields: FieldConfig[];
  /** Kayıt yalnız vitrinden oluşur (iletişim mesajı gibi); panelde "Yeni" düğmesi gizlenir. */
  noCreate?: boolean;
}

const ACTIVE_FIELD: FieldConfig = { key: 'is_active', label: 'Aktif', type: 'boolean', default: true, hint: 'Vitrinde görünsün' };
const SORT_FIELD: FieldConfig = { key: 'sort_order', label: 'Sıra', type: 'number', hint: 'Küçük olan önce gösterilir' };

/**
 * Yönetim panelindeki "düz CRUD" kaynakların ekran tanımları.
 *
 * Backend'deki AdminResourceController ile SİMETRİKTİR: oradaki kayıt defteri
 * hangi kaynakların var olduğunu ve doğrulama kurallarını, buradaki tanım ise
 * o kaynağın nasıl görüneceğini belirler. Yeni kaynak eklerken iki tarafa da
 * birer girdi eklenir; ekran yazmak gerekmez.
 */
export const RESOURCE_CONFIGS: Record<string, ResourceConfig> = {
  brands: {
    title: 'Markalar',
    singular: 'Marka',
    description: 'Ürünlere atanabilecek markalar. Vitrinde marka filtresini besler.',
    icon: Tag,
    columns: [
      { key: 'logo', label: 'Logo', type: 'image' },
      { key: 'name', label: 'Marka Adı' },
      { key: 'slug', label: 'Kod' },
      { key: 'is_featured', label: 'Öne Çıkan', type: 'boolean' },
      { key: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
    fields: [
      { key: 'name', label: 'Marka Adı', required: true },
      { key: 'logo', label: 'Logo Adresi', hint: 'Medya merkezinden kopyalayabilirsiniz' },
      { key: 'description', label: 'Açıklama', type: 'textarea' },
      { key: 'is_featured', label: 'Anasayfada göster', type: 'boolean' },
      ACTIVE_FIELD, SORT_FIELD,
      { key: 'meta_title', label: 'SEO Başlık' },
      { key: 'meta_description', label: 'SEO Açıklama', type: 'textarea' },
    ],
  },

  coupons: {
    title: 'Kuponlar',
    singular: 'Kupon',
    description: 'İndirim kuponları. Sepette girilen kod ya da otomatik uygulanan indirim.',
    icon: Gift,
    columns: [
      { key: 'code', label: 'Kod', type: 'badge' },
      { key: 'name', label: 'Ad' },
      { key: 'type', label: 'Tip' },
      { key: 'value', label: 'Değer', type: 'number' },
      { key: 'used_count', label: 'Kullanım', type: 'number' },
      { key: 'ends_at', label: 'Bitiş', type: 'date' },
      { key: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
    fields: [
      { key: 'code', label: 'Kupon Kodu', required: true, hint: 'Müşterinin gireceği kod, örn. HOSGELDIN' },
      { key: 'name', label: 'Kupon Adı', required: true },
      {
        key: 'type', label: 'İndirim Tipi', type: 'select', required: true, default: 'percent',
        options: [
          { value: 'percent', label: 'Yüzde (%)' },
          { value: 'amount', label: 'Tutar (TL)' },
          { value: 'free_shipping', label: 'Ücretsiz Kargo' },
        ],
      },
      { key: 'value', label: 'İndirim Değeri', type: 'currency', required: true },
      { key: 'min_order_amount', label: 'Minimum Sepet Tutarı', type: 'currency' },
      { key: 'max_discount', label: 'Maksimum İndirim', type: 'currency', hint: 'Yüzdesel indirimde tavan' },
      { key: 'usage_limit', label: 'Toplam Kullanım Limiti', type: 'number' },
      { key: 'per_customer_limit', label: 'Müşteri Başına Limit', type: 'number', default: 1 },
      { key: 'starts_at', label: 'Başlangıç', type: 'date' },
      { key: 'ends_at', label: 'Bitiş', type: 'date' },
      { key: 'first_order_only', label: 'Sadece ilk siparişte', type: 'boolean' },
      { key: 'is_auto_apply', label: 'Sepette otomatik uygula', type: 'boolean' },
      ACTIVE_FIELD,
      { key: 'description', label: 'Açıklama', type: 'textarea', wide: true },
    ],
  },

  'hero-slides': {
    title: 'Anasayfa Slaytları',
    singular: 'Slayt',
    description: 'Anasayfanın üstündeki dönen tanıtım slaytları.',
    icon: Image,
    columns: [
      { key: 'image', label: 'Görsel', type: 'image' },
      { key: 'title', label: 'Başlık' },
      { key: 'badge_text', label: 'Rozet', type: 'badge' },
      { key: 'click_count', label: 'Tıklanma', type: 'number' },
      { key: 'sort_order', label: 'Sıra', type: 'number' },
      { key: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
    fields: [
      { key: 'title', label: 'Başlık', hint: 'Slayt üzerinde büyük yazı' },
      { key: 'subtitle', label: 'Alt Başlık' },
      { key: 'image', label: 'Masaüstü Görseli', required: true, hint: 'Önerilen: 1200×825 px' },
      { key: 'mobile_image', label: 'Mobil Görseli', hint: 'Önerilen: 800×500 px' },
      { key: 'link', label: 'Bağlantı', hint: 'Örn: /urun/kablosuz-sac-duzlestirici-bukle-yapici' },
      { key: 'button_text', label: 'Buton Metni', default: 'Ürünü İncele' },
      { key: 'badge_text', label: 'Rozet Metni', hint: 'Örn: YENİ' },
      {
        key: 'text_position', label: 'Metin Konumu', type: 'select', default: 'left',
        options: [
          { value: 'left', label: 'Sol' }, { value: 'center', label: 'Orta' }, { value: 'right', label: 'Sağ' },
        ],
      },
      { key: 'campaign_id', label: 'Bağlı Kampanya ID', type: 'number', hint: 'Geri sayım bu kampanyadan okunur' },
      { key: 'starts_at', label: 'Yayın Başlangıcı', type: 'date' },
      { key: 'ends_at', label: 'Yayın Bitişi', type: 'date' },
      ACTIVE_FIELD, SORT_FIELD,
    ],
  },

  banners: {
    title: 'Bannerlar',
    singular: 'Banner',
    description: 'Kategori üstü, sepet ve footer gibi alanlardaki görsel alanlar.',
    icon: Image,
    columns: [
      { key: 'image', label: 'Görsel', type: 'image' },
      { key: 'position', label: 'Konum', type: 'badge' },
      { key: 'title', label: 'Başlık' },
      { key: 'click_count', label: 'Tıklanma', type: 'number' },
      { key: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
    fields: [
      {
        key: 'position', label: 'Konum', type: 'select', required: true,
        options: [
          { value: 'home_grid', label: 'Anasayfa Izgara' },
          { value: 'category_top', label: 'Kategori Üstü' },
          { value: 'sidebar', label: 'Yan Panel' },
          { value: 'cart', label: 'Sepet' },
          { value: 'footer', label: 'Footer' },
        ],
      },
      { key: 'title', label: 'Başlık' },
      { key: 'subtitle', label: 'Alt Başlık' },
      { key: 'image', label: 'Görsel', required: true },
      { key: 'mobile_image', label: 'Mobil Görsel' },
      { key: 'link', label: 'Bağlantı' },
      { key: 'starts_at', label: 'Başlangıç', type: 'date' },
      { key: 'ends_at', label: 'Bitiş', type: 'date' },
      ACTIVE_FIELD, SORT_FIELD,
    ],
  },

  announcements: {
    title: 'Duyuru Barı',
    singular: 'Duyuru',
    description: 'Header üstünde dönen duyuru şeridi.',
    icon: Megaphone,
    columns: [
      { key: 'icon', label: 'İkon' },
      { key: 'text', label: 'Metin' },
      { key: 'bg_color', label: 'Renk', type: 'color' },
      { key: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
    fields: [
      { key: 'text', label: 'Duyuru Metni', required: true, wide: true, hint: 'Kısa tutun; şerit tek satır gösterir' },
      { key: 'link', label: 'Bağlantı' },
      { key: 'icon', label: 'Emoji', hint: 'Örn: 🚚 🎁 ⚡' },
      { key: 'bg_color', label: 'Arka Plan Rengi', placeholder: '#7C3AED' },
      { key: 'text_color', label: 'Yazı Rengi', placeholder: '#FFFFFF' },
      { key: 'is_closable', label: 'Kapatılabilir', type: 'boolean', default: true },
      { key: 'starts_at', label: 'Başlangıç', type: 'date' },
      { key: 'ends_at', label: 'Bitiş', type: 'date' },
      ACTIVE_FIELD, SORT_FIELD,
    ],
  },

  pages: {
    title: 'Sayfalar',
    singular: 'Sayfa',
    description: 'KVKK, mesafeli satış, hakkımızda gibi statik içerik sayfaları.',
    icon: FileText,
    columns: [
      { key: 'title', label: 'Başlık' },
      { key: 'slug', label: 'Adres' },
      { key: 'show_in_footer', label: 'Footer', type: 'boolean' },
      { key: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
    fields: [
      { key: 'title', label: 'Sayfa Başlığı', required: true },
      { key: 'excerpt', label: 'Kısa Özet', type: 'textarea' },
      { key: 'content', label: 'İçerik', type: 'html', hint: 'HTML kullanabilirsiniz' },
      { key: 'cover_image', label: 'Kapak Görseli' },
      { key: 'show_in_footer', label: 'Footer\'da göster', type: 'boolean' },
      ACTIVE_FIELD, SORT_FIELD,
      { key: 'meta_title', label: 'SEO Başlık' },
      { key: 'meta_description', label: 'SEO Açıklama', type: 'textarea' },
    ],
  },

  faqs: {
    title: 'Sıkça Sorulan Sorular',
    singular: 'Soru',
    description: 'Kategorilere ayrılmış SSS içerikleri.',
    icon: HelpCircle,
    columns: [
      { key: 'category', label: 'Kategori', type: 'badge' },
      { key: 'question', label: 'Soru' },
      { key: 'view_count', label: 'Görüntülenme', type: 'number' },
      { key: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
    fields: [
      { key: 'category', label: 'Kategori', hint: 'Örn: Sipariş, Kargo, İade, Ödeme, Ürün' },
      { key: 'question', label: 'Soru', required: true, wide: true },
      { key: 'answer', label: 'Cevap', type: 'html', required: true },
      ACTIVE_FIELD, SORT_FIELD,
    ],
  },

  'blog-posts': {
    title: 'Blog Yazıları',
    singular: 'Yazı',
    description: 'İçerik pazarlaması ve SEO için blog.',
    icon: Newspaper,
    columns: [
      { key: 'cover_image', label: 'Görsel', type: 'image' },
      { key: 'title', label: 'Başlık' },
      { key: 'category_name', label: 'Kategori', type: 'badge' },
      { key: 'published_at', label: 'Yayın', type: 'date' },
      { key: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
    fields: [
      { key: 'title', label: 'Başlık', required: true },
      { key: 'blog_category_id', label: 'Kategori ID', type: 'number' },
      { key: 'excerpt', label: 'Özet', type: 'textarea' },
      { key: 'content', label: 'İçerik', type: 'html' },
      { key: 'cover_image', label: 'Kapak Görseli' },
      { key: 'published_at', label: 'Yayın Tarihi', type: 'date' },
      { key: 'read_minutes', label: 'Okuma Süresi (dk)', type: 'number' },
      { key: 'is_featured', label: 'Öne çıkar', type: 'boolean' },
      ACTIVE_FIELD,
      { key: 'meta_title', label: 'SEO Başlık' },
      { key: 'meta_description', label: 'SEO Açıklama', type: 'textarea' },
    ],
  },

  'blog-categories': {
    title: 'Blog Kategorileri',
    singular: 'Kategori',
    description: 'Blog yazılarının gruplandığı kategoriler.',
    icon: Newspaper,
    columns: [
      { key: 'name', label: 'Ad' },
      { key: 'slug', label: 'Kod' },
      { key: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
    fields: [
      { key: 'name', label: 'Kategori Adı', required: true },
      { key: 'description', label: 'Açıklama', type: 'textarea' },
      ACTIVE_FIELD, SORT_FIELD,
    ],
  },

  attributes: {
    title: 'Özellikler & Filtreler',
    singular: 'Özellik',
    description: 'Kategori bazlı filtre panelini besleyen ürün özellikleri (Renk, Güç, Garanti…).',
    icon: Grid3x3,
    columns: [
      { key: 'name', label: 'Özellik' },
      { key: 'slug', label: 'Kod' },
      { key: 'unit', label: 'Birim' },
      { key: 'input_type', label: 'Tip', type: 'badge' },
      { key: 'is_filterable', label: 'Filtrede', type: 'boolean' },
    ],
    fields: [
      { key: 'name', label: 'Özellik Adı', required: true, hint: 'Örn: Renk, Güç, Garanti Süresi' },
      { key: 'unit', label: 'Birim', hint: 'Örn: W, mAh, yıl' },
      {
        key: 'input_type', label: 'Giriş Tipi', type: 'select', default: 'select',
        options: [
          { value: 'select', label: 'Tek seçim' },
          { value: 'multiselect', label: 'Çoklu seçim' },
          { value: 'text', label: 'Metin' },
          { value: 'number', label: 'Sayı' },
          { value: 'boolean', label: 'Evet/Hayır' },
        ],
      },
      { key: 'is_filterable', label: 'Filtre panelinde göster', type: 'boolean', default: true },
      { key: 'show_in_detail', label: 'Ürün detayında göster', type: 'boolean', default: true },
      SORT_FIELD,
    ],
  },


  'contact-messages': {
    title: 'İletişim Mesajları',
    singular: 'Mesaj',
    description: 'Vitrindeki iletişim formundan gelen mesajlar. Okuyup durumunu ve yanıt notunu güncelleyin; müşteriye e-posta ile dönüş yapın.',
    icon: Mail,
    noCreate: true,
    columns: [
      { key: 'name', label: 'Ad Soyad' },
      { key: 'email', label: 'E-posta' },
      { key: 'phone', label: 'Telefon' },
      { key: 'subject', label: 'Konu' },
      { key: 'status', label: 'Durum', type: 'badge' },
      { key: 'created_at', label: 'Tarih', type: 'date' },
    ],
    fields: [
      {
        key: 'status', label: 'Durum', type: 'select', default: 'new',
        options: [
          { value: 'new', label: 'Yeni' },
          { value: 'read', label: 'Okundu' },
          { value: 'replied', label: 'Yanıtlandı' },
          { value: 'closed', label: 'Kapatıldı' },
        ],
      },
      { key: 'message', label: 'Mesaj', type: 'textarea', wide: true, hint: 'Müşterinin yazdığı metin (salt okunur bilgi olarak saklanır).' },
      { key: 'reply', label: 'Yanıt Notu', type: 'textarea', wide: true, hint: 'Müşteriye verdiğiniz cevabın kaydı. E-posta cevabı posta istemcinizden gönderilir.' },
    ],
  },

  'mail-templates': {
    title: 'Mail Şablonları',
    singular: 'Şablon',
    description: 'Sistemin gönderdiği e-postaların metinleri. {degisken} yer tutucuları kullanılır.',
    icon: Bell,
    columns: [
      { key: 'key', label: 'Anahtar', type: 'badge' },
      { key: 'name', label: 'Şablon' },
      { key: 'subject', label: 'Konu' },
      { key: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
    fields: [
      { key: 'name', label: 'Şablon Adı', required: true },
      { key: 'subject', label: 'E-posta Konusu', required: true, wide: true },
      { key: 'body_html', label: 'HTML Gövde', type: 'html', required: true },
      { key: 'body_text', label: 'Düz Metin Gövde', type: 'textarea' },
      { key: 'cc', label: 'CC' },
      { key: 'bcc', label: 'BCC' },
      ACTIVE_FIELD,
    ],
  },

  'sms-templates': {
    title: 'SMS Şablonları',
    singular: 'Şablon',
    description: 'SMS metinleri. Türkçe karakter kullanımı kredi maliyetini artırır.',
    icon: Bell,
    columns: [
      { key: 'key', label: 'Anahtar', type: 'badge' },
      { key: 'name', label: 'Şablon' },
      { key: 'credit', label: 'Kredi', type: 'number' },
      { key: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
    fields: [
      { key: 'name', label: 'Şablon Adı', required: true },
      {
        key: 'body', label: 'Mesaj Metni', type: 'textarea', required: true, wide: true,
        hint: 'Türkçe karakter kullanırsanız 70 karakterde bir kredi harcanır (aksi hâlde 160).',
      },
      ACTIVE_FIELD,
    ],
  },

  'shipping-companies': {
    title: 'Kargo Firmaları',
    singular: 'Kargo Firması',
    description: 'Anlaşmalı kargo firmaları ve takip adresleri.',
    icon: Truck,
    columns: [
      { key: 'name', label: 'Firma' },
      { key: 'code', label: 'Kod', type: 'badge' },
      { key: 'default_price', label: 'Ücret', type: 'currency' },
      { key: 'has_integration', label: 'Entegrasyon', type: 'boolean' },
      { key: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
    fields: [
      { key: 'name', label: 'Firma Adı', required: true },
      { key: 'code', label: 'Kod', required: true, hint: 'Örn: yurtici, aras, mng' },
      { key: 'logo', label: 'Logo' },
      { key: 'tracking_url', label: 'Takip Adresi', wide: true, hint: 'Takip no yerine {code} yazın' },
      { key: 'default_price', label: 'Varsayılan Ücret', type: 'currency' },
      { key: 'free_limit', label: 'Ücretsiz Kargo Limiti', type: 'currency' },
      { key: 'has_integration', label: 'API entegrasyonu var', type: 'boolean' },
      ACTIVE_FIELD, SORT_FIELD,
    ],
  },

  'menu-items': {
    title: 'Menü Bağlantıları',
    singular: 'Bağlantı',
    description: 'Header ve footer menülerindeki bağlantılar.',
    icon: LayoutList,
    columns: [
      { key: 'menu', label: 'Menü', type: 'badge' },
      { key: 'label', label: 'Etiket' },
      { key: 'url', label: 'Adres' },
      { key: 'device', label: 'Cihaz', type: 'badge' },
      { key: 'is_active', label: 'Aktif', type: 'boolean' },
    ],
    fields: [
      { key: 'menu', label: 'Menü', required: true, hint: 'Örn: header_top, footer_1, mobile' },
      { key: 'label', label: 'Etiket', required: true },
      { key: 'url', label: 'Adres', required: true, hint: 'Örn: /kategori/kisisel-bakim' },
      { key: 'category_id', label: 'Kategori ID', type: 'number', hint: 'Girilirse adres otomatik oluşur' },
      { key: 'image', label: 'Görsel' },
      { key: 'mobile_image', label: 'Mobil Görsel' },
      { key: 'description', label: 'Açıklama', type: 'textarea' },
      { key: 'badge_text', label: 'Rozet Metni' },
      { key: 'badge_color', label: 'Rozet Rengi', placeholder: '#7C3AED' },
      {
        key: 'device', label: 'Görüneceği Cihaz', type: 'select', default: 'all',
        options: [
          { value: 'all', label: 'Tüm cihazlar' },
          { value: 'desktop', label: 'Yalnız masaüstü' },
          { value: 'mobile', label: 'Yalnız mobil' },
        ],
      },
      { key: 'parent_id', label: 'Üst Bağlantı ID', type: 'number' },
      { key: 'is_highlighted', label: 'Vurgulu göster', type: 'boolean' },
      { key: 'open_new_tab', label: 'Yeni sekmede aç', type: 'boolean' },
      ACTIVE_FIELD, SORT_FIELD,
    ],
  },
};

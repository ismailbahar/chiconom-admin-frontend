# fırsattan al — Yönetim Paneli

Çok satıcılı kampanya pazaryerinin yönetim arayüzü. Bağımsız bir uygulamadır:
kendi alan adının **kökünde** yaşar (`admin.firsattanal.com/siparisler`).

`Vite 5 · React 19 · TypeScript · Tailwind 3 · shadcn/ui · TanStack Query + Table · zustand`

## İlgili depolar

| Depo | Ne |
|---|---|
| [firsattanal-backend](https://github.com/ismailbahar/firsattanal-backend) | Laravel API — **zorunlu** |
| [firsattanal-frontend](https://github.com/ismailbahar/firsattanal-frontend) | Müşteri vitrini |
| [firsattanal-bayi-frontend](https://github.com/ismailbahar/firsattanal-bayi-frontend) | Bayi paneli |

## Kurulum

```
KURULUM.bat     npm install + .env
BASLAT.bat      npm run dev  →  http://localhost:5175
```

Elle:

```bash
npm install
cp .env.example .env
npm run dev
```

Backend'in ayakta olması gerekir. `VITE_API_URL` boş bırakılırsa Vite proxy'si
`/api` isteklerini `http://127.0.0.1:8000` adresine yollar.

## Ekranlar

| Bölüm | Ne yapılır |
|---|---|
| Onay Bekleyenler | Ürün/görsel, bayi başvurusu, yorum, soru-cevap, dijital teslimat, kategori talebi |
| Siparişler | Detay, paket durumu, **para iadesi**, POS'tan sorgulama |
| İptal / İade Talepleri | Nihai karar, para iadesi, başarısız iadeyi yeniden deneme |
| Faturalar | Bayinin yüklediği belgeyi onaylama → müşteriye e-posta eki |
| Hakedişler | Dönem kapatma, ödendi işaretleme, komisyon faturası |
| Komisyon Yönetimi | Kural tanımı, **oran hesaplama**, mağaza bazlı etkin oran matrisi |
| Katalog | Ürün, kategori, marka, özellik, kampanya |
| Sistem | Kullanıcılar, roller & yetkiler, ayarlar, medya, şablonlar |

## Yetki modeli

Ekranlar `permission:` bazlı süzülür (Spatie Permission). Yetkisi olmayan
kullanıcı menüyü göremez; sunucu tarafında da aynı ara katman çalışır — arayüz
gizlemesi tek başına güvenlik değildir.

`super-admin` rolü tüm yetkileri geçer.

Bayi kullanıcıları bu panele **giremez**: sunucudaki `admin.only` ara katmanı
`seller_id` dolu kullanıcıları reddeder, giriş ekranı da onları bayi paneline
yönlendirir.

## Yapı

```
src/
  pages/admin/      panel ekranları
  pages/            PanelLogin, PanelPassword, NotFound
  components/panel/ ServerTable, PageHeader, ConfirmDialog, StatusBadge…
  components/ui/    shadcn/ui (Radix) sarmalayıcıları
  hooks/            useServerTable — sunucu taraflı tablo sözleşmesi
  stores/           panelAuthStore (zustand)
  lib/              api (yalnız adminApi), apiError, exportExcel, utils
```

`AdminResource` + `resourceConfigs.ts` ikilisi, basit CRUD ekranlarını
(marka, kupon, banner, sayfa, SSS, blog, şablon…) tek yapılandırma girdisiyle
üretir; backend tarafı da simetriktir (`AdminResourceController`).

`lib/api.ts` **yalnız** `adminApi` dışa aktarır. Bilinçlidir: yönetim
panelinden yanlışlıkla bayi ucuna istek atılamasın.

## Doğrulama

```bash
npx tsc -b --noEmit     # noUnusedLocals açık; build ile aynı katılıkta
npm run build
```

## Üretim

```bash
npm ci
VITE_API_URL=https://api.firsattanal.com \
VITE_STORE_URL=https://firsattanal.com \
VITE_SELLER_URL=https://bayi.firsattanal.com \
npm run build
```

`dist/` statik sunulur. SPA olduğu için web sunucusu tüm yolları
`index.html`'e düşürmelidir:

```nginx
location / { try_files $uri $uri/ /index.html; }
```

Yönetim paneli halka açık olmak zorunda değildir; IP kısıtı ya da VPN arkasına
alınması önerilir.

Backend'de `ADMIN_PANEL_URL` bu adrese ayarlanmalıdır — yönetime giden
bildirim bağlantıları oradan üretilir.

import { useState } from 'react';
import { cn, placeholderGradient } from '@/lib/utils';

interface Props {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  /** Görsel yokken gösterilecek harf/emoji (varsayılan: alt'ın ilk harfi) */
  fallbackText?: string;
  loading?: 'lazy' | 'eager';
}

/**
 * Görsel yükleyici. Kaynak yoksa veya yüklenemezse çökmez; ada göre üretilen
 * sabit bir marka degradesi ve baş harf gösterir. Böylece demo/eksik görselli
 * kayıtlarda da vitrin düzeni bozulmaz.
 */
export default function SmartImage({
  src,
  alt,
  className,
  imgClassName,
  fallbackText,
  loading = 'lazy',
}: Props) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      {showFallback ? (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ background: placeholderGradient(alt || 'firsat') }}
          aria-label={alt}
          role="img"
        >
          <span className="select-none text-3xl font-black text-white/85 drop-shadow-sm">
            {fallbackText ?? alt.trim().charAt(0).toLocaleUpperCase('tr-TR')}
          </span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={loading}
          onError={() => setFailed(true)}
          className={cn('h-full w-full object-cover', imgClassName)}
        />
      )}
    </div>
  );
}

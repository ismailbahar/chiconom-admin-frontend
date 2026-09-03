import SupportScreen from '@/components/panel/SupportScreen';
import { adminApi } from '@/lib/api';

/** Tüm destek talepleri — iç not yazma yetkisi yalnız burada. */
export default function AdminSupport() {
  return <SupportScreen client={adminApi} scope="admin" />;
}

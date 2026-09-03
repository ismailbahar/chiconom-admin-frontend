import { useEffect } from 'react';
import ReportsScreen from '@/components/panel/ReportsScreen';
import { adminApi } from '@/lib/api';

/** Mağaza raporları. */
export default function AdminReports() {
  useEffect(() => {
    document.title = 'Raporlar — Chiconom Yönetim';
  }, []);

  return <ReportsScreen scope="admin" client={adminApi} />;
}

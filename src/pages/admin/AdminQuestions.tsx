import QuestionsScreen from '@/components/panel/QuestionsScreen';
import { adminApi } from '@/lib/api';

/** Ürün soru-cevap moderasyonu. */
export default function AdminQuestions() {
  return <QuestionsScreen client={adminApi} scope="admin" />;
}

import ShelfWithAuth from './shelf-with-auth';

export const metadata = {
  title: 'マイ本棚 | Tsukineko Grimoire',
  description: '保存した論文を管理する個人の本棚',
};

export default function ShelfPage() {
  return <ShelfWithAuth />;
}

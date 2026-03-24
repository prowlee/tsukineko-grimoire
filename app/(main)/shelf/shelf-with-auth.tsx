'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase';
import { ShelfLibrary } from '@/components/features/shelf-library';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ShelfWithAuth() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getClientAuth(), async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        // フォールバック: サーバーセッションを確認
        try {
          const res = await fetch('/api/auth/me');
          if (res.ok) {
            const data = await res.json();
            setUserId(data.uid);
            return;
          }
        } catch { /* noop */ }
        setUserId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  if (userId === undefined) {
    return (
      <div className="flex items-center justify-center h-[calc(100dvh-52px)]">
        <div className="text-purple-300/40 text-sm">読み込み中...</div>
      </div>
    );
  }

  if (userId === null) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center px-4">
        <div className="text-4xl opacity-50">🗂</div>
        <p className="text-purple-200/70 text-sm font-medium">マイ本棚はログインが必要です</p>
        <p className="text-purple-400/40 text-xs max-w-xs">
          Googleアカウントでサインインすると、気になった論文を保存して後で読み返せます
        </p>
        <Link
          href="/login"
          className="mt-2 glow-button px-5 py-2.5 text-sm"
        >
          ログインに進む
        </Link>
      </div>
    );
  }

  return <ShelfLibrary userId={userId} />;
}

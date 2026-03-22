'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase';
import { FileUploader } from '@/components/features/file-uploader';
import { useRouter } from 'next/navigation';

export default function UploadWithAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Firebase クライアント Auth を確認
    const unsubscribe = onAuthStateChanged(getClientAuth(), async (user) => {
      if (user) {
        setUserId(user.uid);
        setLoading(false);
      } else {
        // Firebase クライアント Auth が null でも、サーバー側セッションを確認する
        // （COOP 問題等でクライアント Auth が未初期化の場合のフォールバック）
        try {
          const res = await fetch('/api/auth/me');
          if (res.ok) {
            const data = await res.json();
            setUserId(data.uid);
          } else {
            router.push('/login');
          }
        } catch {
          router.push('/login');
        }
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-purple-300/40 text-sm">読み込み中...</div>
      </div>
    );
  }

  if (!userId) return null;

  return <FileUploader userId={userId} onSuccess={() => router.push('/archive')} />;
}

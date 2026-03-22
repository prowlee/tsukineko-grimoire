'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase';

export default function MainNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    const auth = getClientAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return unsubscribe;
  }, []);

  return (
    <nav className="glass-panel border-x-0 border-t-0 rounded-none px-4 py-3 flex items-center justify-between sticky top-0 z-50">
      <Link href="/grimoire" className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xl">🌙</span>
        <span className="magic-title text-lg font-bold hidden sm:block">Tsukineko Grimoire</span>
        <span className="magic-title text-base font-bold sm:hidden">Grimoire</span>
      </Link>

      <div className="flex items-center gap-0.5 sm:gap-1">
        {/* ゲスト・ログイン共通 */}
        <NavLink pathname={pathname} href="/grimoire" emoji="🔮" label="Consult" />
        <NavLink pathname={pathname} href="/archive"  emoji="📚" label="Archive" />

        {/* ローディング中は何も表示しない */}
        {user === undefined && <div className="w-16" />}

        {/* ログイン済み */}
        {user !== undefined && user !== null && (
          <>
            <NavLink pathname={pathname} href="/archive/upload" emoji="⬆️" label="Upload" />
            <NavLink pathname={pathname} href="/settings"       emoji="⚙️"  label="設定" />
          </>
        )}

        {/* ゲスト */}
        {user !== undefined && user === null && (
          <Link
            href="/login"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
              text-purple-200/70 hover:text-purple-200
              border border-purple-500/25 hover:border-purple-500/50
              hover:bg-purple-700/20 transition-all duration-200 ml-1"
          >
            <span className="hidden md:inline text-xs font-medium">ログインに進む</span>
            <span className="md:hidden text-sm">🔑</span>
          </Link>
        )}
      </div>
    </nav>
  );
}

function NavLink({
  pathname,
  href,
  emoji,
  label,
}: {
  pathname: string;
  href: string;
  emoji: string;
  label: string;
}) {
  const isActive =
    href === '/archive/upload'
      ? pathname === href
      : href === '/archive'
      ? pathname === '/archive'
      : pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-all duration-200
        ${isActive
          ? 'bg-purple-700/30 text-purple-200 border border-purple-500/30'
          : 'text-purple-200/60 hover:text-purple-200 hover:bg-purple-700/20'}
      `}
    >
      <span>{emoji}</span>
      <span className="hidden md:inline">{label}</span>
    </Link>
  );
}

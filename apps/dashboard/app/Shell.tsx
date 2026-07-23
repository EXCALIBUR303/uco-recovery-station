'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth, type SessionUser } from '../lib/api';
import { Alerts } from './Alerts';

/**
 * Client-side auth gate + navigation chrome. Real enforcement is on the API
 * (every request carries the Bearer token and is re-checked server-side); this
 * only decides what to render.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = auth.user();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
    setReady(true);
  }, [router]);

  if (!ready || !user) {
    return <div className="loading" style={{ padding: 40 }}>Loading…</div>;
  }

  const nav = [
    { href: '/', label: 'Machines' },
    // Depositor roster is admin-only (spec §8 vs §9.2).
    ...(user.role === 'admin' ? [{ href: '/depositors', label: 'Depositors' }] : []),
  ];

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          UCO Recovery
          <small>{user.role === 'admin' ? 'Admin' : 'Renter'} dashboard</small>
        </div>
        <nav className="nav">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={isActive(n.href) ? 'active' : ''}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          {user.email}
          <button
            onClick={() => {
              auth.clear();
              router.replace('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <Alerts />
        {children}
      </main>
    </div>
  );
}

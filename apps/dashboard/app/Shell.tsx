'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, auth, type Machine, type SessionUser } from '../lib/api';
import { Alerts } from './Alerts';
import { CommandPalette, type Command } from './CommandPalette';

/**
 * Client-side auth gate plus the app chrome. Real enforcement is on the API —
 * every request carries the Bearer token and is re-checked server-side; this
 * only decides what to render.
 *
 * Also picks the visual register: an admin is an operator and gets the
 * instrument panel; a renter is a customer and gets the report. Set on <html>
 * so the page ground matches, not just this subtree.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const u = auth.user();
    if (!u) {
      router.replace('/login');
      return;
    }
    setUser(u);
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!user) return;
    document.documentElement.dataset.register = user.role === 'admin' ? 'ops' : 'report';
  }, [user]);

  // Live readouts for the rail + palette targets.
  useEffect(() => {
    if (!ready) return;
    const load = () => {
      api.machines().then(setMachines).catch(() => {});
      api.notifications().then((n) => setAlertCount(n.length)).catch(() => {});
    };
    load();
    const h = setInterval(load, 20_000);
    return () => clearInterval(h);
  }, [ready]);

  // close the drawer whenever the route changes
  useEffect(() => setDrawer(false), [pathname]);

  const signOut = useCallback(() => {
    auth.clear();
    router.replace('/login');
  }, [router]);

  const nav = useMemo(() => {
    if (!user) return [];
    return [
      { href: '/', label: 'Machines' },
      ...(user.role === 'admin'
        ? [
            { href: '/depositors', label: 'Depositors' },
            { href: '/renters', label: 'Renters' },
          ]
        : []),
      { href: '/rentals', label: user.role === 'admin' ? 'Rentals' : 'Billing' },
      ...(user.role === 'renter' ? [{ href: '/wallet', label: 'Wallet' }] : []),
      ...(user.role === 'admin' ? [{ href: '/settings', label: 'Settings' }] : []),
    ];
  }, [user]);

  const commands = useMemo<Command[]>(() => {
    const pages: Command[] = nav.map((n) => ({
      id: `nav:${n.href}`,
      label: n.label,
      where: 'Go to',
      run: () => router.push(n.href),
    }));
    const units: Command[] = machines.map((m) => ({
      id: `machine:${m.id}`,
      label: `${m.serialNo}${m.label ? ` · ${m.label}` : ''}`,
      where: 'Machine',
      run: () => router.push(`/machines/${m.id}`),
    }));
    return [...pages, ...units, { id: 'signout', label: 'Sign out', where: 'Account', run: signOut }];
  }, [nav, machines, router, signOut]);

  if (!ready || !user) return <div className="loading" style={{ padding: 40 }}>Loading…</div>;

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const online = machines.filter((m) => m.effectiveStatus === 'in_service').length;

  return (
    <div className="shell">
      <aside className={`sidebar${drawer ? ' open' : ''}`}>
        <div className="brand">
          UCO Recovery
          <small>{user.role === 'admin' ? 'Operations' : 'Renter'}</small>
        </div>

        {/* live instrumentation, not decoration */}
        <div className="rail-mini">
          <div>
            <div className="k">Fleet</div>
            <div className="v">{String(machines.length).padStart(2, '0')}</div>
          </div>
          <div>
            <div className="k">Live</div>
            <div className="v" style={{ color: online === machines.length ? 'var(--ok)' : 'var(--warn)' }}>
              {String(online).padStart(2, '0')}
            </div>
          </div>
          <div>
            <div className="k">Alerts</div>
            <div className="v" style={{ color: alertCount ? 'var(--bad)' : 'var(--ink-3)' }}>
              {String(alertCount).padStart(2, '0')}
            </div>
          </div>
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
          <button onClick={signOut}>Sign out</button>
          <div className="cmdk-nudge">
            <kbd>⌘</kbd>
            <kbd>K</kbd>
            <span>Search</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <Alerts />
        {children}
      </main>

      <button
        className="drawer-toggle"
        aria-label={drawer ? 'Close menu' : 'Open menu'}
        aria-expanded={drawer}
        onClick={() => setDrawer((d) => !d)}
      >
        {drawer ? '×' : '≡'}
      </button>

      <CommandPalette commands={commands} />
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ago, type Notification, type NotificationType } from '../lib/api';

type Severity = 'critical' | 'warning' | 'info';

const META: Record<NotificationType, { text: string; sev: Severity; hint: string }> = {
  offline: { text: 'Offline', sev: 'critical', hint: 'No telemetry received' },
  payout_failed: { text: 'Payout failed', sev: 'critical', hint: 'A depositor was not paid' },
  blacklist: { text: 'Account blacklisted', sev: 'critical', hint: 'Reached the offence limit' },
  drum_full: { text: 'Drum full', sev: 'warning', hint: 'Needs collection' },
  reject_full: { text: 'Reject bucket full', sev: 'warning', hint: 'Needs emptying' },
  rental_overdue: { text: 'Rental overdue', sev: 'warning', hint: 'Payment past due' },
  idle_7day: { text: 'Idle 7+ days', sev: 'warning', hint: 'No activity in a week' },
  excessive_ignores: { text: 'Excessive sub-threshold pours', sev: 'warning', hint: 'Possible abuse' },
  balance_zero: { text: 'Balance depleted', sev: 'info', hint: 'Top up to resume' },
};

const SEV_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
const VISIBLE_LIMIT = 5;

/** One card per (type + machine); duplicates collapse into a count. */
type Group = {
  key: string;
  type: NotificationType;
  where: string | null;
  sev: Severity;
  ids: string[];
  latest: string;
};

function groupAlerts(items: Notification[]): Group[] {
  const map = new Map<string, Group>();
  for (const n of items) {
    const where = n.machine?.serialNo ?? n.depositor?.phone ?? null;
    const key = `${n.type}|${where ?? ''}`;
    const g = map.get(key);
    if (g) {
      g.ids.push(n.id);
      if (n.createdAt > g.latest) g.latest = n.createdAt;
    } else {
      map.set(key, {
        key,
        type: n.type,
        where,
        sev: META[n.type].sev,
        ids: [n.id],
        latest: n.createdAt,
      });
    }
  }
  return [...map.values()].sort(
    (a, b) => SEV_RANK[a.sev] - SEV_RANK[b.sev] || (a.latest < b.latest ? 1 : -1),
  );
}

export function Alerts() {
  const [items, setItems] = useState<Notification[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    () => api.notifications().then(setItems).catch(() => {}),
    [],
  );

  useEffect(() => {
    load();
    const h = setInterval(load, 20_000);
    return () => clearInterval(h);
  }, [load]);

  async function dismiss(ids: string[], key: string) {
    setBusy(key);
    // optimistic: drop them locally, then reconcile with the server
    setItems((cur) => cur.filter((n) => !ids.includes(n.id)));
    try {
      await api.dismissAlerts(ids);
    } finally {
      setBusy(null);
      load();
    }
  }

  async function dismissAll() {
    setBusy('all');
    setItems([]);
    try {
      await api.dismissAllAlerts();
    } finally {
      setBusy(null);
      load();
    }
  }

  if (items.length === 0) return null;

  const groups = groupAlerts(items);
  const critical = groups.filter((g) => g.sev === 'critical').length;
  const shown = expanded ? groups : groups.slice(0, VISIBLE_LIMIT);
  const hidden = groups.length - shown.length;

  return (
    <section className="alerts" aria-label="Alerts">
      <header className="alerts-head">
        <span className="alerts-title">
          {groups.length} {groups.length === 1 ? 'alert' : 'alerts'}
          {critical > 0 && <span className="alerts-crit">{critical} critical</span>}
        </span>
        <button className="alerts-clear" onClick={dismissAll} disabled={busy === 'all'}>
          Dismiss all
        </button>
      </header>

      <ul className="alerts-list">
        {shown.map((g) => {
          const m = META[g.type];
          return (
            <li key={g.key} className={`alert-row ${g.sev}`}>
              <span className="alert-sev" aria-hidden="true" />
              <span className="alert-main">
                <span className="alert-line">
                  {g.where && <strong>{g.where}</strong>}
                  <span className="alert-text">{m.text}</span>
                  {g.ids.length > 1 && <span className="alert-count">×{g.ids.length}</span>}
                </span>
                <span className="alert-sub">
                  {m.hint} · {ago(g.latest)}
                </span>
              </span>
              <button
                className="alert-dismiss"
                aria-label="Dismiss"
                title="Dismiss"
                onClick={() => dismiss(g.ids, g.key)}
                disabled={busy === g.key}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>

      {(hidden > 0 || expanded) && (
        <button className="alerts-toggle" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : `Show ${hidden} more`}
        </button>
      )}
    </section>
  );
}

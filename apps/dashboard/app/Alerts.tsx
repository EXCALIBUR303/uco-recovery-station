'use client';

import { useEffect, useState } from 'react';
import { api, ago, type Notification, type NotificationType } from '../lib/api';

const LABEL: Record<NotificationType, { text: string; tone: string }> = {
  drum_full: { text: 'Drum full — needs collection', tone: 'warn' },
  reject_full: { text: 'Reject bucket full — needs emptying', tone: 'warn' },
  balance_zero: { text: 'Balance depleted — top up to resume', tone: 'info' },
  idle_7day: { text: 'No activity for 7+ days', tone: 'warn' },
  offline: { text: 'Offline — no telemetry received', tone: 'bad' },
  blacklist: { text: 'Account blacklisted', tone: 'bad' },
  excessive_ignores: { text: 'Excessive sub-threshold pours', tone: 'warn' },
  rental_overdue: { text: 'Rental payment overdue', tone: 'warn' },
  payout_failed: { text: 'Payout failed', tone: 'bad' },
};

/**
 * Standing alerts (in-dashboard delivery, spec §7.4). Polls so a machine that
 * goes offline or idle while you're watching surfaces without a reload.
 */
export function Alerts() {
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    let live = true;
    const load = () =>
      api
        .notifications()
        .then((n) => live && setItems(n))
        .catch(() => {});
    load();
    const h = setInterval(load, 20_000);
    return () => {
      live = false;
      clearInterval(h);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="alerts">
      <div className="alerts-head">
        {items.length} open alert{items.length === 1 ? '' : 's'}
      </div>
      <ul>
        {items.map((n) => {
          const l = LABEL[n.type];
          return (
            <li key={n.id} className={`alert ${l.tone}`}>
              <span className="alert-dot" />
              <span className="alert-text">
                {n.machine ? <strong>{n.machine.serialNo}</strong> : null} {l.text}
              </span>
              <span className="alert-time">{ago(n.createdAt)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

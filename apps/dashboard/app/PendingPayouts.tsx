'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ago, rupees, type PendingPayout } from '../lib/api';

/**
 * Admin queue for payouts with no RazorpayX account behind them (see
 * mock-razorpay.client.ts). The depositor was already told they'd been paid
 * at the kiosk — this is where the admin actually sends that UPI transfer by
 * hand and confirms it, or marks it failed if the UPI ID doesn't work.
 */
export function PendingPayouts() {
  const [items, setItems] = useState<PendingPayout[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => api.pendingPayouts().then(setItems).catch(() => {}), []);

  useEffect(() => {
    load();
    const h = setInterval(load, 20_000);
    return () => clearInterval(h);
  }, [load]);

  async function act(id: string, kind: 'confirm' | 'fail') {
    setBusy(id);
    setItems((cur) => cur.filter((p) => p.id !== id));
    try {
      await (kind === 'confirm' ? api.confirmPayout(id) : api.failPayout(id));
    } finally {
      setBusy(null);
      load();
    }
  }

  function copyUpi(upiId: string) {
    navigator.clipboard.writeText(upiId).then(() => {
      setCopied(upiId);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  if (items.length === 0) return null;

  return (
    <section className="alerts" aria-label="Pending payouts">
      <header className="alerts-head">
        <span className="alerts-title">
          Needs manual payout
          <span className="alerts-count">{items.length}</span>
        </span>
      </header>

      <ul className="alerts-list">
        {items.map((p) => (
          <li key={p.id} className="alert-row warning">
            <span className="alert-sev" aria-hidden="true" />
            <span className="alert-main">
              <span className="alert-line">
                <strong className="num">{rupees(p.amountPaise)}</strong>
                <span className="alert-text">
                  to <button className="upi-copy" onClick={() => copyUpi(p.upiId)} title="Copy UPI ID">
                    {p.upiId}
                  </button>
                  {copied === p.upiId && <span className="upi-copied">copied</span>}
                </span>
              </span>
              <span className="alert-sub">
                {p.machineSerial ?? 'unknown station'} · {ago(p.createdAt)}
              </span>
            </span>
            <button
              className="mini-btn"
              disabled={busy === p.id}
              onClick={() => act(p.id, 'confirm')}
            >
              Mark paid
            </button>
            <button
              className="mini-btn danger"
              disabled={busy === p.id}
              onClick={() => act(p.id, 'fail')}
            >
              Failed
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

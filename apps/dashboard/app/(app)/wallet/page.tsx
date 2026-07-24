'use client';

import { useEffect, useState } from 'react';
import { api, rupees, ago, type Wallet } from '../../../lib/api';
import { Badge, Stat } from '../../ui';

const PRESETS = [50000, 100000, 500000]; // ₹500, ₹1000, ₹5000 (paise)

export default function WalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = () => api.wallet().then(setWallet).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function addFunds(amountPaise: number) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await api.topup(amountPaise);
      if (res.isMock) {
        setNote(
          'Top-up captured on the MOCK gateway — no real payment was taken. ' +
            'With real Razorpay keys this would open Checkout.',
        );
        // The mock captures out-of-band; give it a moment, then refresh.
        await new Promise((r) => setTimeout(r, 700));
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Top-up failed');
    } finally {
      setBusy(false);
    }
  }

  if (error && !wallet) return <p className="error">{error}</p>;
  if (!wallet) return <p className="loading">Loading wallet…</p>;

  // Merge top-ups (money in) and payouts (money out) into one activity feed.
  const activity = [
    ...wallet.topups.map((t) => ({
      id: t.id,
      kind: 'in' as const,
      label: 'Top-up',
      amountPaise: t.amountPaise,
      status: t.status,
      createdAt: t.createdAt,
    })),
    ...wallet.payouts.map((p) => ({
      id: p.id,
      kind: 'out' as const,
      label: `Payout${p.machineSerial ? ` · ${p.machineSerial}` : ''}`,
      amountPaise: p.amountPaise,
      status: p.status,
      createdAt: p.createdAt,
    })),
  ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  return (
    <>
      <div className="page-head">
        <h1>Wallet</h1>
        <p>Funds your machines draw on to pay depositors</p>
      </div>

      <div className="grid stat-row">
        <Stat k="Spendable" v={rupees(wallet.spendablePaise)} />
        <Stat k="Balance" v={rupees(wallet.balancePaise)} small />
        <Stat k="Held (in-flight payouts)" v={rupees(wallet.heldPaise)} small />
      </div>

      {Number(wallet.spendablePaise) <= 0 && (
        <div className="warn-note">
          Your balance is empty, so your machine(s) have stopped accepting
          deposits. Add funds to resume.
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 12 }}>Add funds</h2>
        <div className="test-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {PRESETS.map((amt) => (
            <button
              key={amt}
              className="mini-btn"
              disabled={busy}
              onClick={() => addFunds(amt)}
              style={{ padding: '9px 16px', fontSize: '0.9rem' }}
            >
              + {rupees(amt)}
            </button>
          ))}
          {busy && <span className="faint" style={{ alignSelf: 'center' }}>Processing…</span>}
        </div>
        {note && <p className="muted-small" style={{ color: 'var(--warn)', marginTop: 12 }}>{note}</p>}
        {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
      </div>

      <div className="section">
        <h2>Recent activity</h2>
        {activity.length === 0 ? (
          <p className="faint">No activity yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Activity</th>
                  <th>Status</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((a) => (
                  <tr key={a.id}>
                    <td className="faint">{ago(a.createdAt)}</td>
                    <td>{a.label}</td>
                    <td>
                      <Badge
                        tone={
                          a.status === 'succeeded'
                            ? 'ok'
                            : a.status === 'failed'
                              ? 'bad'
                              : 'muted'
                        }
                      >
                        {a.status}
                      </Badge>
                    </td>
                    <td
                      className="num"
                      style={{ color: a.kind === 'in' ? 'var(--accent)' : 'var(--text)' }}
                    >
                      {a.kind === 'in' ? '+' : '−'}
                      {rupees(a.amountPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

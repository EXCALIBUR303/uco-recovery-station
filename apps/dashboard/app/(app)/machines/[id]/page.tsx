'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, kg, rupees, ago, type MachineDetail } from '../../../../lib/api';
import { STATUS, REJECTION_LABEL } from '../../../../lib/status';
import { Badge, Stat, Meter } from '../../../ui';

export default function MachineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [m, setM] = useState<MachineDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.machine(id).then(setM).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!m) return <p className="loading">Loading…</p>;

  const s = STATUS[m.effectiveStatus];
  const attempts = m.counts.accepted + m.counts.rejected + m.counts.ignored;
  const rejRate = attempts ? Math.round((m.counts.rejected / attempts) * 100) : 0;

  return (
    <>
      <Link href="/" className="back">
        ← All machines
      </Link>
      <div className="page-head">
        <h1>
          {m.serialNo} <Badge tone={s.tone}>{s.label}</Badge>
          {m.isIdle && <span className="idle-tag">idle 7d+</span>}
        </h1>
        <p>
          {m.label ?? '—'} · {m.locationText ?? '—'} ·{' '}
          {m.ownership === 'rented' ? `rented by ${m.renter?.displayName}` : 'company-owned'}
        </p>
      </div>

      {m.effectiveStatus !== 'in_service' && (
        <div className="warn-note">{s.hint}</div>
      )}

      <div className="grid stat-row">
        <Stat k="Oil collected" v={kg(m.totalWeightG)} />
        <Stat k="Paid out" v={rupees(m.totalPaidOutPaise)} />
        <Stat k="Rejection rate" v={`${rejRate}%`} />
        <Stat
          k={m.ownership === 'rented' ? 'Renter balance' : 'Company wallet'}
          v={rupees(m.walletBalancePaise)}
          small
        />
      </div>

      <div className="grid stat-row" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
        <div className="card">
          <div className="k faint" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
            Drum fill
          </div>
          <div style={{ marginTop: 10 }}>
            <Meter pct={m.drumFillPct} />
          </div>
        </div>
        <div className="card">
          <div className="k faint" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
            Reject bucket
          </div>
          <div style={{ marginTop: 10 }}>
            <Meter pct={m.rejectFillPct} />
          </div>
        </div>
        <Stat k="Accepted" v={m.counts.accepted} small />
        <Stat k="Rejected" v={m.counts.rejected} small />
        <Stat k="Ignored" v={m.counts.ignored} small />
      </div>

      <div className="section">
        <h2>Recent transactions</h2>
        {m.recent.length === 0 ? (
          <p className="faint">No transactions yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Outcome</th>
                  <th>Reason</th>
                  <th className="num">Weight</th>
                  <th className="num">Paid</th>
                </tr>
              </thead>
              <tbody>
                {m.recent.map((d) => (
                  <tr key={d.id}>
                    <td className="faint">{ago(d.createdAt)}</td>
                    <td>
                      <Badge
                        tone={
                          d.outcome === 'accepted'
                            ? 'ok'
                            : d.outcome === 'rejected'
                              ? 'bad'
                              : 'muted'
                        }
                      >
                        {d.outcome}
                      </Badge>
                    </td>
                    <td className="dim">
                      {d.rejectionReason ? REJECTION_LABEL[d.rejectionReason] : '—'}
                    </td>
                    <td className="num dim">{kg(d.weightDeltaG)}</td>
                    <td className="num dim">{d.amountPaise ? rupees(d.amountPaise) : '—'}</td>
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

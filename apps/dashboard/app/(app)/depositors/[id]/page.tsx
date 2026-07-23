'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, kg, rupees, ago, type DepositorDetail } from '../../../../lib/api';
import { REJECTION_LABEL } from '../../../../lib/status';
import { Badge, Stat } from '../../../ui';

export default function DepositorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<DepositorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.depositor(id).then(setD).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!d) return <p className="loading">Loading…</p>;

  return (
    <>
      <Link href="/depositors" className="back">
        ← All depositors
      </Link>
      <div className="page-head">
        <h1>
          {d.phone}{' '}
          {d.status === 'blacklisted' ? (
            <Badge tone="bad">Blacklisted</Badge>
          ) : (
            <Badge tone="ok">Active</Badge>
          )}
        </h1>
        <p>
          {d.upiId} · registered {ago(d.createdAt)}
        </p>
      </div>

      {d.status === 'blacklisted' && (
        <div className="warn-note">
          Blacklisted{d.blacklistedAt ? ` ${ago(d.blacklistedAt)}` : ''}
          {d.blacklistReason ? ` — ${d.blacklistReason}` : ''}. This UPI can no
          longer transact at any machine.
        </div>
      )}

      <div className="grid stat-row">
        <Stat k="Offences" v={d.offenceCount} />
        <Stat k="Ignored pours" v={d.ignoredCount} />
        <Stat k="Status" v={d.status} small />
      </div>

      {d.statusEvents.length > 0 && (
        <div className="section">
          <h2>Account history</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Change</th>
                  <th>Reason</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {d.statusEvents.map((e) => (
                  <tr key={e.id}>
                    <td className="faint">{ago(e.createdAt)}</td>
                    <td className="dim">
                      {e.fromStatus ?? '—'} → {e.toStatus}
                    </td>
                    <td className="dim">{e.reason ?? '—'}</td>
                    <td className="faint">{e.triggeredBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="section">
        <h2>Recent transactions</h2>
        {d.recent.length === 0 ? (
          <p className="faint">No transactions yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Machine</th>
                  <th>Outcome</th>
                  <th>Reason</th>
                  <th className="num">Weight</th>
                  <th className="num">Paid</th>
                </tr>
              </thead>
              <tbody>
                {d.recent.map((t) => (
                  <tr key={t.id}>
                    <td className="faint">{ago(t.createdAt)}</td>
                    <td className="dim">{t.machine?.serialNo ?? '—'}</td>
                    <td>
                      <Badge
                        tone={
                          t.outcome === 'accepted' ? 'ok' : t.outcome === 'rejected' ? 'bad' : 'muted'
                        }
                      >
                        {t.outcome}
                      </Badge>
                    </td>
                    <td className="dim">
                      {t.rejectionReason ? REJECTION_LABEL[t.rejectionReason] : '—'}
                    </td>
                    <td className="num dim">{kg(t.weightDeltaG)}</td>
                    <td className="num dim">{t.amountPaise ? rupees(t.amountPaise) : '—'}</td>
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

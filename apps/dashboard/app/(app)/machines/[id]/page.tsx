'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  api,
  auth,
  kg,
  rupees,
  ago,
  type ActivitySeries,
  type MachineDetail,
  type RenterRow,
} from '../../../../lib/api';
import { STATUS, REJECTION_LABEL } from '../../../../lib/status';
import { Badge, Stat, Meter } from '../../../ui';
import { MiniBars } from '../../../MiniBars';

export default function MachineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isAdmin = auth.user()?.role === 'admin';
  const [m, setM] = useState<MachineDetail | null>(null);
  const [series, setSeries] = useState<ActivitySeries | null>(null);
  const [renters, setRenters] = useState<RenterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<'none' | 'assign' | 'config'>('none');
  const [renterId, setRenterId] = useState('');
  const [fee, setFee] = useState('8000');
  const [rate, setRate] = useState('');
  const [secret, setSecret] = useState<string | null>(null);

  const load = useCallback(() => {
    api.machine(id).then(setM).catch((e) => setError(e.message));
    api.series(id, 30).then(setSeries).catch(() => {});
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isAdmin) api.renters().then(setRenters).catch(() => {});
  }, [isAdmin]);

  async function act(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(message);
      setPanel('none');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  if (error && !m) return <p className="error">{error}</p>;
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
      {error && <p className="error">{error}</p>}
      {notice && <div className="ok-note">{notice}</div>}

      {isAdmin && (
        <div className="card section admin-bar">
          <div className="row-actions">
            <button className="mini-btn" onClick={() => setPanel(panel === 'assign' ? 'none' : 'assign')}>
              {m.ownership === 'rented' ? 'Reassign / hand back' : 'Assign to renter'}
            </button>
            <button
              className="mini-btn"
              onClick={() => {
                setRate(String(Number(m.ratePerKgPaise) / 100));
                setPanel(panel === 'config' ? 'none' : 'config');
              }}
            >
              Edit rate
            </button>
            <button
              className="mini-btn"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  const r = await api.rotateDeviceSecret(id);
                  setSecret(r.deviceSecret);
                }, 'New device credential issued.')
              }
            >
              Issue device credential
            </button>
          </div>

          {secret && (
            <div className="secret-box">
              <strong>Device secret for {m.serialNo} — shown once:</strong>
              <code>{secret}</code>
              <p className="faint small-note">
                Flash this into the machine's firmware. Telemetry from this machine is
                now rejected without it. We only store a hash, so it can't be shown
                again — issue a new one if it's lost.
              </p>
              <button className="mini-btn" onClick={() => setSecret(null)}>
                I've saved it
              </button>
            </div>
          )}

          {panel === 'assign' && (
            <div className="panel">
              <div className="form-row">
                <label className="field">
                  <span>Renter</span>
                  <select value={renterId} onChange={(e) => setRenterId(e.currentTarget.value)}>
                    <option value="">— company-owned —</option>
                    {(renters ?? [])
                      .filter((r) => !r.pending)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.displayName}
                        </option>
                      ))}
                  </select>
                </label>
                {renterId && (
                  <label className="field">
                    <span>Monthly rent (₹)</span>
                    <input
                      type="number"
                      min={1}
                      value={fee}
                      onChange={(e) => setFee(e.currentTarget.value)}
                    />
                  </label>
                )}
              </div>
              {renters?.some((r) => r.pending) && (
                <p className="faint small-note">
                  Renters awaiting approval aren't listed — approve them first.
                </p>
              )}
              <button
                className="btn compact"
                disabled={busy}
                onClick={() =>
                  act(
                    () =>
                      api.assignMachine(
                        id,
                        renterId || null,
                        renterId ? Math.round(Number(fee) * 100) : undefined,
                      ),
                    renterId ? 'Machine assigned.' : 'Machine handed back to the company.',
                  )
                }
              >
                {renterId ? 'Assign machine' : 'Hand back to company'}
              </button>
            </div>
          )}

          {panel === 'config' && (
            <div className="panel">
              <div className="form-row">
                <label className="field">
                  <span>Payout rate (₹ per kg)</span>
                  <input
                    type="number"
                    min={1}
                    step="0.5"
                    value={rate}
                    onChange={(e) => setRate(e.currentTarget.value)}
                  />
                </label>
              </div>
              <button
                className="btn compact"
                disabled={busy}
                onClick={() =>
                  act(
                    () => api.updateMachine(id, { ratePerKgPaise: Math.round(Number(rate) * 100) }),
                    'Payout rate updated.',
                  )
                }
              >
                Save rate
              </button>
            </div>
          )}
        </div>
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

      {series && (
        <div className="section grid two-up">
          <MiniBars
            title="Attempts per day"
            unit="attempts"
            color="var(--ok)"
            points={series.points.map((p) => ({
              day: p.day,
              value: p.accepted + p.rejected + p.ignored,
            }))}
          />
          <MiniBars
            title="Rejected per day"
            unit="rejected"
            color="var(--warn)"
            points={series.points.map((p) => ({ day: p.day, value: p.rejected }))}
          />
        </div>
      )}

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

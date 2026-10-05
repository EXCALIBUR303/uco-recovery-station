'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  auth,
  kg,
  rupees,
  type ActivityEvent,
  type Machine,
  type MachineStatus,
} from '../../lib/api';
import { STATUS } from '../../lib/status';
import { StatusDot, StatusLabel } from '../StatusDot';
import { Gauge } from '../Gauge';
import { Rolling, Stamp } from '../Numerals';
import { PendingPayouts } from '../PendingPayouts';

type Filt = 'all' | MachineStatus | 'dormant';

const TALLY: { key: Filt; label: string; match: (m: Machine) => boolean }[] = [
  { key: 'in_service', label: 'in service', match: (m) => m.effectiveStatus === 'in_service' },
  { key: 'drum_full', label: 'drum full', match: (m) => m.effectiveStatus === 'drum_full' },
  { key: 'reject_full', label: 'bucket full', match: (m) => m.effectiveStatus === 'reject_full' },
  { key: 'balance_zero', label: 'paused', match: (m) => m.effectiveStatus === 'balance_zero' },
  { key: 'dormant', label: 'dormant', match: (m) => m.isIdle },
  { key: 'offline', label: 'offline', match: (m) => m.effectiveStatus === 'offline' },
];

export default function FleetPage() {
  const router = useRouter();
  const isAdmin = auth.user()?.role === 'admin';
  const [machines, setMachines] = useState<Machine[] | null>(null);
  const [feed, setFeed] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filt, setFilt] = useState<Filt>('all');
  const [clock, setClock] = useState('');

  useEffect(() => {
    const load = () => {
      api.machines().then(setMachines).catch((e) => setError(e.message));
      api.activity(24).then(setFeed).catch(() => {});
    };
    load();
    const h = setInterval(load, 15_000);
    return () => clearInterval(h);
  }, []);

  // live IST clock in the kicker
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: false, timeZone: 'Asia/Kolkata',
        }),
      );
    tick();
    const h = setInterval(tick, 1000);
    return () => clearInterval(h);
  }, []);

  const shown = useMemo(() => {
    if (!machines) return [];
    const needle = q.trim().toLowerCase();
    return machines.filter((m) => {
      if (filt === 'dormant' && !m.isIdle) return false;
      if (filt !== 'all' && filt !== 'dormant' && m.effectiveStatus !== filt) return false;
      if (!needle) return true;
      return `${m.serialNo} ${m.label ?? ''} ${m.locationText ?? ''}`.toLowerCase().includes(needle);
    });
  }, [machines, q, filt]);

  const current = useMemo(
    () => shown.find((m) => m.id === sel) ?? shown[0] ?? null,
    [shown, sel],
  );

  if (error) return <p className="error">{error}</p>;
  if (!machines) return <p className="loading">reading telemetry…</p>;

  return (
    <>
      <div className="page-head">
        <span className="kicker">
          uco operations — {isAdmin ? 'delhi office' : 'your stations'} — <b>{clock} IST</b>
        </span>
        <h1>the fleet, right now</h1>
      </div>

      {isAdmin && <PendingPayouts />}

      {/* status tally — tabular text on hairlines, not a card grid */}
      <div className="tally">
        {TALLY.map((t) => {
          const n = machines.filter(t.match).length;
          return (
            <div key={t.key}>
              {t.key === 'dormant' ? (
                <span className="sdot sdot-outline" />
              ) : (
                <StatusDot status={t.key as MachineStatus} />
              )}
              <span className="t-n">{String(n).padStart(2, '0')}</span>
              <span className="t-l">{t.label}</span>
            </div>
          );
        })}
      </div>

      <div className="canvas">
        {/* ---- left rail: the fleet ---- */}
        <section className="rail" aria-label="Fleet">
          <div className="rail-head">
            <span>fleet — {shown.length}</span>
          </div>
          <div className="rail-search">
            <input
              type="search"
              value={q}
              placeholder="code or city…"
              aria-label="Search machines"
              onChange={(e) => setQ(e.currentTarget.value)}
            />
          </div>
          <div className="rail-chips">
            <button className={`chip${filt === 'all' ? ' on' : ''}`} onClick={() => setFilt('all')}>
              all
            </button>
            {TALLY.map((t) => (
              <button
                key={t.key}
                className={`chip${filt === t.key ? ' on' : ''}`}
                onClick={() => setFilt(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <ul className="rail-list">
            {shown.length === 0 && <li className="rail-row faint">no machine matches</li>}
            {shown.map((m) => (
              <li key={m.id}>
                <button
                  className={`rail-row${current?.id === m.id ? ' sel' : ''}`}
                  onClick={() => setSel(m.id)}
                >
                  <span className="rail-top">
                    <span className="sline">
                      <StatusDot status={m.effectiveStatus} idle={m.isIdle} />
                      <span className="rail-code">{m.serialNo}</span>
                    </span>
                    <span className="rail-levels">
                      D {String(m.drumFillPct ?? 0).padStart(2, '0')}% · B{' '}
                      {String(m.rejectFillPct ?? 0).padStart(2, '0')}%
                    </span>
                  </span>
                  <span className="rail-city">{m.locationText ?? m.label ?? '—'}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* ---- centre stage: the selected machine ---- */}
        <section className="stage" aria-label="Selected machine">
          {!current ? (
            <p className="faint">select a machine</p>
          ) : (
            <>
              <span className="kicker">§ 02 — station</span>
              <h1 style={{ fontSize: 'var(--fs-display-3)' }}>
                {current.serialNo.toLowerCase()}
              </h1>
              <p className="dim" style={{ marginTop: 0 }}>
                {current.locationText ?? '—'} · {current.ownership === 'rented'
                  ? current.renter?.displayName ?? 'rented'
                  : 'company-owned'} · <StatusLabel status={current.effectiveStatus} idle={current.isIdle} />
              </p>

              <div style={{ display: 'flex', gap: 'var(--s7)', margin: 'var(--s6) 0 var(--s5)', flexWrap: 'wrap' }}>
                <Gauge
                  label="drum"
                  value={current.drumLevelKg}
                  capacity={current.drumCapacityKg}
                  unit="KG"
                />
                <Gauge
                  label="reject bucket"
                  value={current.bucketLevelL}
                  capacity={current.bucketCapacityL}
                  unit="L"
                  ticks={4}
                />
              </div>

              <div className="stat-row">
                <div className="card stat">
                  <div className="k">lifetime purchased</div>
                  <div className="v"><Rolling value={kg(current.totalWeightG)} /></div>
                </div>
                <div className="card stat">
                  <div className="k">lifetime paid</div>
                  <div className="v"><Rolling value={rupees(current.totalPaidOutPaise)} /></div>
                </div>
                <div className="card stat">
                  <div className="k">rate</div>
                  <div className="v small">
                    <span className="num">{rupees(current.ratePerKgPaise)}</span>
                    <span className="gauge-unit">/KG</span>
                  </div>
                </div>
                <div className="card stat">
                  <div className="k">last active</div>
                  <div className="v small"><Stamp iso={current.lastActivityAt} /></div>
                </div>
              </div>

              <button
                className="mini-btn"
                style={{ marginTop: 'var(--s4)' }}
                onClick={() => router.push(`/machines/${current.id}`)}
              >
                full station record →
              </button>
            </>
          )}
        </section>

        {/* ---- right column: live ticker ---- */}
        <aside className="ticker-col" aria-label="Live transactions">
          <div className="ticker-head">
            <span>live — last {feed.length}</span>
          </div>
          <ul className="tick-list">
            {feed.length === 0 && <li className="tick faint">no events yet</li>}
            {feed.map((e) => (
              <li
                key={e.id}
                className={`tick ${e.outcome === 'accepted' ? 'acc' : e.outcome === 'rejected' ? 'rej' : 'ign'}`}
              >
                <span className="tick-t">
                  {new Date(e.createdAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                    hour12: false, timeZone: 'Asia/Kolkata',
                  })}
                </span>
                <span className="tick-code">
                  {e.serialNo} {e.outcome === 'accepted' ? 'ACCEPTED' : e.outcome === 'rejected' ? 'REJECTED' : 'IGNORED'}
                </span>
                <span className="tick-v">
                  {(e.weightDeltaG / 1000).toFixed(1)} KG
                  {e.amountPaise ? ` · ${rupees(e.amountPaise)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}

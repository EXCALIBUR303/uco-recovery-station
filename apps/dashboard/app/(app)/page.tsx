'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, kg, rupees, ago, type Machine } from '../../lib/api';
import { STATUS } from '../../lib/status';
import { Badge, Stat, Meter } from '../ui';

export default function MachinesPage() {
  const router = useRouter();
  const [machines, setMachines] = useState<Machine[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.machines().then(setMachines).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!machines) return <p className="loading">Loading machines…</p>;

  const active = machines.filter((m) => m.effectiveStatus === 'in_service').length;
  const needAttention = machines.filter(
    (m) => m.effectiveStatus !== 'in_service' && m.effectiveStatus !== 'offline',
  ).length;
  const offline = machines.filter((m) => m.effectiveStatus === 'offline').length;
  const totalPaid = machines.reduce((s, m) => s + Number(m.totalPaidOutPaise), 0);

  return (
    <>
      <div className="page-head">
        <h1>Machines</h1>
        <p>{machines.length} in the fleet</p>
      </div>

      <div className="grid stat-row">
        <Stat k="Active" v={active} />
        <Stat k="Need attention" v={needAttention} />
        <Stat k="Offline" v={offline} />
        <Stat k="Paid out (all time)" v={rupees(totalPaid)} small />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Machine</th>
              <th>Status</th>
              <th>Ownership</th>
              <th>Drum</th>
              <th>Reject</th>
              <th className="num">Collected</th>
              <th className="num">Paid out</th>
              <th>Last active</th>
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => {
              const s = STATUS[m.effectiveStatus];
              return (
                <tr key={m.id} className="click" onClick={() => router.push(`/machines/${m.id}`)}>
                  <td>
                    <strong>{m.serialNo}</strong>
                    <div className="faint" style={{ fontSize: '0.8rem' }}>
                      {m.label ?? m.locationText ?? '—'}
                    </div>
                  </td>
                  <td>
                    <Badge tone={s.tone}>{s.label}</Badge>
                    {m.isIdle && <span className="idle-tag">idle 7d+</span>}
                  </td>
                  <td className="dim">
                    {m.ownership === 'rented' ? m.renter?.displayName ?? 'Rented' : 'Company'}
                  </td>
                  <td>
                    <Meter pct={m.drumFillPct} />
                  </td>
                  <td>
                    <Meter pct={m.rejectFillPct} />
                  </td>
                  <td className="num dim">{kg(m.totalWeightG)}</td>
                  <td className="num dim">{rupees(m.totalPaidOutPaise)}</td>
                  <td className="faint">{ago(m.lastActivityAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

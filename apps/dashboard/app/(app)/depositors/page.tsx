'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ago, type Depositor } from '../../../lib/api';
import { Badge, Stat } from '../../ui';

export default function DepositorsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Depositor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.depositors().then(setRows).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!rows) return <p className="loading">Loading depositors…</p>;

  const blacklisted = rows.filter((d) => d.status === 'blacklisted').length;
  const withOffences = rows.filter((d) => d.offenceCount > 0 && d.status === 'active').length;

  return (
    <>
      <div className="page-head">
        <h1>Depositors</h1>
        <p>{rows.length} registered accounts</p>
      </div>

      <div className="grid stat-row">
        <Stat k="Accounts" v={rows.length} />
        <Stat k="Blacklisted" v={blacklisted} />
        <Stat k="With offences" v={withOffences} />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Phone</th>
              <th>UPI ID</th>
              <th>Status</th>
              <th className="num">Offences</th>
              <th className="num">Ignored</th>
              <th>Registered</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="click" onClick={() => router.push(`/depositors/${d.id}`)}>
                <td>
                  <strong>{d.phone}</strong>
                </td>
                <td className="dim">{d.upiId}</td>
                <td>
                  {d.status === 'blacklisted' ? (
                    <Badge tone="bad">Blacklisted</Badge>
                  ) : (
                    <Badge tone="ok">Active</Badge>
                  )}
                </td>
                <td className="num">
                  <span style={{ color: d.offenceCount >= 3 ? 'var(--bad)' : d.offenceCount > 0 ? 'var(--warn)' : 'inherit' }}>
                    {d.offenceCount}
                  </span>
                </td>
                <td className="num faint">{d.ignoredCount}</td>
                <td className="faint">{ago(d.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

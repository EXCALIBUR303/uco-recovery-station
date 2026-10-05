'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, rupees, ago, type RenterRow } from '../../../lib/api';
import { Badge, Stat } from '../../ui';

export default function RentersPage() {
  const [rows, setRows] = useState<RenterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [brandName, setBrandName] = useState('');
  const [brandAccent, setBrandAccent] = useState('');

  const load = useCallback(
    () => api.renters().then(setRows).catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  async function approve(id: string) {
    setBusy(id);
    try {
      await api.approveRenter(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not approve');
    } finally {
      setBusy(null);
    }
  }

  function openBranding(r: RenterRow) {
    setEditing(r.id);
    setBrandName(r.brandName ?? '');
    setBrandAccent(r.brandAccent ?? '');
    setError(null);
  }

  async function saveBranding(id: string) {
    setBusy(id);
    try {
      await api.setRenterBranding(id, brandName.trim() || null, brandAccent.trim() || null);
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save branding');
    } finally {
      setBusy(null);
    }
  }

  if (error && !rows) return <p className="error">{error}</p>;
  if (!rows) return <p className="loading">Loading renters…</p>;

  const pending = rows.filter((r) => r.pending).length;
  const totalHeld = rows.reduce((s, r) => s + Number(r.balancePaise), 0);
  const monthly = rows.reduce((s, r) => s + Number(r.monthlyRentPaise), 0);

  return (
    <>
      <div className="page-head">
        <h1>Renters</h1>
        <p>{rows.length} accounts in the rental programme</p>
      </div>

      <div className="grid stat-row">
        <Stat k="Awaiting approval" v={pending} />
        <Stat k="Wallet funds held" v={rupees(totalHeld)} small />
        <Stat k="Monthly recurring" v={rupees(monthly)} small />
      </div>

      {error && <p className="error">{error}</p>}

      {pending > 0 && (
        <div className="warn-note">
          {pending} {pending === 1 ? 'renter is' : 'renters are'} waiting for approval. A
          machine can't be assigned until you approve them.
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Renter</th>
              <th>Status</th>
              <th className="num">Wallet</th>
              <th className="num">Machines</th>
              <th className="num">Monthly rent</th>
              <th>Branding</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.displayName}</strong>
                  <div className="faint" style={{ fontSize: 'var(--fs-3)' }}>
                    {r.email} · joined {ago(r.createdAt)}
                  </div>
                </td>
                <td>
                  {r.pending ? (
                    <Badge tone="warn">Pending</Badge>
                  ) : r.isActive ? (
                    <Badge tone="ok">Approved</Badge>
                  ) : (
                    <Badge tone="muted">Suspended</Badge>
                  )}
                </td>
                <td className="num dim">{rupees(r.balancePaise)}</td>
                <td className="num dim">
                  {r.machines.length === 0 ? (
                    <span className="faint">none</span>
                  ) : (
                    r.machines.map((m) => m.serialNo).join(', ')
                  )}
                </td>
                <td className="num dim">
                  {Number(r.monthlyRentPaise) ? rupees(r.monthlyRentPaise) : '—'}
                </td>
                <td className="dim">
                  {r.brandName || r.brandAccent ? (
                    <span className="brand-chip">
                      {r.brandAccent && (
                        <span className="brand-dot" style={{ background: r.brandAccent }} />
                      )}
                      {r.brandName ?? r.brandAccent}
                    </span>
                  ) : (
                    <span className="faint">default</span>
                  )}
                </td>
                <td>
                  <div className="row-actions">
                    {r.pending && (
                      <button
                        className="mini-btn"
                        disabled={busy === r.id}
                        onClick={() => approve(r.id)}
                      >
                        Approve
                      </button>
                    )}
                    <button className="mini-btn" onClick={() => openBranding(r)}>
                      Branding
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="card section">
          <h2>Depositor-facing branding</h2>
          <p className="faint" style={{ marginTop: -6 }}>
            Leave both empty for the standard kiosk. Setting them shows this renter's
            name and accent colour on their machines' screens.
          </p>
          <div className="form-row">
            <label className="field">
              <span>Brand name</span>
              <input
                type="text"
                value={brandName}
                placeholder="e.g. Green Foods"
                onChange={(e) => setBrandName(e.currentTarget.value)}
              />
            </label>
            <label className="field">
              <span>Accent colour (hex)</span>
              <input
                type="text"
                value={brandAccent}
                placeholder="#C9822A"
                onChange={(e) => setBrandAccent(e.currentTarget.value)}
              />
            </label>
          </div>
          <div className="row-actions">
            <button
              className="btn compact"
              disabled={busy === editing}
              onClick={() => saveBranding(editing)}
            >
              Save branding
            </button>
            <button className="mini-btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

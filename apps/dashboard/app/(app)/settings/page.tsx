'use client';

import { useEffect, useState } from 'react';
import { api, type PlatformSettings } from '../../../lib/api';

const MODES = [
  { value: 'permanent', label: 'Permanent — no reinstatement' },
  { value: 'appealable', label: 'Appealable — an admin can reinstate' },
  { value: 'auto_reset', label: 'Auto-reset after a set number of days' },
];

/**
 * The policies the spec left as open questions, editable instead of hard-coded:
 * blacklist permanence (#1), what counts as activity for the idle check (#2),
 * and the ignore-vs-offence weight threshold (#3).
 */
export default function SettingsPage() {
  const [s, setS] = useState<PlatformSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.settings().then(setS).catch((e) => setError(e.message));
  }, []);

  function set<K extends keyof PlatformSettings>(k: K, v: PlatformSettings[K]) {
    setS((cur) => (cur ? { ...cur, [k]: v } : cur));
    setSaved(false);
  }

  async function save() {
    if (!s) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api.updateSettings(s);
      setS(next);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  if (error && !s) return <p className="error">{error}</p>;
  if (!s) return <p className="loading">Loading settings…</p>;

  return (
    <>
      <div className="page-head">
        <h1>Platform settings</h1>
        <p>Fleet-wide policy. Changes apply immediately to every machine.</p>
      </div>

      {error && <p className="error">{error}</p>}
      {saved && <div className="ok-note">Settings saved.</div>}

      <div className="card section">
        <h2>Fraud &amp; blacklisting</h2>
        <div className="form-row">
          <label className="field">
            <span>Offences before blacklisting</span>
            <input
              type="number"
              min={1}
              value={s.blacklistThreshold}
              onChange={(e) => set('blacklistThreshold', Number(e.currentTarget.value))}
            />
          </label>
          <label className="field">
            <span>Blacklist policy</span>
            <select
              value={s.blacklistMode}
              onChange={(e) => set('blacklistMode', e.currentTarget.value)}
            >
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          {s.blacklistMode === 'auto_reset' && (
            <label className="field">
              <span>Auto-reset after (days)</span>
              <input
                type="number"
                min={1}
                value={s.blacklistAutoResetDays ?? 30}
                onChange={(e) => set('blacklistAutoResetDays', Number(e.currentTarget.value))}
              />
            </label>
          )}
        </div>
        <p className="faint small-note">
          Reinstating a blacklisted depositor is only possible when the policy allows
          appeals.
        </p>
      </div>

      <div className="card section">
        <h2>Deposits</h2>
        <div className="form-row">
          <label className="field">
            <span>Ignore pours under (grams)</span>
            <input
              type="number"
              min={0}
              value={s.defaultMinWeightDeltaG}
              onChange={(e) => set('defaultMinWeightDeltaG', Number(e.currentTarget.value))}
            />
          </label>
        </div>
        <p className="faint small-note">
          Below this weight a pour is treated as no transaction, so an accidental drip
          never counts as an offence. Individual machines can override this.
        </p>
      </div>

      <div className="card section">
        <h2>Monitoring</h2>
        <div className="form-row">
          <label className="field">
            <span>Idle alert after (days)</span>
            <input
              type="number"
              min={1}
              value={s.idleAlertDays}
              onChange={(e) => set('idleAlertDays', Number(e.currentTarget.value))}
            />
          </label>
          <label className="field">
            <span>Mark offline after (seconds)</span>
            <input
              type="number"
              min={30}
              value={s.offlineAfterSeconds}
              onChange={(e) => set('offlineAfterSeconds', Number(e.currentTarget.value))}
            />
          </label>
          <label className="field">
            <span>Rental grace period (days)</span>
            <input
              type="number"
              min={0}
              value={s.rentalGraceDays}
              onChange={(e) => set('rentalGraceDays', Number(e.currentTarget.value))}
            />
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={s.activityCountsRejections}
            onChange={(e) => set('activityCountsRejections', e.currentTarget.checked)}
          />
          <span>
            Count rejected attempts as activity for the idle check
            <em> — off means only paid deposits keep a machine "active"</em>
          </span>
        </label>
      </div>

      <button className="btn compact" disabled={busy} onClick={save}>
        {busy ? 'Saving…' : 'Save settings'}
      </button>
    </>
  );
}

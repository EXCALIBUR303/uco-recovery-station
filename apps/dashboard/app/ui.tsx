import type { Tone } from '../lib/status';

export function Badge({ tone, children, plain }: { tone: Tone; children: React.ReactNode; plain?: boolean }) {
  return <span className={`badge ${tone}${plain ? ' plain' : ''}`}>{children}</span>;
}

export function Stat({ k, v, small }: { k: string; v: React.ReactNode; small?: boolean }) {
  return (
    <div className="card stat">
      <div className="k">{k}</div>
      <div className={`v${small ? ' small' : ''}`}>{v}</div>
    </div>
  );
}

/** Fill meter that turns amber then red as a container approaches full. */
export function Meter({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="faint">—</span>;
  const color = pct >= 90 ? 'var(--bad)' : pct >= 70 ? 'var(--warn)' : 'var(--accent)';
  return (
    <span title={`${pct}%`}>
      <span className="meter">
        <span style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </span>{' '}
      <span className="num dim">{pct}%</span>
    </span>
  );
}

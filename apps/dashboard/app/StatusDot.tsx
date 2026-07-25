import { STATUS, IDLE_MARK } from '../lib/status';
import type { MachineStatus } from '../lib/api';

/**
 * State mark for the fleet rail. The dot's *form* carries the meaning — solid,
 * striped, square, ringed — so the six states stay distinguishable without
 * relying on hue.
 */
export function StatusDot({ status, idle }: { status: MachineStatus; idle?: boolean }) {
  const s = STATUS[status];
  return (
    <span
      className={`sdot sdot-${s.dot}${idle ? ' sdot-idle' : ''}`}
      title={idle ? `${s.hint} · dormant 7d+` : s.hint}
      aria-label={idle ? `${s.label}, dormant` : s.label}
    />
  );
}

export function StatusLabel({ status, idle }: { status: MachineStatus; idle?: boolean }) {
  const s = STATUS[status];
  return (
    <span className="sline">
      <StatusDot status={status} idle={idle} />
      <span className={`slabel tone-${s.tone}`}>{s.label}</span>
      {idle && <span className="slabel-idle">{IDLE_MARK.label}</span>}
    </span>
  );
}

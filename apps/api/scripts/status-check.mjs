/**
 * Exhaustive check of the machine status state machine (DESIGN.md §2),
 * exercising the precedence rules and the idle overlay directly against the
 * compiled pure function — no DB, no server.
 *
 *   npm run build && node scripts/status-check.mjs
 */
import { deriveStatus } from '../dist/status/effective-status.js';

const cfg = { offlineAfterSeconds: 300, idleAlertDays: 7, fullPct: 95 };
const now = new Date('2026-07-23T12:00:00Z');
const secondsAgo = (s) => new Date(now.getTime() - s * 1000);
const daysAgo = (d) => new Date(now.getTime() - d * 86_400_000);

const base = {
  lastTelemetryAt: secondsAgo(10), // fresh
  drumFillPct: 20,
  rejectFillPct: 10,
  ownership: 'company',
  walletSpendablePaise: null,
  lastActivityAt: secondsAgo(60), // recent
};

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = got === want;
  console.log(`${ok ? 'pass ' : 'FAIL '} ${label}${ok ? '' : ` — got ${got}, want ${want}`}`);
  ok ? pass++ : fail++;
};

const status = (over) => deriveStatus({ ...base, ...over }, cfg, now).effectiveStatus;
const idle = (over) => deriveStatus({ ...base, ...over }, cfg, now).isIdle;

// --- baseline ---
check('healthy machine is in_service', status({}), 'in_service');

// --- each blocking state on its own ---
check('drum at 95% is drum_full', status({ drumFillPct: 95 }), 'drum_full');
check('drum at 94% still in_service', status({ drumFillPct: 94 }), 'in_service');
check('reject bucket full', status({ rejectFillPct: 96 }), 'reject_full');
check('rented + zero balance is balance_zero',
  status({ ownership: 'rented', walletSpendablePaise: 0n }), 'balance_zero');
check('company machine never goes balance_zero',
  status({ ownership: 'company', walletSpendablePaise: 0n }), 'in_service');
check('no telemetry is offline', status({ lastTelemetryAt: secondsAgo(301) }), 'offline');

// --- precedence (DESIGN.md §2.2): offline > drum > reject > balance ---
check('offline beats a full drum',
  status({ lastTelemetryAt: secondsAgo(600), drumFillPct: 99 }), 'offline');
check('drum beats reject',
  status({ drumFillPct: 99, rejectFillPct: 99 }), 'drum_full');
check('reject beats balance',
  status({ rejectFillPct: 99, ownership: 'rented', walletSpendablePaise: 0n }), 'reject_full');
check('drum beats balance',
  status({ drumFillPct: 99, ownership: 'rented', walletSpendablePaise: 0n }), 'drum_full');

// --- idle overlay is independent of effective status ---
check('recent activity is not idle', idle({}), false);
check('8 days quiet is idle', idle({ lastActivityAt: daysAgo(8) }), true);
check('never used is idle', idle({ lastActivityAt: null }), true);
check('a machine can be offline AND idle',
  deriveStatus({ ...base, lastTelemetryAt: secondsAgo(999), lastActivityAt: daysAgo(30) }, cfg, now).effectiveStatus,
  'offline');
check('...and the idle flag still rides along',
  deriveStatus({ ...base, lastTelemetryAt: secondsAgo(999), lastActivityAt: daysAgo(30) }, cfg, now).isIdle,
  true);
check('a full drum can still be non-idle if recently used',
  idle({ drumFillPct: 99, lastActivityAt: secondsAgo(30) }), false);

console.log('----------------------------------------');
console.log(`status machine: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

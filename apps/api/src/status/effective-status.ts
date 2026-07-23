/**
 * The machine status state machine (DESIGN.md §2).
 *
 * Section 8's six "states" live on three independent axes — connectivity,
 * availability, and an idle overlay — and two can be true at once. This derives
 * the single displayed `effectiveStatus` from those axes via a fixed
 * precedence, and keeps `isIdle` as a separate flag layered on top.
 *
 * Pure function: no DB, no clock beyond what's passed in, so it can be tested
 * exhaustively.
 */
import type { MachineEffectiveStatus } from '@prisma/client';

export type StatusInputs = {
  lastTelemetryAt: Date | null;
  drumFillPct: number | null;
  rejectFillPct: number | null;
  ownership: 'company' | 'rented';
  /** funding wallet spendable balance in paise (balance - held); null = unknown */
  walletSpendablePaise: bigint | null;
  lastActivityAt: Date | null;
};

export type StatusConfig = {
  offlineAfterSeconds: number;
  idleAlertDays: number;
  /** a container at or above this percent is treated as full */
  fullPct: number;
};

export type DerivedStatus = {
  effectiveStatus: MachineEffectiveStatus;
  isIdle: boolean;
};

const DEFAULT_FULL_PCT = 95;

export function deriveStatus(
  input: StatusInputs,
  config: StatusConfig,
  now: Date = new Date(),
): DerivedStatus {
  const fullPct = config.fullPct ?? DEFAULT_FULL_PCT;

  // Idle is computed independently of everything else (DESIGN.md §2.1): it never
  // replaces the effective status, only rides alongside as a badge.
  const isIdle =
    input.lastActivityAt == null ||
    now.getTime() - input.lastActivityAt.getTime() >
      config.idleAlertDays * 86_400_000;

  // Precedence (DESIGN.md §2.2): offline > drum_full > reject_full >
  // balance_zero > in_service.

  // Offline wins: with stale telemetry we cannot trust the level or balance
  // readings, so nothing below it may be asserted.
  const telemetryAgeMs =
    input.lastTelemetryAt == null
      ? Infinity
      : now.getTime() - input.lastTelemetryAt.getTime();
  if (telemetryAgeMs > config.offlineAfterSeconds * 1000) {
    return { effectiveStatus: 'offline', isIdle };
  }

  // Physical blocks rank above the financial block: a full drum can't take oil
  // regardless of the wallet.
  if (input.drumFillPct != null && input.drumFillPct >= fullPct) {
    return { effectiveStatus: 'drum_full', isIdle };
  }
  if (input.rejectFillPct != null && input.rejectFillPct >= fullPct) {
    return { effectiveStatus: 'reject_full', isIdle };
  }

  // Financial block applies to rented machines only. Company machines draw from
  // the company wallet, treated as always funded (DESIGN.md §2.4).
  if (input.ownership === 'rented' && input.walletSpendablePaise != null && input.walletSpendablePaise <= 0n) {
    return { effectiveStatus: 'balance_zero', isIdle };
  }

  return { effectiveStatus: 'in_service', isIdle };
}

import type { MachineStatus } from './api';

/**
 * Each out-of-service cause is a distinct, clearly labelled state (spec §9.4),
 * so an operator can tell at a glance whether a machine needs a collection, an
 * empty, a top-up, or a site visit — without guessing.
 */
export const STATUS: Record<MachineStatus, { label: string; tone: Tone; hint: string }> = {
  in_service: { label: 'Active', tone: 'ok', hint: 'Operating normally' },
  drum_full: { label: 'Drum full', tone: 'warn', hint: 'Needs collection' },
  reject_full: { label: 'Reject bucket full', tone: 'warn', hint: 'Needs emptying' },
  balance_zero: { label: 'Balance depleted', tone: 'info', hint: 'Renter must top up' },
  offline: { label: 'Offline', tone: 'bad', hint: 'No telemetry received' },
};

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'muted';

export const REJECTION_LABEL: Record<string, string> = {
  not_oil: 'Not oil',
  water_contaminated: 'Contaminated',
  low_quality: 'Low quality',
  below_threshold: 'Below threshold',
};

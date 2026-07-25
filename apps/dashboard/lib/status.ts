import type { MachineStatus } from './api';

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'muted';

/**
 * The six operating states, each with a *shape* as well as a colour.
 *
 * Colour alone would fail a colourblind operator scanning the fleet rail, and
 * two of these states are both red. So each state carries a distinct dot form —
 * solid, striped, hollow, ringed, pulsing — plus a distinct mono label. The
 * pattern is what actually distinguishes them; colour is reinforcement.
 */
export type StatusKey = MachineStatus | 'idle';

export const STATUS: Record<
  MachineStatus,
  { label: string; tone: Tone; hint: string; dot: string }
> = {
  in_service: {
    label: 'active',
    tone: 'ok',
    hint: 'Operating normally',
    dot: 'solid', // filled oil-amber disc
  },
  drum_full: {
    label: 'drum full',
    tone: 'bad',
    hint: 'Main tank at capacity — needs collection',
    dot: 'solid-bad', // filled reject-red disc
  },
  reject_full: {
    label: 'bucket full',
    tone: 'bad',
    hint: 'Waste tank at capacity — needs emptying',
    dot: 'striped', // red with diagonal stripes, so it differs from drum-full by form
  },
  balance_zero: {
    label: 'paused — balance',
    tone: 'muted',
    hint: 'Renter wallet empty — payouts cannot be guaranteed',
    dot: 'square', // grey square, not a disc
  },
  offline: {
    label: 'offline',
    tone: 'muted',
    hint: 'No telemetry received',
    dot: 'pulse', // hollow ring, pulsing
  },
};

/** Idle is an overlay on top of any status, so it carries its own mark. */
export const IDLE_MARK = { label: 'dormant', dot: 'outline' as const };

export const REJECTION_LABEL: Record<string, string> = {
  not_oil: 'not oil',
  water_contaminated: 'contaminated',
  low_quality: 'low quality',
  below_threshold: 'below threshold',
};

/** Which sensor produced the verdict — shown on the rejection readout. */
export const REJECTION_SENSOR: Record<string, string> = {
  not_oil: 'capacitance',
  water_contaminated: 'capacitance',
  low_quality: 'colour',
  below_threshold: 'load cell',
};

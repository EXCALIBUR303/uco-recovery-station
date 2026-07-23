/**
 * Turns raw sensor readings into an accept/reject verdict.
 *
 * This lives on the backend, never on the kiosk (spec §3.5, §5): the decision
 * must be identical at every machine and retunable in one place. It is a pure
 * function so it can be exercised with fixtures long before hardware exists.
 */

export type SensorReadings = {
  /** relative permittivity from the capacitance probe; rises with water content */
  capacitance: number;
  /** colour sensor, 0-255. Lower = darker = more burnt/degraded */
  colorValue: number;
  /** load-cell delta for this pour */
  weightDeltaG: number;
}

export type Calibration = {
  minWeightDeltaG: number;
  capOilMin: number;
  capOilMax: number;
  capContaminatedMax: number;
  colorQualityMin: number;
}

export type RejectionReason =
  | 'not_oil'
  | 'water_contaminated'
  | 'low_quality'
  | 'below_threshold';

export type Verdict =
  | { outcome: 'ignored'; reason: 'below_threshold' }
  | { outcome: 'rejected'; reason: Exclude<RejectionReason, 'below_threshold'> }
  | { outcome: 'accepted'; reason: null };

export function classify(r: SensorReadings, c: Calibration): Verdict {
  // Gate 1 — weight. Deliberately first: an accidental drip or a false trigger
  // must never reach the offence path (spec §5, open question Q3).
  if (r.weightDeltaG < c.minWeightDeltaG) {
    return { outcome: 'ignored', reason: 'below_threshold' };
  }

  // Gate 2 — capacitance. Below the oil band, or so high it reads as straight
  // water, means this was never oil.
  if (r.capacitance < c.capOilMin || r.capacitance > c.capContaminatedMax) {
    return { outcome: 'rejected', reason: 'not_oil' };
  }

  // Between the clean-oil ceiling and the water ceiling: oil, but wet.
  if (r.capacitance > c.capOilMax) {
    return { outcome: 'rejected', reason: 'water_contaminated' };
  }

  // Gate 3 — colour. Reads as oil, but burnt/degraded or a foreign liquid.
  if (r.colorValue < c.colorQualityMin) {
    return { outcome: 'rejected', reason: 'low_quality' };
  }

  return { outcome: 'accepted', reason: null };
}

/** Payout = rate x weight, in whole paise. Integer maths throughout. */
export function payoutPaise(weightDeltaG: number, ratePerKgPaise: bigint): bigint {
  return (BigInt(weightDeltaG) * ratePerKgPaise) / 1000n;
}

'use client';

/**
 * Vertical fill gauge for the drum and reject bucket — a literal cylinder with
 * numbered tick marks, not a progress pill. Reads as a sight-glass on a tank,
 * which is what it represents.
 *
 * Fill eases on data change so a level moving is legible as motion rather than
 * a jump; that easing is the entire motion budget for this component.
 */
export function Gauge({
  label,
  value,
  capacity,
  unit,
  ticks = 4,
}: {
  label: string;
  value: number;
  capacity: number;
  /** shown uppercase beside the readout, e.g. KG or L */
  unit: string;
  ticks?: number;
}) {
  const pct = capacity > 0 ? Math.max(0, Math.min(100, (value / capacity) * 100)) : 0;
  const full = pct >= 95;

  // Tick values from the top down, so the scale reads like a measuring vessel.
  const marks = Array.from({ length: ticks + 1 }, (_, i) => {
    const frac = 1 - i / ticks;
    return { frac, value: capacity * frac };
  });

  return (
    <div className="gauge">
      <div className="gauge-body">
        <svg viewBox="0 0 44 200" className="gauge-svg" role="img"
             aria-label={`${label}: ${value.toFixed(1)} of ${capacity.toFixed(1)} ${unit}`}>
          {/* vessel */}
          <rect x="1" y="1" width="42" height="198" className="gauge-vessel" />
          {/* fill, anchored to the base */}
          <rect
            x="2"
            width="40"
            y={2 + (198 - 2) * (1 - pct / 100)}
            height={(198 - 2) * (pct / 100)}
            className={`gauge-fill${full ? ' full' : ''}`}
          />
          {/* graduation lines across the vessel */}
          {marks.slice(1, -1).map((m) => (
            <line
              key={m.frac}
              x1="1"
              x2="43"
              y1={2 + 196 * (1 - m.frac)}
              y2={2 + 196 * (1 - m.frac)}
              className="gauge-tick"
            />
          ))}
          {/* the capacity line, marked red when reached */}
          {full && <line x1="1" x2="43" y1="3" y2="3" className="gauge-limit" />}
        </svg>

        {/* numbered scale down the side */}
        <ul className="gauge-scale" aria-hidden="true">
          {marks.map((m) => (
            <li key={m.frac} style={{ top: `${(1 - m.frac) * 100}%` }}>
              {m.value.toFixed(0)}
            </li>
          ))}
        </ul>
      </div>

      <div className="gauge-read">
        <div className="gauge-label">{label}</div>
        <div className={`gauge-value num${full ? ' at-limit' : ''}`}>
          {value.toFixed(1)}
          <span className="gauge-of">/ {capacity.toFixed(1)}</span>
          <span className="gauge-unit">{unit}</span>
        </div>
        {full && <div className="gauge-flag">at capacity — needs collection</div>}
      </div>
    </div>
  );
}

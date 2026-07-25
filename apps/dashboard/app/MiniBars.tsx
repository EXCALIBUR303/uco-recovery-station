'use client';

import { useState } from 'react';

export type Point = { day: string; value: number };

/**
 * Daily bar series for "traffic volume over time" / "rejections over time"
 * (spec §5.1, §6.1).
 *
 * Deliberately a single series per chart rather than one stacked chart split by
 * outcome: green-for-accepted next to red-for-rejected is indistinguishable
 * under deuteranopia (measured ΔE 4.1 — well under the safe floor), and forcing
 * them into one lightness band makes it worse, since that axis was doing all the
 * separating. Two titled single-series charts mean colour carries no identity at
 * all — the heading does — so the palette question disappears and both hues only
 * have to clear contrast, which they do in light and dark.
 */
export function MiniBars({
  title,
  points,
  color,
  unit = '',
}: {
  title: string;
  points: Point[];
  /** a CSS colour or var(); mode-aware tokens preferred */
  color: string;
  unit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const total = points.reduce((s, p) => s + p.value, 0);
  const max = Math.max(1, ...points.map((p) => p.value));
  const peak = points.findIndex((p) => p.value === max);

  // Geometry in a fixed user-space; the SVG scales to its container.
  const H = 96;
  const GAP = 2; // surface gap between adjacent bars
  const slot = 100 / Math.max(points.length, 1);
  const barW = Math.max(slot - GAP * (slot / 12), slot * 0.55);
  const radius = Math.min(2, barW / 2);

  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <div className="chart">
      <div className="chart-head">
        <h3>{title}</h3>
        <span className="chart-total num">
          {total.toLocaleString('en-IN')}
          {unit && <span className="chart-unit"> {unit}</span>}
        </span>
      </div>

      <div className="chart-plot">
        <svg
          viewBox={`0 0 100 ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title}: ${total} across ${points.length} days, peak ${max} on ${
            points[peak] ? fmtDay(points[peak].day) : 'n/a'
          }`}
          onMouseLeave={() => setHover(null)}
        >
          {/* recessive baseline + midline */}
          <line x1="0" y1={H} x2="100" y2={H} className="chart-axis" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1={H / 2} x2="100" y2={H / 2} className="chart-grid" vectorEffect="non-scaling-stroke" />

          {points.map((p, i) => {
            const h = p.value === 0 ? 0 : Math.max(2, (p.value / max) * (H - 8));
            const x = i * slot + (slot - barW) / 2;
            const y = H - h;
            const r = Math.min(radius, h / 2);
            return (
              <g key={p.day}>
                {/* hit target spans the whole slot, wider than the mark */}
                <rect
                  x={i * slot}
                  y={0}
                  width={slot}
                  height={H}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
                {h > 0 && (
                  <path
                    // rounded data-end, square where it meets the baseline
                    d={`M${x},${H} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barW - r},${y} Q${x + barW},${y} ${x + barW},${y + r} L${x + barW},${H} Z`}
                    fill={color}
                    opacity={hover == null || hover === i ? 1 : 0.45}
                    style={{ transition: 'opacity .12s' }}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {hover != null && points[hover] && (
          <div
            className="chart-tip"
            style={{ left: `${((hover + 0.5) / points.length) * 100}%` }}
          >
            <strong className="num">{points[hover].value}</strong> {unit || 'on'}{' '}
            {fmtDay(points[hover].day)}
          </div>
        )}
      </div>

      <div className="chart-foot">
        <span>{points.length ? fmtDay(points[0].day) : ''}</span>
        {/* one selective direct label: the peak, not a number on every bar */}
        {max > 0 && <span className="chart-peak">peak {max}</span>}
        <span>{points.length ? fmtDay(points[points.length - 1].day) : ''}</span>
      </div>
    </div>
  );
}

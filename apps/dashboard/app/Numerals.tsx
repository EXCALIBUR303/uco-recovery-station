'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Monospace digit roll: when a value changes, only the digits that actually
 * changed slide vertically. Reads as a mechanical counter rather than a fade,
 * which suits a readout that updates while you're watching it.
 *
 * Non-digits (₹ , . / KG) are rendered statically so they don't jitter.
 */
export function Rolling({ value, className = '' }: { value: string; className?: string }) {
  const [prev, setPrev] = useState(value);
  const shown = useRef(value);

  useEffect(() => {
    if (value !== shown.current) {
      setPrev(shown.current);
      shown.current = value;
    }
  }, [value]);

  const chars = value.split('');
  const prevChars = prev.split('');

  return (
    <span className={`roll num ${className}`} aria-label={value}>
      {chars.map((c, i) => {
        const isDigit = c >= '0' && c <= '9';
        const changed = isDigit && prevChars[i] !== c;
        return (
          <span key={`${i}-${c}`} className={`roll-c${changed ? ' roll-in' : ''}`} aria-hidden="true">
            {c}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Every timestamp carries both readings: absolute IST for the log, relative for
 * the glance. Stacked, with the relative one smaller.
 */
export function Stamp({ iso, className = '' }: { iso: string | null; className?: string }) {
  if (!iso) return <span className="faint num">—</span>;
  const d = new Date(iso);
  const abs = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  const rel =
    s < 60 ? 'just now'
    : s < 3600 ? `${Math.floor(s / 60)}m ago`
    : s < 86400 ? `${Math.floor(s / 3600)}h ago`
    : `${Math.floor(s / 86400)}d ago`;

  return (
    <span className={`stamp ${className}`}>
      <span className="stamp-abs num">{abs} IST</span>
      <span className="stamp-rel num">{rel}</span>
    </span>
  );
}

/** One stroke-based icon family, 20px grid, consistent weight — used only in
 * the sidebar nav so wayfinding doesn't rely on label text alone. */
const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 20 20',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconMachines() {
  return (
    <svg {...base} aria-hidden="true">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 5.5v1.2M10 13.3v1.2M5.5 10h1.2M13.3 10h1.2" />
      <path d="M10 10 L13 7.3" />
    </svg>
  );
}

export function IconDepositors() {
  return (
    <svg {...base} aria-hidden="true">
      <circle cx="7.5" cy="6.5" r="2.6" />
      <path d="M2.8 16c.5-3 2.3-4.6 4.7-4.6s4.2 1.6 4.7 4.6" />
      <path d="M13.5 4.6c1.5.4 2.6 1.7 2.6 3.3 0 1.5-1 2.8-2.4 3.2" />
      <path d="M14.2 11.6c1.9.5 3.2 2 3.5 4.4" />
    </svg>
  );
}

export function IconRenters() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M4 16.5V6.2L10 2.8l6 3.4v10.3" />
      <path d="M4 16.5h12" />
      <path d="M7.6 16.5V11h4.8v5.5" />
      <path d="M7.4 6.6h1.2M11.4 6.6h1.2M7.4 9.4h1.2M11.4 9.4h1.2" />
    </svg>
  );
}

export function IconRentals() {
  return (
    <svg {...base} aria-hidden="true">
      <rect x="3" y="4" width="14" height="12.5" rx="1.5" />
      <path d="M3 8h14" />
      <path d="M6.5 2.5v3M13.5 2.5v3" />
      <path d="M6.5 11.2h2.2M6.5 13.6h5" />
    </svg>
  );
}

export function IconWallet() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M3 6.2A1.7 1.7 0 0 1 4.7 4.5h9.8A1.7 1.7 0 0 1 16.2 6.2v8A1.8 1.8 0 0 1 14.4 16H4.8A1.8 1.8 0 0 1 3 14.2z" />
      <path d="M12.6 10.2h2.8a1 1 0 0 1 1 1v1.1a1 1 0 0 1-1 1h-2.8a1.55 1.55 0 0 1 0-3.1z" />
    </svg>
  );
}

export function IconSettings() {
  return (
    <svg {...base} aria-hidden="true">
      <circle cx="10" cy="10" r="2.7" />
      <path d="M10 3v2.1M10 14.9V17M17 10h-2.1M5.1 10H3M15 5l-1.5 1.5M6.5 13.5 5 15M15 15l-1.5-1.5M6.5 6.5 5 5" />
    </svg>
  );
}

export function IconBilling() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M5 3h10v14l-2-1.3L11 17l-2-1.3L7 17l-2-1.3z" />
      <path d="M7.3 7h5.4M7.3 9.8h5.4" />
    </svg>
  );
}

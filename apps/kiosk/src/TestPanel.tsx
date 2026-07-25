/**
 * Stands in for the ESP32 and for a second phone, so the whole kiosk flow can
 * be driven on one machine before any hardware exists — which is the entire
 * point of build step 2.
 *
 * Not shipped to a real kiosk: gated on VITE_TEST_PANEL, off in production.
 */
type Readings = { capacitance: number; colorValue: number; weightDeltaG: number };

const SHOW = import.meta.env.VITE_TEST_PANEL !== 'off';

// Each preset targets one branch of the backend classifier.
const POURS: { label: string; readings: Readings }[] = [
  { label: 'Clean oil 2.4 kg', readings: { capacitance: 4.0, colorValue: 120, weightDeltaG: 2400 } },
  { label: 'Clean oil 800 g', readings: { capacitance: 3.2, colorValue: 95, weightDeltaG: 800 } },
  { label: 'Water', readings: { capacitance: 78, colorValue: 200, weightDeltaG: 1500 } },
  { label: 'Oil + water', readings: { capacitance: 11, colorValue: 180, weightDeltaG: 1500 } },
  { label: 'Burnt oil', readings: { capacitance: 4.0, colorValue: 15, weightDeltaG: 1500 } },
  { label: 'Drip (40 g)', readings: { capacitance: 4.0, colorValue: 120, weightDeltaG: 40 } },
];

export function TestPanel({
  stage,
  machine,
  error,
  blacklisted,
  payoutIsMock,
  onSimulateScan,
  onPour,
  onReset,
}: {
  stage: string;
  machine: string;
  error: string | null;
  blacklisted: boolean;
  payoutIsMock: boolean;
  onSimulateScan: () => void;
  onPour: (r: Readings) => void;
  onReset: () => void;
}) {
  if (!SHOW) return null;

  return (
    <div class="test-panel">
      <p class="label">
        test panel · {machine} · {stage}
        {blacklisted ? ' · ACCOUNT BLACKLISTED' : ''}
      </p>

      <div class="test-row">
        {stage === 'qr' && (
          <button class="test-btn" onClick={onSimulateScan}>
            Simulate phone scan
          </button>
        )}

        {stage === 'pour' &&
          POURS.map((p) => (
            <button key={p.label} class="test-btn" onClick={() => onPour(p.readings)}>
              {p.label}
            </button>
          ))}

        {stage !== 'language' && (
          <button class="test-btn" onClick={onReset}>
            Reset
          </button>
        )}
      </div>

      {error && <p class="muted-small">{error}</p>}

      {/* Spec §3.6: the Thank-You screen shows once the payout is *initiated*.
          With the mock Razorpay client no real money moves — flag that so a
          demo is never mistaken for a live payment. */}
      {payoutIsMock && (
        <p class="muted-small" style="color:#ffc046">
          Payout initiated on the MOCK gateway — no real money moved. Add
          RazorpayX credentials to pay for real.
        </p>
      )}
      {stage === 'qr' && (
        <p class="muted-small">
          Scan the QR with a phone on the same network, or use Simulate phone scan
          to pair without one.
        </p>
      )}
    </div>
  );
}

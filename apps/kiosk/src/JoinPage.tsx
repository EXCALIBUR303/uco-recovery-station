import { useState } from 'preact/hooks';

/**
 * The page a depositor's phone opens after scanning the kiosk QR (spec §3.3).
 * Runs on the phone, never on the kiosk touchscreen — typing a UPI ID on a
 * public screen is a bad idea. On submit it pairs the phone to the kiosk
 * session; the machine, which is polling, then advances to "pour your oil" on
 * its own.
 *
 * A returning phone is remembered via a device token in localStorage, so a
 * second visit is a single tap with no typing (spec §3.4).
 */
const DEVICE_KEY = 'uco.device';

export function JoinPage({ token }: { token: string }) {
  const savedDevice =
    typeof window !== 'undefined' ? localStorage.getItem(DEVICE_KEY) : null;

  const [phone, setPhone] = useState('');
  const [upiId, setUpiId] = useState('');
  const [state, setState] = useState<'form' | 'sending' | 'done'>('form');
  const [returning, setReturning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pair(body: { phone?: string; upiId?: string; deviceToken?: string }) {
    setState('sending');
    setError(null);
    try {
      const res = await fetch(`/pair/${token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? 'Could not connect');
      if (data.deviceToken) localStorage.setItem(DEVICE_KEY, data.deviceToken);
      setReturning(!!data.returning);
      setState('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setState('form');
    }
  }

  if (state === 'done') {
    return (
      <div class="join">
        <div class="join-card">
          <div class="join-tick">✓</div>
          <h1>{returning ? 'Welcome back' : "You're connected"}</h1>
          <p>Look at the machine and pour your oil when it asks.</p>
        </div>
      </div>
    );
  }

  return (
    <div class="join">
      <div class="join-card">
        <div class="join-brand">Cycoil</div>
        <h1>Connect to get paid</h1>
        <p>Enter your details once. Next time it's a single tap.</p>

        {savedDevice && (
          <button
            class="join-btn secondary"
            disabled={state === 'sending'}
            onClick={() => pair({ deviceToken: savedDevice })}
          >
            Continue as returning user
          </button>
        )}

        {error && <div class="join-error">{error}</div>}

        <label class="join-field">
          <span>Phone number</span>
          <input
            type="tel"
            inputMode="tel"
            placeholder="+91 98765 43210"
            value={phone}
            onInput={(e) => setPhone((e.target as HTMLInputElement).value)}
          />
        </label>
        <label class="join-field">
          <span>UPI ID (where you get paid)</span>
          <input
            type="text"
            autocapitalize="off"
            autocomplete="off"
            placeholder="name@bank"
            value={upiId}
            onInput={(e) => setUpiId((e.target as HTMLInputElement).value)}
          />
        </label>

        <button
          class="join-btn"
          disabled={state === 'sending' || !phone.trim() || !upiId.trim()}
          onClick={() => pair({ phone: phone.trim(), upiId: upiId.trim() })}
        >
          {state === 'sending' ? 'Connecting…' : 'Connect'}
        </button>

        <p class="join-fine">
          Your UPI ID is used only to send your payment. You'll pour your oil at
          the machine, not here.
        </p>
      </div>
    </div>
  );
}

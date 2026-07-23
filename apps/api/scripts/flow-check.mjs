/**
 * End-to-end check of the kiosk flow against a running API.
 *
 * Exercises every branch of the sensor classifier plus the escalation to a
 * blacklist, using fake sensor readings — build step 2 is explicitly meant to
 * be testable before any hardware exists.
 *
 *   node scripts/flow-check.mjs
 */
const API = process.env.API ?? 'http://localhost:3010';
const MACHINE = process.env.MACHINE ?? 'UCO-0001';

let pass = 0;
let fail = 0;

const check = (label, got, want) => {
  const ok = got === want;
  console.log(`${ok ? 'pass ' : 'FAIL '} ${label}${ok ? '' : ` — got ${got}, want ${want}`}`);
  ok ? pass++ : fail++;
};

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

/** One full visit: QR -> pair -> pour -> result. */
async function visit(phone, upiId, readings, deviceToken) {
  const start = await api(`/kiosk/machines/${MACHINE}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ language: 'en' }),
  });
  if (start.body.blocked) return { blocked: true, status: start.body.machineStatus };

  const paired = await api(`/pair/${start.body.pairToken}`, {
    method: 'POST',
    body: JSON.stringify({ phone, upiId, deviceToken }),
  });
  if (paired.status >= 400) {
    return { pairBlocked: true, status: paired.status, message: paired.body.message };
  }

  const result = await api(`/kiosk/sessions/${start.body.sessionId}/deposit`, {
    method: 'POST',
    body: JSON.stringify(readings),
  });
  return { ...result.body, deviceToken: paired.body.deviceToken, returning: paired.body.returning };
}

const stamp = Date.now();
const honest = `+9190000${String(stamp).slice(-5)}`;
const cheat = `+9191000${String(stamp).slice(-5)}`;

console.log('--- honest depositor ---');
const a1 = await visit(honest, `honest${stamp}@upi`, {
  capacitance: 4.0, colorValue: 120, weightDeltaG: 2400,
});
check('clean oil is accepted', a1.outcome, 'accepted');
check('2.4 kg at ₹35/kg pays ₹84', a1.amountPaise, '8400');

const a2 = await visit(honest, null, {
  capacitance: 4.0, colorValue: 120, weightDeltaG: 40,
}, a1.deviceToken);
check('returning phone needs no sign-up', a2.returning, true);
check('a 40 g drip is ignored, not rejected', a2.outcome, 'ignored');
check('...and is not an offence', a2.reason, 'below_threshold');

console.log('\n--- someone trying it on ---');
const b1 = await visit(cheat, `cheat${stamp}@upi`, {
  capacitance: 78, colorValue: 200, weightDeltaG: 1500,
});
check('straight water is not oil', b1.reason, 'not_oil');
check('offence 1 does not blacklist', b1.blacklisted, false);

const b2 = await visit(cheat, null, {
  capacitance: 11, colorValue: 200, weightDeltaG: 1500,
}, b1.deviceToken);
check('oil cut with water is contaminated', b2.reason, 'water_contaminated');
check('offence 2 does not blacklist', b2.blacklisted, false);

const b3 = await visit(cheat, null, {
  capacitance: 4.0, colorValue: 15, weightDeltaG: 1500,
}, b2.deviceToken);
check('burnt oil is low quality', b3.reason, 'low_quality');
check('offence 3 blacklists', b3.blacklisted, true);

const b4 = await visit(cheat, null, {
  capacitance: 4.0, colorValue: 120, weightDeltaG: 2000,
}, b3.deviceToken);
check('blacklisted account is stopped at the QR step', b4.pairBlocked, true);
check('...with 403, before any deposit', b4.status, 403);

console.log('\n----------------------------------------');
console.log(`kiosk flow: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

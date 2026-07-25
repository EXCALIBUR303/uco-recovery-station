/**
 * End-to-end check of the admin management actions (spec §6.2) and the two
 * security gates: telemetry device auth and webhook signature verification.
 *
 *   node scripts/admin-check.mjs
 */
import { createHmac } from 'node:crypto';
import { execSync } from 'node:child_process';

const API = process.env.API ?? 'http://localhost:3010';

let pass = 0, fail = 0;
const check = (label, got, want) => {
  const ok = String(got) === String(want);
  console.log(`${ok ? 'pass ' : 'FAIL '} ${label}${ok ? '' : ` — got ${got}, want ${want}`}`);
  ok ? pass++ : fail++;
};

function psql(sql) {
  const url = 'postgresql://sid@localhost:5432/uco_dev';
  return execSync(`/opt/homebrew/opt/postgresql@17/bin/psql "${url}" -tAc "${sql}"`, {
    encoding: 'utf8',
  }).trim();
}

async function call(path, { method = 'GET', token, body, headers = {}, raw } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  const parsed = await res.json().catch(() => ({}));
  return { status: res.status, body: parsed };
}

const login = async (email, password) =>
  (await call('/auth/login', { method: 'POST', body: { email, password } })).body.token;

const ADMIN = await login('admin@uco.local', 'admin12345');
const RENTER = await login('renter@uco.local', 'renter12345');

// ---------------------------------------------------------- role enforcement
console.log('--- only admins can manage ---');
check('renter cannot list renters', (await call('/renters', { token: RENTER })).status, 403);
check('renter cannot change settings',
  (await call('/settings', { method: 'POST', token: RENTER, body: { idleAlertDays: 3 } })).status, 403);
check('admin can list renters', (await call('/renters', { token: ADMIN })).status, 200);

// ------------------------------------------------------ renter approval gate
console.log('\n--- renter approval gates machine assignment ---');
const stamp = Date.now();
const newRenter = (await call('/auth/register', {
  method: 'POST',
  body: {
    email: `pending${stamp}@example.com`,
    password: 'pending12345',
    displayName: `Pending Co ${stamp}`,
  },
})).body;
check('self-sign-up succeeds', !!newRenter.token, true);

const renters = (await call('/renters', { token: ADMIN })).body;
const pendingRow = renters.find((r) => r.id === newRenter.user.id);
check('new sign-up shows as pending', pendingRow?.pending, true);
check('...and has a wallet at zero', pendingRow?.balancePaise, '0');

// spare machine to experiment with
const spare = psql("select id from machines where serial_no='UCO-0001'");
const assignPending = await call(`/machines/${spare}/assign`, {
  method: 'POST',
  token: ADMIN,
  body: { renterId: newRenter.user.id, monthlyFeePaise: 800000 },
});
check('cannot assign to an unapproved renter', assignPending.status, 400);

check('approve works',
  (await call(`/renters/${newRenter.user.id}/approve`, { method: 'POST', token: ADMIN })).body.approved, true);

// --------------------------------------------------------- assign / unassign
console.log('\n--- assigning a machine ---');
const assigned = await call(`/machines/${spare}/assign`, {
  method: 'POST',
  token: ADMIN,
  body: { renterId: newRenter.user.id, monthlyFeePaise: 800000 },
});
check('assign now succeeds', assigned.body.ownership, 'rented');
check('machine is rented in the db', psql(`select ownership from machines where id='${spare}'`), 'rented');
check('funding wallet repointed to the renter',
  psql(`select w.owner_id from machines m join wallets w on w.id=m.funding_wallet_id where m.id='${spare}'`),
  newRenter.user.id);
check('a rental agreement opened',
  psql(`select count(*) from rental_agreements where machine_id='${spare}' and status='active'`), '1');

const back = await call(`/machines/${spare}/assign`, {
  method: 'POST', token: ADMIN, body: { renterId: null },
});
check('handing back to the company works', back.body.ownership, 'company');
check('agreement terminated',
  psql(`select count(*) from rental_agreements where machine_id='${spare}' and status='active'`), '0');
check('funding wallet back to company',
  psql(`select w.owner_type from machines m join wallets w on w.id=m.funding_wallet_id where m.id='${spare}'`),
  'company');

// ------------------------------------------------------------ machine config
console.log('\n--- adjusting machine settings ---');
const upd = await call(`/machines/${spare}/update`, {
  method: 'POST', token: ADMIN, body: { ratePerKgPaise: 4000, minWeightDeltaG: 120 },
});
check('rate updated to ₹40/kg', upd.body.ratePerKgPaise, '4000');
check('threshold override set', upd.body.minWeightDeltaG, 120);
check('zero rate rejected',
  (await call(`/machines/${spare}/update`, { method: 'POST', token: ADMIN, body: { ratePerKgPaise: 0 } })).status, 400);
await call(`/machines/${spare}/update`, { method: 'POST', token: ADMIN, body: { ratePerKgPaise: 3500 } });

// -------------------------------------------------------- blacklist policy
console.log('\n--- reinstating a blacklisted depositor honours policy ---');
const blacklisted = psql("select id from depositors where status='blacklisted' limit 1");
if (blacklisted) {
  await call('/settings', { method: 'POST', token: ADMIN, body: { blacklistMode: 'permanent' } });
  check('permanent policy blocks reinstatement',
    (await call(`/depositors/${blacklisted}/reinstate`, { method: 'POST', token: ADMIN })).status, 400);

  await call('/settings', { method: 'POST', token: ADMIN, body: { blacklistMode: 'appealable' } });
  const re = await call(`/depositors/${blacklisted}/reinstate`, {
    method: 'POST', token: ADMIN, body: { reason: 'Appeal upheld' },
  });
  check('appealable policy allows reinstatement', re.body.reinstated, true);
  check('depositor is active again',
    psql(`select status from depositors where id='${blacklisted}'`), 'active');
  check('offence count reset', psql(`select offence_count from depositors where id='${blacklisted}'`), '0');
  check('UPI ban lifted',
    psql(`select count(*) from blacklisted_upis b join depositors d on d.upi_id=b.upi_id where d.id='${blacklisted}' and b.lifted_at is null`), '0');
  check('an audit row was written',
    psql(`select count(*) from account_status_events where depositor_id='${blacklisted}' and to_status='active'`) >= '1', true);
} else {
  console.log('  (no blacklisted depositor to test — skipped)');
}

// ------------------------------------------------------ telemetry device auth
console.log('\n--- telemetry device authentication ---');
const rot = await call(`/machines/${spare}/device-secret`, { method: 'POST', token: ADMIN });
const secret = rot.body.deviceSecret;
check('a secret is issued once', typeof secret === 'string' && secret.length > 20, true);
check('only the hash is stored',
  psql(`select device_secret_hash <> '${secret}' from machines where id='${spare}'`), 't');

const serial = rot.body.serialNo;
check('telemetry without the secret is rejected',
  (await call(`/telemetry/${serial}`, { method: 'POST', body: { drumFillPct: 12 } })).status, 401);
check('telemetry with a wrong secret is rejected',
  (await call(`/telemetry/${serial}`, {
    method: 'POST', body: { drumFillPct: 12 }, headers: { 'x-device-secret': 'nope' },
  })).status, 401);
check('telemetry with the right secret is accepted',
  (await call(`/telemetry/${serial}`, {
    method: 'POST', body: { drumFillPct: 12, rejectFillPct: 4 },
    headers: { 'x-device-secret': secret },
  })).body.ok, true);

// This was a test of the mechanism, not real provisioning — un-provision the
// machine again so the other dev scripts (and the heartbeat) keep working. Real
// provisioning happens from the admin dashboard, which shows the secret once.
psql(`update machines set device_secret_hash=null where id='${spare}'`);
check('test machine un-provisioned again',
  psql(`select coalesce(device_secret_hash,'none') from machines where id='${spare}'`), 'none');

// ------------------------------------------------ webhook signature verification
console.log('\n--- webhook signature verification ---');
const payload = JSON.stringify({
  event: 'payout.processed',
  payload: { payout: { entity: { id: 'mock_none', status: 'processed' } } },
});
check('unsigned webhook is rejected',
  (await call('/webhooks/razorpayx', { method: 'POST', raw: payload })).status, 401);
check('badly-signed webhook is rejected',
  (await call('/webhooks/razorpayx', {
    method: 'POST', raw: payload, headers: { 'x-razorpay-signature': 'deadbeef' },
  })).status, 401);

const secretEnv = execSync("grep RAZORPAY_WEBHOOK_SECRET .env | cut -d= -f2- | tr -d '\"'", {
  encoding: 'utf8',
}).trim();
const goodSig = createHmac('sha256', secretEnv).update(payload).digest('hex');
check('correctly-signed webhook is accepted',
  (await call('/webhooks/razorpayx', {
    method: 'POST', raw: payload, headers: { 'x-razorpay-signature': goodSig },
  })).body.received, true);

// ------------------------------------------------------------------- charts
console.log('\n--- activity series for charts ---');
const series = await call(`/machines/${spare}/series?days=14`, { token: ADMIN });
check('series returns the requested span', series.body.days, 14);
check('one bucket per day', series.body.points?.length, 14);
check('buckets carry outcome counts',
  Object.keys(series.body.points?.[0] ?? {}).sort().join(','),
  'accepted,day,ignored,rejected,weightG');

// -------------------------------------------------------------------- branding
console.log('\n--- optional renter branding (open question #4) ---');
const renterId = psql("select id from dashboard_users where email='renter@uco.local'");
// start from the unbranded default so the check is repeatable
await call(`/renters/${renterId}/branding`, {
  method: 'POST', token: ADMIN, body: { brandName: null, brandAccent: null },
});
check('default kiosk has no branding',
  (await call('/kiosk/machines/UCO-0002/sessions', { method: 'POST', body: { language: 'en' } })).body.branding,
  'null');
await call(`/renters/${renterId}/branding`, {
  method: 'POST', token: ADMIN, body: { brandName: 'Green Foods', brandAccent: '#4fb0ff' },
});
const branded = (await call('/kiosk/machines/UCO-0002/sessions', {
  method: 'POST', body: { language: 'en' },
})).body;
check('branded kiosk reports the name', branded.branding?.name, 'Green Foods');
check('...and the accent', branded.branding?.accent, '#4fb0ff');
check('invalid accent rejected',
  (await call(`/renters/${renterId}/branding`, {
    method: 'POST', token: ADMIN, body: { brandAccent: 'blue' },
  })).status, 400);

console.log('----------------------------------------');
console.log(`admin + security: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

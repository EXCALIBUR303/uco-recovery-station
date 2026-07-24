/**
 * End-to-end check of the payout money path against a running API (mock
 * Razorpay). Drives a real deposit through the kiosk on the RENTED machine
 * (UCO-0002), so the renter wallet is debited, and asserts the hold→capture
 * ledger behaviour plus the failure (hold-release) path.
 *
 *   node scripts/payout-check.mjs
 *
 * Reads wallet/ledger state straight from Postgres via `psql`.
 */
import { execSync } from 'node:child_process';

const API = process.env.API ?? 'http://localhost:3010';
const MACHINE = 'UCO-0002'; // rented -> draws from the renter wallet
// Target the wallet that actually funds this machine, so extra renter wallets
// (e.g. from sign-up) don't confuse the query.
const RENTER_WALLET_SQL =
  "select balance_paise||'|'||held_paise from wallets where id = " +
  "(select funding_wallet_id from machines where serial_no='UCO-0002')";

let pass = 0, fail = 0;
const check = (label, got, want) => {
  const ok = String(got) === String(want);
  console.log(`${ok ? 'pass ' : 'FAIL '} ${label}${ok ? '' : ` — got ${got}, want ${want}`}`);
  ok ? pass++ : fail++;
};

function psql(sql) {
  const url = process.env.DATABASE_URL?.replace(/[?&]schema=[^&]*/, '') ??
    'postgresql://sid@localhost:5432/uco_dev';
  return execSync(
    `/opt/homebrew/opt/postgresql@17/bin/psql "${url}" -tAc "${sql}"`,
    { encoding: 'utf8' },
  ).trim();
}

const wallet = () => {
  const [balance, held] = psql(RENTER_WALLET_SQL).split('|').map(BigInt);
  return { balance, held };
};

async function api(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// A full deposit on the rented machine. Returns the deposit result.
async function deposit(readings, upiOverride) {
  const start = await api(`/kiosk/machines/${MACHINE}/sessions`, { language: 'en' });
  if (start.blocked) throw new Error(`machine blocked: ${start.machineStatus}`);
  const stamp = Date.now() + Math.floor(Math.random() * 1000);
  const upi = upiOverride ?? `payout${stamp}@upi`;
  await api(`/pair/${start.pairToken}`, { phone: `+9197${String(stamp).slice(-8)}`, upiId: upi });
  return api(`/kiosk/sessions/${start.sessionId}/deposit`, readings);
}

const settle = () => new Promise((r) => setTimeout(r, 700)); // let mock webhook fire
const CLEAN = { capacitance: 4.0, colorValue: 120, weightDeltaG: 2000 }; // 2kg @ ₹35 = ₹70

// Keep the rented machine online so the offline sweep doesn't block deposits.
await api(`/telemetry/${MACHINE}`, { drumFillPct: 30, rejectFillPct: 10 });

console.log('--- happy path: renter wallet is debited on settlement ---');
const before = wallet();
const d1 = await deposit(CLEAN);
check('deposit accepted', d1.outcome, 'accepted');
check('priced at ₹70 (2kg × ₹35)', d1.amountPaise, '7000');
check('payout initiated (processing)', d1.payoutStatus, 'processing');
check('flagged as mock', d1.payoutIsMock, true);

// Immediately after initiation, funds are held but not yet debited.
const held = wallet();
check('balance unchanged at initiation', held.balance, before.balance);
check('₹70 is held', held.held - before.held, 7000n);

await settle();
const after = wallet();
check('balance debited ₹70 after settlement', before.balance - after.balance, 7000n);
check('hold released after capture', after.held, before.held);

const posting = psql(
  "select amount_paise from ledger_postings p join ledger_journal j on j.id=p.journal_id where j.reason='payout_capture' order by p.id desc limit 1",
);
check('a -7000 capture posting was written', posting, '-7000');

console.log('\n--- failure path: hold released, no debit, alert raised ---');
const beforeF = wallet();
const d2 = await deposit(CLEAN, `loss@fail`); // mock settles @fail as failed
check('deposit still accepted (oil is in the drum)', d2.outcome, 'accepted');
check('payout initiated', d2.payoutStatus, 'processing');
await settle();
const afterF = wallet();
check('balance NOT debited on failure', afterF.balance, beforeF.balance);
check('hold released on failure', afterF.held, beforeF.held);
const failedPayout = psql(
  "select status||'/'||coalesce(failure_reason,'') from payouts where upi_id='loss@fail' order by created_at desc limit 1",
);
check('payout marked failed/settlement_failed', failedPayout, 'failed/settlement_failed');

console.log('\n--- a failed payout is NOT an offence (spec §3.6) ---');
const offenceOfFailUser = psql(
  "select coalesce((select offence_count from depositors where upi_id='loss@fail' limit 1),0)",
);
check('failed-payout depositor has 0 offences', offenceOfFailUser, '0');

console.log('----------------------------------------');
console.log(`payout path: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

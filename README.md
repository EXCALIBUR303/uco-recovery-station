# Cycoil (UCO Recovery Station)

Kiosk app, dashboard, and shared backend for the used-cooking-oil recovery machine..

See [DESIGN.md](DESIGN.md) for the schema, machine state machine, and fraud-flow design.

## Where the build is

Following the spec's build order (DESIGN.md §6):

| # | Step | Status |
|---|---|---|
| 1 | Core data model — machines, users, transactions, offences | **done** |
| 2 | Minimal kiosk app, simulated sensor data | **done** |
| 3 | RazorpayX payouts | **done against a mock** — full money path works; add real credentials to go live (one-line swap) |
| 4 | Offence counting + blacklist logic | **done** (built alongside step 2 — it shares a transaction with recording a rejection, so splitting them would have been wrong) |
| 5 | Admin dashboard | **done** |
| 6 | Renter accounts, wallet, scoped view | **done** — renter login, scoped views, rental billing, and payout-wallet top-up (against the mock) |
| 7 | Idle-machine notifications | **done** (built on the §2 status engine: telemetry ingest, scheduled offline/idle sweeps, in-dashboard alerts) |

**All seven build-order steps are done**, plus the admin management actions the
spec flagged as "implied, to be confirmed during build" (§6.2), the over-time
charts (§5.1/§6.1), optional renter branding (open question #4), and both
security gates (webhook signature verification, telemetry device auth).

Two things remain that need something this repo can't supply:

1. **Real Razorpay credentials** — payments run against a mock until they're set
   (see "Going live with payments"). One-line swap, no code change.
2. **Sensor calibration numbers** — the accept/reject thresholds are placeholders
   until measured on the real hardware.

**No _real_ money moves yet.** The full payout path is built and tested, but it
runs against a **mock** Razorpay client until real credentials are set (see
below). The kiosk's Thank-You screen carries a "MOCK gateway" note so a demo is
never mistaken for a live payment.

## Going live with payments

The payout path selects a real RazorpayX client automatically once these are set
in `apps/api/.env` — no code change:

```bash
RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxx
RAZORPAYX_ACCOUNT_NUMBER=xxxxxxxx
```

Webhooks are signature-verified, so also set the webhook secret from the Razorpay
dashboard — **without it the webhook endpoints reject everything**, deliberately,
since an unverified money webhook is worse than a missing one:

```bash
RAZORPAY_WEBHOOK_SECRET=xxxxxxxx
```

One integration point in `apps/api/src/payments/real-razorpay.client.ts` still
needs a live RazorpayX **test** account to exercise: resolving a depositor's UPI
into a RazorpayX `fund_account`. It's marked with `NOTE:` in the code. Everything
else — the hold→capture/release wallet ledger, idempotency, retries, the failure
paths, signature verification — is done and covered by `scripts/payout-check.mjs`
and `scripts/admin-check.mjs`.

## Machine credentials

Telemetry drives machine status, so a machine can be locked to a credential:
**Machines → pick one → Issue device credential**. The secret is shown once (only
a hash is stored) and must be flashed into that machine's firmware — after that,
telemetry without it is rejected. A machine with no credential yet is still
accepted, so un-provisioned units and local development keep working.

For the dev heartbeat against a provisioned machine:

```bash
DEVICE_SECRET=<secret> node apps/api/scripts/heartbeat.mjs UCO-0001
```

## Layout

```
uco-recovery-station/
├── DESIGN.md               design doc — schema, state machine, fraud flow
└── apps/
    ├── api/                shared backend (NestJS + Prisma + Postgres) :3010
    │   ├── prisma/
    │   │   ├── schema.prisma          the data model
    │   │   ├── migrations/            applied SQL migrations
    │   │   ├── seed.ts                dev fixtures
    │   │   └── verify-invariants.sql  proves the DB refuses bad states
    │   ├── scripts/
    │   │   └── flow-check.mjs         end-to-end check of the kiosk flow
    │   └── src/
    │       ├── health.controller.ts
    │       ├── auth/                  JWT login, guards, role + scope helpers
    │       ├── machines/              scoped machine list + detail
    │       ├── depositors/            admin-only depositor roster
    │       ├── kiosk/
    │       │   ├── sensor-classifier.ts  accept/reject decision (pure fn)
    │       │   ├── kiosk.service.ts      sessions, pairing, offences
    │       │   └── kiosk.controller.ts
    │       ├── status/
    │       │   ├── effective-status.ts   the §2 state machine (pure fn)
    │       │   ├── machine-status.service.ts  recompute + notifications
    │       │   ├── status-sweep.service.ts    scheduled offline/idle sweeps
    │       │   ├── telemetry.controller.ts    machine → platform relay (§7)
    │       │   └── notifications.controller.ts
    │       ├── payments/
    │       │   ├── wallet.service.ts      the money core: reserve/capture/release/credit
    │       │   ├── payout.service.ts      payout lifecycle (hold → settle)
    │       │   ├── topup.service.ts       renter wallet top-up (§7.3)
    │       │   ├── wallet.controller.ts   GET /wallet, POST /wallet/topup
    │       │   ├── razorpay.client.ts     interface (+ mock / real / provider)
    │       │   └── webhook.controller.ts  payout + top-up settlement webhooks
    │       ├── rentals/                   flat-fee billing (Q5)
    │       └── prisma/
    ├── kiosk/              touchscreen app (Preact + Vite) :5173
    │   └── src/
    │       ├── app.tsx            screen state machine
    │       ├── i18n.ts            phrase table per language
    │       ├── TestPanel.tsx      stands in for the ESP32 + a phone
    │       └── screens/
    └── dashboard/          admin + renter dashboard (Next.js) :3020
        ├── app/
        │   ├── login/            sign-in
        │   ├── (app)/            authenticated routes (machines, depositors)
        │   └── Shell.tsx         sidebar + client-side auth gate
        └── lib/
            ├── api.ts            typed API client + formatting
            └── status.ts         the distinct out-of-service labels/colours
```

The dashboard (`apps/dashboard`) comes next. The phone-side sign-up page that
the QR code points at is **not built yet** — use the kiosk's test panel.

## One-time setup

Postgres 17 is already installed and running as a background service, and the
`uco_dev` database exists. The only thing left is putting `psql` on your PATH.

**In Terminal**, paste this once:

```bash
echo 'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

Check it worked:

```bash
psql -d uco_dev -c "\dt"
```

You should see a list of about 17 tables.

## Everyday commands

Run all of these from the project folder:

```bash
cd ~/Claude/uco-recovery-station
```

Start the API (leave it running; press `Ctrl+C` to stop):

```bash
npm run dev:api
```

Then open <http://localhost:3010/health> in your browser — it reports the row
counts and current platform settings.

Start the kiosk app (**in a second Terminal window**, leaving the API running):

```bash
cd ~/Claude/uco-recovery-station && npm run dev -w @uco/kiosk
```

Open <http://localhost:5173>. Drive the whole flow from the test panel along the
bottom: pick a language, **Simulate phone scan**, then one of the pour presets.
Each preset targets a different branch of the sensor logic — clean oil pays out,
water is rejected as "not oil", and a 40 g drip is ignored entirely. Three
rejections in a row on one account triggers the blacklist.

Check the whole kiosk flow from the command line (API must be running):

```bash
node apps/api/scripts/flow-check.mjs
```

Start the dashboard (**a third Terminal window**, API still running):

```bash
cd ~/Claude/uco-recovery-station && npm run dev -w @uco/dashboard
```

Open <http://localhost:3020> and sign in. The admin sees every machine plus the
depositor roster; a renter sees only their own machine(s) and no depositor list.
Machine rows show the distinct out-of-service states (drum full, reject full,
balance depleted, offline) as separate labelled statuses, so you can tell why a
machine stopped without visiting it. Open alerts (offline, idle, drum full, …)
appear in a panel at the top of every page.

### Keeping dev machines "online"

Machine status is derived from telemetry. A background sweep marks any machine
**offline** once its last telemetry is older than 5 minutes (configurable in
`platform_settings.offline_after_seconds`) — correct behaviour, but it means a
dev machine with nothing posting to it goes offline on its own. To simulate the
ESP32 heartbeat and keep a machine live while you work:

```bash
node apps/api/scripts/heartbeat.mjs UCO-0001
```

You can also push a one-off frame to drive a status change — e.g. fill the drum:

```bash
curl -s -X POST http://localhost:3010/telemetry/UCO-0001 \
  -H 'content-type: application/json' -d '{"drumFillPct":98,"rejectFillPct":10}'
```

Check the machine status state machine in isolation (no server needed):

```bash
cd apps/api && npm run build && node scripts/status-check.mjs
```

Check the payout money path (API must be running; drives real deposits on the
rented machine and asserts the hold→capture ledger + failure paths):

```bash
node apps/api/scripts/payout-check.mjs
```

Check the admin actions and both security gates (approval, assignment, pricing,
reinstatement, device auth, webhook signatures, charts, branding):

```bash
node apps/api/scripts/admin-check.mjs
```

## Admin capabilities (spec §6.2)

Signed in as an admin:

- **Renters** — approve new sign-ups (a machine can't be assigned until you do),
  see every renter's wallet balance and monthly rent, and set optional
  depositor-facing branding.
- **Machines → a machine** — assign it to a renter (or hand it back to the
  company), change the payout rate, issue a device credential, and see
  attempts-per-day / rejected-per-day charts.
- **Depositors → a blacklisted account** — review an appeal and reinstate, which
  lifts the UPI ban and resets the offence count. Only possible while the
  blacklist policy allows appeals.
- **Settings** — the policies the spec left open: blacklist permanence and
  threshold, the ignore-vs-offence weight threshold, what counts as activity for
  the idle check, offline and rental-grace windows.

### Trying rental billing

Invoices generate on a daily cron, so a freshly seeded agreement (which starts
"today") has none yet. To see the billing flow now, backdate the agreement and
run the cycle as an admin. Get a token first:

```bash
TOKEN=$(curl -s -X POST http://localhost:3010/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@uco.local","password":"admin12345"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
```

Then trigger billing "as of" a date a couple of months after the agreement
started — the catch-up loop emits one invoice per elapsed month, ages the ones
past grace to overdue, and suspends the agreement:

```bash
curl -s -X POST http://localhost:3010/rentals/run-billing \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"now":"2026-10-01T00:00:00Z"}'
```

Open the **Rentals** tab (admin) or **Billing** tab (renter) to see the
invoices. As admin, "Mark paid" records a payment; clearing all arrears lifts
the suspension and resolves the overdue alert.

Reset the database and reload the sample data. **This erases everything in the
database** and will ask you to type a confirmation first:

```bash
npm run db:reset
```

Load sample data without wiping anything:

```bash
npm run db:seed
```

Browse the database in a visual editor:

```bash
npm run db:studio
```

Check that the database still refuses invalid states:

```bash
npm run db:verify -w @uco/api
```

After editing `apps/api/prisma/schema.prisma`, create a migration:

```bash
npm run db:migrate -w @uco/api
```

## Sample logins

Seeded by `npm run db:seed`. Development only.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@uco.local` | `admin12345` |
| Renter | `renter@uco.local` | `renter12345` |

Sample machines: `UCO-0001` (company-owned) and `UCO-0002` (rented, with a
funded renter wallet and an active rental agreement).

## Notes for whoever builds on this

- **Money is `BigInt` paise, weight is `Int` grams.** Never floats. The API
  serialises BigInt to a string over JSON, so parse accordingly on the client.
- **The database enforces the design's invariants**, not just the application —
  a sub-threshold pour physically cannot be recorded as an offence, a wallet
  cannot go negative, and only one company wallet can exist. Run
  `npm run db:verify -w @uco/api` to see all ten checks.
- **Accept/reject decisions belong on the backend**, never on the kiosk
  (spec §3.5). Thresholds live in the `platform_settings` table and the
  per-machine `min_weight_delta_g` override so they can be tuned fleet-wide
  without reflashing firmware or redeploying the kiosk.
- **Prisma 7** moved the connection URL out of `schema.prisma` into
  `prisma.config.ts`, and the client needs a driver adapter (`@prisma/adapter-pg`).
  Most tutorials online still show the Prisma 6 style.
- **TypeScript is pinned to 6.x** — the Nest CLI cannot build against
  TypeScript 7.0, which dropped the programmatic compiler API.
- **Sensor thresholds in `platform_settings` are placeholders.** The real
  numbers come from the hardware calibration process. Nothing about the
  classifier is trustworthy until those are measured on the real sensors.
- **The kiosk bundle is deliberately small** (~46 kB, 17 kB gzipped) with a
  legacy build for old Android WebView, because the display is a repurposed
  used tablet. Please keep it that way — no heavy UI libraries.
- **The API runs on port 3010**, the dashboard on **3020**, the kiosk on
  **5173** — all clear of the `lifeos` dev server on 3001.
- **All three workspaces are pinned to TypeScript 6.x.** Both the Nest CLI and
  Next's build-time type check break on TypeScript 7.0 (it dropped the
  programmatic compiler API). Don't let anything bump it to 7.
- **Renter scoping is enforced on the backend**, not just hidden in the UI. A
  renter's token only ever returns their own machines; requesting another
  machine's id yields 403. The dashboard nav also hides Depositors for renters,
  but that is cosmetic — the API is the real gate.
- **The dashboard is auth'd with a JWT in localStorage** and a Bearer header.
  Fine for this internal tool; if it ever faces the public internet, move the
  token to an httpOnly cookie.
- **The `/telemetry/:serialNo` ingest endpoint is unauthenticated.** Before any
  real deployment each machine needs a device credential (shared secret or mTLS)
  so telemetry — which drives machine status — can't be spoofed. Flagged in the
  controller.
- **Machine status is always derived, never set by hand.** `deriveStatus()` is
  the single source of truth (offline > drum_full > reject_full > balance_zero >
  in_service, with idle as a separate overlay). If a status ever looks wrong,
  fix the inputs (telemetry, wallet, activity) or that function — don't UPDATE
  the column directly. (Same goes for `is_idle`: setting it by hand orphans the
  idle alert, because recompute only fires/resolves on a transition.)
- **Rental billing and the payout wallet are two separate money streams**
  (open-question Q5). The flat monthly rent is company revenue in
  `rental_invoices`; it never touches the ledger or the payout wallet. A
  suspended rental (arrears past grace) raises an alert and shows on the
  dashboard but does **not** stop the machine — machine operation stays tied to
  the payout wallet balance. Whether unpaid rent should also disable the machine
  is a policy decision left for you.

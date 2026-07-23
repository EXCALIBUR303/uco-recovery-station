# UCO Recovery Station

Kiosk app, dashboard, and shared backend for the used-cooking-oil recovery machine.

See [DESIGN.md](DESIGN.md) for the schema, machine state machine, and fraud-flow design.

## Where the build is

Following the spec's build order (DESIGN.md §6):

| # | Step | Status |
|---|---|---|
| 1 | Core data model — machines, users, transactions, offences | **done** |
| 2 | Minimal kiosk app, simulated sensor data | **done** |
| 3 | RazorpayX payouts | **blocked** — needs RazorpayX credentials |
| 4 | Offence counting + blacklist logic | **done** (built alongside step 2 — it shares a transaction with recording a rejection, so splitting them would have been wrong) |
| 5 | Admin dashboard | next |
| 6 | Renter accounts, wallet, scoped view | not started |
| 7 | Idle-machine notifications | not started |

**Nobody is paid yet.** An accepted deposit is recorded and priced correctly, but
no payout is sent until step 3. The kiosk shows the finished "Thank You" screen,
so do not demo this to anyone as a working payment.

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
    │       ├── kiosk/
    │       │   ├── sensor-classifier.ts  accept/reject decision (pure fn)
    │       │   ├── kiosk.service.ts      sessions, pairing, offences
    │       │   └── kiosk.controller.ts
    │       └── prisma/
    └── kiosk/              touchscreen app (Preact + Vite) :5173
        └── src/
            ├── app.tsx            screen state machine
            ├── i18n.ts            phrase table per language
            ├── TestPanel.tsx      stands in for the ESP32 + a phone
            └── screens/
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
- **The API runs on port 3010**, not 3001, to stay clear of the `lifeos` dev
  server which already uses 3001.

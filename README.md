# UCO Recovery Station

Kiosk app, dashboard, and shared backend for the used-cooking-oil recovery machine.

See [DESIGN.md](DESIGN.md) for the schema, machine state machine, and fraud-flow design.

## Where the build is

Following the spec's build order (DESIGN.md §6):

| # | Step | Status |
|---|---|---|
| 1 | Core data model — machines, users, transactions, offences | **done** |
| 2 | Minimal kiosk app, simulated sensor data | next |
| 3 | RazorpayX payouts | not started |
| 4 | Offence counting + blacklist logic | not started |
| 5 | Admin dashboard | not started |
| 6 | Renter accounts, wallet, scoped view | not started |
| 7 | Idle-machine notifications | not started |

## Layout

```
uco-recovery-station/
├── DESIGN.md               design doc — schema, state machine, fraud flow
└── apps/
    └── api/                shared backend (NestJS + Prisma + Postgres)
        ├── prisma/
        │   ├── schema.prisma          the data model
        │   ├── migrations/            applied SQL migrations
        │   ├── seed.ts                dev fixtures
        │   └── verify-invariants.sql  proves the DB refuses bad states
        └── src/
            ├── main.ts
            ├── app.module.ts
            ├── health.controller.ts
            └── prisma/
```

The kiosk (`apps/kiosk`) and dashboard (`apps/dashboard`) apps come next.

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

Then open <http://localhost:3001/health> in your browser — it reports the row
counts and current platform settings.

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

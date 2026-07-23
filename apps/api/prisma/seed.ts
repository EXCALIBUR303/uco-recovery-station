/**
 * Seeds the minimum a developer needs to exercise the data model:
 * platform settings, the company wallet, an admin, and two machines
 * (one company-owned, one rented) with a funded renter wallet.
 *
 * Idempotent — safe to run repeatedly.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';

try {
  process.loadEnvFile('.env');
} catch {
  /* env already exported */
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const rupees = (n: number) => BigInt(Math.round(n * 100)); // -> paise

async function main() {
  // ---- global tunables (DESIGN.md §0; all still open questions) ----------
  const settings = await prisma.platformSettings.upsert({
    where: { id: true },
    update: {},
    create: {
      id: true,
      defaultMinWeightDeltaG: 100,
      blacklistThreshold: 3,
      blacklistMode: 'permanent',
      idleAlertDays: 7,
      activityCountsRejections: true,
      offlineAfterSeconds: 300,
      rentalGraceDays: 7,
    },
  });

  // ---- the single company wallet ----------------------------------------
  // Funds payouts at company-owned machines. Guarded by the `one_company_wallet`
  // partial unique index, so this can never accidentally become two.
  let companyWallet = await prisma.wallet.findFirst({
    where: { ownerType: 'company', ownerId: null },
  });
  if (!companyWallet) {
    companyWallet = await prisma.wallet.create({
      data: { ownerType: 'company', balancePaise: rupees(100_000) },
    });
  }

  // ---- company admin ----------------------------------------------------
  const admin = await prisma.dashboardUser.upsert({
    where: { email: 'admin@uco.local' },
    update: {},
    create: {
      role: 'admin',
      email: 'admin@uco.local',
      passwordHash: hashSync('admin12345', 10),
      displayName: 'Company Admin',
    },
  });

  // ---- a renter, their wallet, and their machine ------------------------
  const renter = await prisma.dashboardUser.upsert({
    where: { email: 'renter@uco.local' },
    update: {},
    create: {
      role: 'renter',
      email: 'renter@uco.local',
      passwordHash: hashSync('renter12345', 10),
      displayName: 'Green Foods Pvt Ltd',
      phone: '+919000000001',
    },
  });

  const renterWallet = await prisma.wallet.upsert({
    where: { ownerType_ownerId: { ownerType: 'renter', ownerId: renter.id } },
    update: {},
    create: {
      ownerType: 'renter',
      ownerId: renter.id,
      balancePaise: rupees(5_000),
    },
  });

  // ---- machines ---------------------------------------------------------
  const companyMachine = await prisma.machine.upsert({
    where: { serialNo: 'UCO-0001' },
    update: {},
    create: {
      serialNo: 'UCO-0001',
      label: 'Andheri West — Market Road',
      locationText: 'Mumbai, MH',
      ownership: 'company',
      fundingWalletId: companyWallet.id,
      ratePerKgPaise: rupees(35), // ₹35/kg
      deployedAt: new Date(),
      // pretend the machine has just checked in, so the kiosk flow is usable
      effectiveStatus: 'in_service',
      lastTelemetryAt: new Date(),
      drumFillPct: 12,
      rejectFillPct: 4,
    },
  });

  const rentedMachine = await prisma.machine.upsert({
    where: { serialNo: 'UCO-0002' },
    update: {},
    create: {
      serialNo: 'UCO-0002',
      label: 'Green Foods — Kitchen Yard',
      locationText: 'Pune, MH',
      ownership: 'rented',
      renterId: renter.id,
      fundingWalletId: renterWallet.id,
      ratePerKgPaise: rupees(35),
      // per-machine override of the ignore threshold (open question Q3)
      minWeightDeltaG: 150,
      deployedAt: new Date(),
      effectiveStatus: 'in_service',
      lastTelemetryAt: new Date(),
      drumFillPct: 63,
      rejectFillPct: 20,
    },
  });

  // ---- rental agreement (Q5 stream (a): flat fee, separate from wallet) --
  const existingAgreement = await prisma.rentalAgreement.findFirst({
    where: { machineId: rentedMachine.id, status: 'active' },
  });
  if (!existingAgreement) {
    const start = new Date();
    const nextBill = new Date(start);
    nextBill.setMonth(nextBill.getMonth() + 1);
    await prisma.rentalAgreement.create({
      data: {
        renterId: renter.id,
        machineId: rentedMachine.id,
        monthlyFeePaise: rupees(8_000), // ₹8,000/month, billed regardless of use
        startDate: start,
        nextBillDate: nextBill,
      },
    });
  }

  console.log('Seeded:');
  console.table([
    { entity: 'platform_settings', detail: `min ${settings.defaultMinWeightDeltaG}g, blacklist at ${settings.blacklistThreshold}` },
    { entity: 'company wallet', detail: `₹${Number(companyWallet.balancePaise) / 100}` },
    { entity: 'admin', detail: admin.email },
    { entity: 'renter', detail: `${renter.email} (₹${Number(renterWallet.balancePaise) / 100})` },
    { entity: 'machine (company)', detail: companyMachine.serialNo },
    { entity: 'machine (rented)', detail: rentedMachine.serialNo },
  ]);
  console.log('\nLogins — admin@uco.local / admin12345, renter@uco.local / renter12345');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

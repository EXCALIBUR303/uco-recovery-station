import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MachineStatusService } from '../status/machine-status.service';
import { PayoutService } from '../payments/payout.service';
import {
  classify,
  payoutPaise,
  type Calibration,
  type SensorReadings,
} from './sensor-classifier';

const PAIR_TOKEN_TTL_MS = 3 * 60 * 1000; // short window — spec §3.2

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class KioskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly status: MachineStatusService,
    private readonly payouts: PayoutService,
  ) {}

  /**
   * Screen 2: the kiosk asks for a session and a QR payload.
   * Refuses outright if the machine is not in service, so the kiosk can show
   * the right "temporarily unavailable" message instead of the deposit flow.
   */
  async startSession(serialNo: string, language?: string) {
    const machine = await this.prisma.machine.findUnique({
      where: { serialNo },
    });
    if (!machine) throw new NotFoundException(`No machine ${serialNo}`);

    if (machine.effectiveStatus !== 'in_service') {
      return {
        blocked: true as const,
        machineStatus: machine.effectiveStatus,
        serialNo: machine.serialNo,
      };
    }

    const pairToken = randomBytes(24).toString('hex');
    const session = await this.prisma.kioskSession.create({
      data: {
        machineId: machine.id,
        language,
        pairTokenHash: sha256(pairToken),
        pairExpiresAt: new Date(Date.now() + PAIR_TOKEN_TTL_MS),
      },
    });

    return {
      blocked: false as const,
      sessionId: session.id,
      machineStatus: machine.effectiveStatus,
      serialNo: machine.serialNo,
      ratePerKgPaise: machine.ratePerKgPaise,
      // The phone opens this URL. Token is single-use and short-lived, so an
      // old QR left on screen cannot be scanned later by someone else.
      pairUrl: `/pair/${pairToken}`,
      pairToken,
      expiresAt: session.pairExpiresAt,
    };
  }

  /** The kiosk polls this to learn when a phone has paired and what happened. */
  async getSession(sessionId: string) {
    const session = await this.prisma.kioskSession.findUnique({
      where: { id: sessionId },
      include: {
        depositor: true,
        machine: true,
        deposits: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!session) throw new NotFoundException('Unknown session');

    const latest = session.deposits[0];
    return {
      sessionId: session.id,
      state: session.state,
      language: session.language,
      machineStatus: session.machine.effectiveStatus,
      depositor: session.depositor
        ? { id: session.depositor.id, phone: session.depositor.phone }
        : null,
      result: latest
        ? {
            outcome: latest.outcome,
            reason: latest.rejectionReason,
            amountPaise: latest.amountPaise,
            weightDeltaG: latest.weightDeltaG,
          }
        : null,
    };
  }

  /**
   * The phone side of the QR scan. Either recognises a returning depositor
   * (device token, "a single tap, not a login" — spec §3.4) or signs up a new
   * one. Blacklist is enforced here, before the deposit step ever appears.
   */
  async pair(
    pairToken: string,
    body: { phone?: string; upiId?: string; deviceToken?: string },
  ) {
    const session = await this.prisma.kioskSession.findUnique({
      where: { pairTokenHash: sha256(pairToken) },
    });
    if (!session) throw new NotFoundException('Invalid or used QR code');
    if (session.state !== 'awaiting_pair') {
      throw new BadRequestException('This QR code has already been used');
    }
    if (!session.pairExpiresAt || session.pairExpiresAt < new Date()) {
      await this.prisma.kioskSession.update({
        where: { id: session.id },
        data: { state: 'expired' },
      });
      throw new BadRequestException('This QR code has expired');
    }

    let depositor = null;

    // returning user — recognised by their own phone's stored token
    if (body.deviceToken) {
      const device = await this.prisma.depositorDevice.findUnique({
        where: { deviceTokenHash: sha256(body.deviceToken) },
        include: { depositor: true },
      });
      depositor = device?.depositor ?? null;
    }

    // ...otherwise by phone number
    if (!depositor && body.phone) {
      depositor = await this.prisma.depositor.findUnique({
        where: { phone: body.phone },
      });
    }

    let issuedDeviceToken: string | undefined;

    // first-time sign-up
    if (!depositor) {
      if (!body.phone || !body.upiId) {
        throw new BadRequestException('Phone number and UPI ID are required');
      }
      const banned = await this.prisma.blacklistedUpi.findUnique({
        where: { upiId: body.upiId },
      });
      // a blacklisted UPI cannot simply register a fresh account
      if (banned && !banned.liftedAt) {
        throw new ForbiddenException(
          'This UPI ID has been restricted and cannot be used.',
        );
      }
      depositor = await this.prisma.depositor.create({
        data: { phone: body.phone, upiId: body.upiId },
      });
    }

    if (depositor.status === 'blacklisted') {
      throw new ForbiddenException(
        'This account has been restricted and can no longer be used.',
      );
    }

    // remember this phone so the next visit needs no typing at all
    if (!body.deviceToken) {
      issuedDeviceToken = randomBytes(24).toString('hex');
      await this.prisma.depositorDevice.create({
        data: {
          depositorId: depositor.id,
          deviceTokenHash: sha256(issuedDeviceToken),
          lastSeenAt: new Date(),
        },
      });
    }

    await this.prisma.kioskSession.update({
      where: { id: session.id },
      data: {
        depositorId: depositor.id,
        state: 'paired',
        pairedAt: new Date(),
        pairTokenHash: null, // single use
      },
    });

    return {
      sessionId: session.id,
      depositorId: depositor.id,
      deviceToken: issuedDeviceToken,
      returning: !issuedDeviceToken,
    };
  }

  /**
   * The pour. In step 2 the readings arrive from a test fixture rather than an
   * ESP32 — the backend cannot tell the difference, which is exactly why the
   * kiosk flow is testable before the hardware exists.
   */
  async submitDeposit(sessionId: string, readings: SensorReadings) {
    const session = await this.prisma.kioskSession.findUnique({
      where: { id: sessionId },
      include: { machine: true, depositor: true },
    });
    if (!session) throw new NotFoundException('Unknown session');
    if (!session.depositorId || !session.depositor) {
      throw new BadRequestException('No phone is paired to this session');
    }
    if (session.state === 'complete') {
      throw new BadRequestException('This session is already finished');
    }

    const settings = await this.prisma.platformSettings.findUniqueOrThrow({
      where: { id: true },
    });
    const machine = session.machine;

    const calibration: Calibration = {
      // per-machine override wins, else the fleet default (Q3)
      minWeightDeltaG:
        machine.minWeightDeltaG ?? settings.defaultMinWeightDeltaG,
      capOilMin: settings.capOilMin,
      capOilMax: settings.capOilMax,
      capContaminatedMax: settings.capContaminatedMax,
      colorQualityMin: settings.colorQualityMin,
    };

    const verdict = classify(readings, calibration);
    const depositorId = session.depositorId;
    const isOffence = verdict.outcome === 'rejected';
    const amountPaise =
      verdict.outcome === 'accepted'
        ? payoutPaise(readings.weightDeltaG, machine.ratePerKgPaise)
        : null;

    const result = await this.prisma.$transaction(async (tx) => {
      // Lock the depositor row: two near-simultaneous rejections must not both
      // read a stale count and skip the blacklist (DESIGN.md §3.5).
      await tx.$queryRaw`SELECT id FROM depositors WHERE id = ${depositorId}::uuid FOR UPDATE`;

      const deposit = await tx.deposit.create({
        data: {
          sessionId: session.id,
          machineId: machine.id,
          depositorId,
          outcome: verdict.outcome,
          rejectionReason: verdict.reason,
          isOffence,
          weightDeltaG: readings.weightDeltaG,
          ratePerKgPaise:
            verdict.outcome === 'accepted' ? machine.ratePerKgPaise : null,
          amountPaise,
          sensorReadings: { ...readings, calibration },
        },
      });

      let blacklisted = false;

      if (verdict.outcome === 'ignored') {
        // never an offence — but tracked, so repeated sub-threshold pours
        // still surface as an abuse signal
        await tx.depositor.update({
          where: { id: depositorId },
          data: { ignoredCount: { increment: 1 } },
        });
      }

      if (isOffence) {
        const updated = await tx.depositor.update({
          where: { id: depositorId },
          data: { offenceCount: { increment: 1 } },
        });

        if (
          updated.offenceCount >= settings.blacklistThreshold &&
          updated.status !== 'blacklisted'
        ) {
          blacklisted = true;
          const reason = `${updated.offenceCount} rejected deposits`;
          await tx.depositor.update({
            where: { id: depositorId },
            data: {
              status: 'blacklisted',
              blacklistedAt: new Date(),
              blacklistReason: reason,
            },
          });
          // blacklist the UPI itself, not just the account
          await tx.blacklistedUpi.upsert({
            where: { upiId: updated.upiId },
            create: {
              upiId: updated.upiId,
              depositorId,
              reason,
            },
            update: { reason, liftedAt: null, liftedBy: null },
          });
          await tx.accountStatusEvent.create({
            data: {
              depositorId,
              fromStatus: 'active',
              toStatus: 'blacklisted',
              reason,
              triggeredBy: 'system:offence_threshold',
            },
          });
          await tx.notification.create({
            data: {
              type: 'blacklist',
              depositorId,
              machineId: machine.id,
              targetRole: 'admin',
              payload: { offenceCount: updated.offenceCount },
            },
          });
        }
      }

      // Idle clock (Q2). A sub-threshold pour is "not a real attempt", so it
      // never counts as activity regardless of the setting.
      const countsAsActivity =
        verdict.outcome === 'accepted' ||
        (isOffence && settings.activityCountsRejections);

      await tx.machine.update({
        where: { id: machine.id },
        data: {
          // Record the activity timestamp only; the idle flag and its
          // notification are derived by MachineStatusService.recompute() after
          // this transaction, so the idle->active transition is seen (and its
          // alert resolved) rather than silently overwritten.
          ...(countsAsActivity ? { lastActivityAt: new Date() } : {}),
          ...(verdict.outcome === 'accepted'
            ? { totalWeightG: { increment: BigInt(readings.weightDeltaG) } }
            : {}),
          // totalPaidOutPaise deliberately not incremented here — it moves
          // when a payout actually settles (build step 3).
        },
      });

      // A sub-threshold pour is "treated as no transaction" (spec §5), so the
      // session stays open and the person can still pour properly.
      if (verdict.outcome !== 'ignored') {
        await tx.kioskSession.update({
          where: { id: session.id },
          data: { state: 'complete', endedAt: new Date() },
        });
      }

      return {
        depositId: deposit.id,
        outcome: verdict.outcome,
        reason: verdict.reason,
        weightDeltaG: readings.weightDeltaG,
        amountPaise,
        blacklisted,
      };
    });

    // Recompute status after the deposit commits: an accepted/rejected pour
    // updated lastActivityAt, so a machine that was idle clears its idle flag
    // and its alert here.
    if (verdict.outcome !== 'ignored') {
      await this.status.recompute(machine.id);
    }

    // Payment. Initiated only after the deposit is durably recorded, and the
    // kiosk gets 'processing' back as soon as RazorpayX accepts it — the
    // Thank-You screen shows on initiation, not on settlement (spec §3.6).
    let payoutStatus: string | null = null;
    let payoutIsMock = false;
    if (result.outcome === 'accepted') {
      const p = await this.payouts.initiate(result.depositId);
      payoutStatus = p.status;
      payoutIsMock = p.isMock;
    }

    return { ...result, payoutStatus, payoutIsMock };
  }
}

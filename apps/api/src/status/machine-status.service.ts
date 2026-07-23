import { Injectable, Logger } from '@nestjs/common';
import type { MachineEffectiveStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { deriveStatus } from './effective-status';

// Which effective statuses have a standing notification, and of what type.
const STATUS_NOTIFICATION: Partial<Record<MachineEffectiveStatus, NotificationType>> = {
  drum_full: 'drum_full',
  reject_full: 'reject_full',
  balance_zero: 'balance_zero',
  offline: 'offline',
};

@Injectable()
export class MachineStatusService {
  private readonly log = new Logger(MachineStatusService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recompute one machine's effective status + idle flag from its current
   * telemetry, wallet, and activity. Writes a status-event row and fires or
   * resolves notifications only when something actually changed. Idempotent.
   */
  async recompute(machineId: string, now: Date = new Date()): Promise<void> {
    const [machine, settings] = await Promise.all([
      this.prisma.machine.findUnique({
        where: { id: machineId },
        include: { fundingWallet: { select: { balancePaise: true, heldPaise: true } } },
      }),
      this.prisma.platformSettings.findUniqueOrThrow({ where: { id: true } }),
    ]);
    if (!machine) return;

    const spendable = machine.fundingWallet
      ? machine.fundingWallet.balancePaise - machine.fundingWallet.heldPaise
      : null;

    const derived = deriveStatus(
      {
        lastTelemetryAt: machine.lastTelemetryAt,
        drumFillPct: machine.drumFillPct,
        rejectFillPct: machine.rejectFillPct,
        ownership: machine.ownership,
        walletSpendablePaise: spendable,
        lastActivityAt: machine.lastActivityAt,
      },
      {
        offlineAfterSeconds: settings.offlineAfterSeconds,
        idleAlertDays: settings.idleAlertDays,
        fullPct: 95,
      },
      now,
    );

    const statusChanged = derived.effectiveStatus !== machine.effectiveStatus;
    const idleChanged = derived.isIdle !== machine.isIdle;
    if (!statusChanged && !idleChanged) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.machine.update({
        where: { id: machine.id },
        data: { effectiveStatus: derived.effectiveStatus, isIdle: derived.isIdle },
      });

      if (statusChanged) {
        await tx.machineStatusEvent.create({
          data: {
            machineId: machine.id,
            fromStatus: machine.effectiveStatus,
            toStatus: derived.effectiveStatus,
            reason: `recompute:${derived.effectiveStatus}`,
          },
        });

        // Resolve any standing notification for the status we just left.
        const leftType = STATUS_NOTIFICATION[machine.effectiveStatus];
        if (leftType) {
          await tx.notification.updateMany({
            where: { machineId: machine.id, type: leftType, resolvedAt: null },
            data: { resolvedAt: now },
          });
        }

        // Raise one for the status we entered (deduped: only if none open).
        const enteredType = STATUS_NOTIFICATION[derived.effectiveStatus];
        if (enteredType) {
          await this.raiseIfAbsent(tx, machine.id, machine.renterId, enteredType, now);
        }
      }

      // Idle is an overlay, not a status, so its notification is handled on its
      // own axis: raised when the machine goes idle, resolved when it comes back.
      if (idleChanged) {
        if (derived.isIdle) {
          await this.raiseIfAbsent(tx, machine.id, machine.renterId, 'idle_7day', now);
        } else {
          await tx.notification.updateMany({
            where: { machineId: machine.id, type: 'idle_7day', resolvedAt: null },
            data: { resolvedAt: now },
          });
        }
      }
    });

    if (statusChanged) {
      this.log.log(
        `${machine.serialNo}: ${machine.effectiveStatus} -> ${derived.effectiveStatus}`,
      );
    }
  }

  /** Recompute the whole fleet — used by the scheduled sweeps. */
  async recomputeAll(now: Date = new Date()): Promise<number> {
    const machines = await this.prisma.machine.findMany({ select: { id: true } });
    for (const m of machines) await this.recompute(m.id, now);
    return machines.length;
  }

  /**
   * Create a notification only if an unresolved one of this type isn't already
   * open for the machine, so a machine that stays offline for days doesn't
   * generate a new alert on every sweep. Targets admin, plus the renter when
   * the machine is rented.
   */
  private async raiseIfAbsent(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    machineId: string,
    renterId: string | null,
    type: NotificationType,
    now: Date,
  ): Promise<void> {
    const targets: { role: 'admin' | 'renter'; user: string | null }[] = [
      { role: 'admin', user: null },
    ];
    if (renterId) targets.push({ role: 'renter', user: renterId });

    for (const t of targets) {
      const existing = await tx.notification.findFirst({
        where: {
          machineId,
          type,
          resolvedAt: null,
          targetRole: t.role,
          targetUser: t.user,
        },
        select: { id: true },
      });
      if (!existing) {
        await tx.notification.create({
          data: {
            type,
            machineId,
            targetRole: t.role,
            targetUser: t.user,
            createdAt: now,
          },
        });
      }
    }
  }
}

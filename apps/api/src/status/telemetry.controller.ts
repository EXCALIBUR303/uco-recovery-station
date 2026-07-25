import {
  Body,
  Controller,
  Headers,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MachineStatusService } from './machine-status.service';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Constant-time compare so a wrong secret can't be guessed by timing. */
function secretMatches(provided: string, expectedHash: string): boolean {
  const a = Buffer.from(sha256(provided), 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

import type { Prisma } from '@prisma/client';

type TelemetryFrame = {
  drumFillPct?: number;
  rejectFillPct?: number;
  firmwareVersion?: string;
  raw?: Prisma.InputJsonValue;
};

/**
 * Machine-to-platform relay (spec §7). The ESP32 posts a frame here on a
 * regular heartbeat plus after each transaction. We store a snapshot, update
 * the denormalised latest values, bump the heartbeat, then recompute status —
 * which is what flips a machine to drum_full / reject_full / back to in_service
 * without anyone visiting the site.
 *
 * Authentication: a machine with a device secret provisioned must present it in
 * the X-Device-Secret header, so telemetry — which drives machine status — can't
 * be spoofed by anyone who knows a serial number. A machine with no secret yet
 * is accepted, which keeps un-provisioned units and local development working;
 * rotate a secret from the admin dashboard to lock a machine down.
 */
@Controller('telemetry')
export class TelemetryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly status: MachineStatusService,
  ) {}

  @Post(':serialNo')
  async ingest(
    @Param('serialNo') serialNo: string,
    @Body() frame: TelemetryFrame,
    @Headers('x-device-secret') deviceSecret?: string,
  ) {
    const machine = await this.prisma.machine.findUnique({
      where: { serialNo },
      select: { id: true, deviceSecretHash: true },
    });
    if (!machine) throw new NotFoundException(`No machine ${serialNo}`);

    if (machine.deviceSecretHash) {
      if (!deviceSecret || !secretMatches(deviceSecret, machine.deviceSecretHash)) {
        throw new UnauthorizedException('Invalid device credential');
      }
    }

    const now = new Date();
    const drum = clampPct(frame.drumFillPct);
    const reject = clampPct(frame.rejectFillPct);

    await this.prisma.$transaction([
      this.prisma.telemetrySnapshot.create({
        data: {
          machineId: machine.id,
          ts: now,
          drumFillPct: drum,
          rejectFillPct: reject,
          online: true,
          raw: frame.raw ?? undefined,
        },
      }),
      this.prisma.machine.update({
        where: { id: machine.id },
        data: {
          lastTelemetryAt: now,
          ...(drum != null ? { drumFillPct: drum } : {}),
          ...(reject != null ? { rejectFillPct: reject } : {}),
          ...(frame.firmwareVersion ? { firmwareVersion: frame.firmwareVersion } : {}),
        },
      }),
    ]);

    await this.status.recompute(machine.id, now);
    return { ok: true };
  }
}

function clampPct(v: unknown): number | null {
  if (v == null || Number.isNaN(Number(v))) return null;
  return Math.max(0, Math.min(100, Math.round(Number(v))));
}

import { Body, Controller, NotFoundException, Param, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MachineStatusService } from './machine-status.service';

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
 * NOTE: unauthenticated for now. Before deployment each machine needs a device
 * credential (shared secret or mTLS) so telemetry can't be spoofed.
 */
@Controller('telemetry')
export class TelemetryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly status: MachineStatusService,
  ) {}

  @Post(':serialNo')
  async ingest(@Param('serialNo') serialNo: string, @Body() frame: TelemetryFrame) {
    const machine = await this.prisma.machine.findUnique({
      where: { serialNo },
      select: { id: true },
    });
    if (!machine) throw new NotFoundException(`No machine ${serialNo}`);

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

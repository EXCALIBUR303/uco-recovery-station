import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

const BLACKLIST_MODES = ['permanent', 'appealable', 'auto_reset'] as const;

/**
 * The platform policies that were left as open questions are configurable here
 * rather than hard-coded, so the company can set them without a redeploy:
 * blacklist permanence (#1), what counts as activity for the idle check (#2),
 * and the ignore-vs-offence weight threshold (#3).
 */
@UseGuards(JwtGuard, RolesGuard)
@Roles('admin')
@Controller('settings')
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  get() {
    return this.prisma.platformSettings.findUniqueOrThrow({ where: { id: true } });
  }

  @Post()
  async update(
    @Body()
    body: {
      defaultMinWeightDeltaG?: number;
      blacklistThreshold?: number;
      blacklistMode?: string;
      blacklistAutoResetDays?: number | null;
      idleAlertDays?: number;
      activityCountsRejections?: boolean;
      offlineAfterSeconds?: number;
      rentalGraceDays?: number;
    },
  ) {
    if (body.blacklistMode && !BLACKLIST_MODES.includes(body.blacklistMode as never)) {
      throw new BadRequestException(`blacklistMode must be one of: ${BLACKLIST_MODES.join(', ')}`);
    }
    if (body.blacklistThreshold != null && body.blacklistThreshold < 1) {
      throw new BadRequestException('Blacklist threshold must be at least 1');
    }
    if (body.offlineAfterSeconds != null && body.offlineAfterSeconds < 30) {
      throw new BadRequestException('Offline threshold must be at least 30 seconds');
    }
    if (body.idleAlertDays != null && body.idleAlertDays < 1) {
      throw new BadRequestException('Idle alert must be at least 1 day');
    }
    if (body.defaultMinWeightDeltaG != null && body.defaultMinWeightDeltaG < 0) {
      throw new BadRequestException('Weight threshold cannot be negative');
    }

    // Only apply the keys actually supplied, so a partial update never resets
    // an unrelated policy to its default.
    return this.prisma.platformSettings.update({
      where: { id: true },
      data: {
        ...(body.defaultMinWeightDeltaG != null
          ? { defaultMinWeightDeltaG: Math.round(body.defaultMinWeightDeltaG) }
          : {}),
        ...(body.blacklistThreshold != null
          ? { blacklistThreshold: Math.round(body.blacklistThreshold) }
          : {}),
        ...(body.blacklistMode ? { blacklistMode: body.blacklistMode } : {}),
        ...(body.blacklistAutoResetDays !== undefined
          ? { blacklistAutoResetDays: body.blacklistAutoResetDays }
          : {}),
        ...(body.idleAlertDays != null ? { idleAlertDays: Math.round(body.idleAlertDays) } : {}),
        ...(body.activityCountsRejections !== undefined
          ? { activityCountsRejections: body.activityCountsRejections }
          : {}),
        ...(body.offlineAfterSeconds != null
          ? { offlineAfterSeconds: Math.round(body.offlineAfterSeconds) }
          : {}),
        ...(body.rentalGraceDays != null
          ? { rentalGraceDays: Math.round(body.rentalGraceDays) }
          : {}),
      },
    });
  }
}

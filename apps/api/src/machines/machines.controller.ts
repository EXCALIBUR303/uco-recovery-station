import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { MachinesService } from './machines.service';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user';

@UseGuards(JwtGuard)
@Controller('machines')
export class MachinesController {
  constructor(private readonly machines: MachinesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.machines.list(user);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.machines.detail(user, id);
  }

  /** Fleet-wide event feed for the live ticker. */
  @Get('feed/activity')
  activity(@CurrentUser() user: AuthUser, @Query('take') take?: string) {
    return this.machines.activity(user, Number(take) || 20);
  }

  /** Daily activity for the traffic + rejection-rate charts. */
  @Get(':id/series')
  series(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    return this.machines.series(user, id, Number(days) || 30);
  }

  // ---- admin-only management actions (spec §6.2) ----

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post(':id/assign')
  assign(
    @Param('id') id: string,
    @Body() body: { renterId?: string | null; monthlyFeePaise?: number | string },
  ) {
    return this.machines.assign(id, {
      renterId: body?.renterId ?? null,
      monthlyFeePaise:
        body?.monthlyFeePaise != null
          ? BigInt(Math.round(Number(body.monthlyFeePaise)))
          : undefined,
    });
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post(':id/update')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      label?: string | null;
      locationText?: string | null;
      ratePerKgPaise?: number | string;
      minWeightDeltaG?: number | null;
    },
  ) {
    return this.machines.update(id, {
      label: body?.label,
      locationText: body?.locationText,
      ratePerKgPaise:
        body?.ratePerKgPaise != null
          ? BigInt(Math.round(Number(body.ratePerKgPaise)))
          : undefined,
      minWeightDeltaG:
        body?.minWeightDeltaG === null
          ? null
          : body?.minWeightDeltaG != null
            ? Math.round(Number(body.minWeightDeltaG))
            : undefined,
    });
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post(':id/device-secret')
  rotateSecret(@Param('id') id: string) {
    return this.machines.rotateDeviceSecret(id);
  }
}

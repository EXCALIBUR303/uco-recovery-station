import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RentalsService } from './rentals.service';
import { RentalBillingService } from './rental-billing.service';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user';

@UseGuards(JwtGuard)
@Controller('rentals')
export class RentalsController {
  constructor(
    private readonly rentals: RentalsService,
    private readonly billing: RentalBillingService,
  ) {}

  /** Agreements + invoices, scoped: renters see only their own. */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.rentals.list(user);
  }

  /** Record a received payment against an invoice. Admin only. */
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post('invoices/:id/pay')
  pay(@Param('id') id: string) {
    return this.billing.markPaid(id);
  }

  /**
   * Run the billing cycle now (generate due invoices + age unpaid ones).
   * Admin only, chiefly for testing without waiting for the daily cron.
   */
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post('run-billing')
  async run(@Body() body: { now?: string }) {
    const now = body?.now ? new Date(body.now) : new Date();
    const generated = await this.billing.generateDueInvoices(now);
    const aged = await this.billing.ageUnpaidInvoices(now);
    return { generated, aged };
  }
}

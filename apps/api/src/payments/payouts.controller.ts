import { Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PayoutService } from './payout.service';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

/**
 * The manual-payout queue: while there's no RazorpayX account, a payout sits
 * here until an admin pays the depositor by hand (their own UPI app) and
 * confirms it here. See mock-razorpay.client.ts for why this exists.
 */
@UseGuards(JwtGuard, RolesGuard)
@Roles('admin')
@Controller('payouts')
export class PayoutsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payouts: PayoutService,
  ) {}

  @Get('pending')
  async pending() {
    const rows = await this.payouts.listPending();
    return rows.map((p) => ({
      id: p.id,
      upiId: p.upiId,
      amountPaise: p.amountPaise,
      status: p.status,
      createdAt: p.createdAt,
      machineSerial: p.deposit?.machine.serialNo ?? null,
      machineLabel: p.deposit?.machine.label ?? null,
    }));
  }

  @Post(':id/confirm')
  async confirm(@Param('id') id: string) {
    await this.assertExists(id);
    await this.payouts.confirmManual(id);
    return { ok: true };
  }

  @Post(':id/fail')
  async fail(@Param('id') id: string) {
    await this.assertExists(id);
    await this.payouts.failManual(id);
    return { ok: true };
  }

  private async assertExists(id: string): Promise<void> {
    const payout = await this.prisma.payout.findUnique({ where: { id } });
    if (!payout) throw new NotFoundException('Payout not found');
  }
}

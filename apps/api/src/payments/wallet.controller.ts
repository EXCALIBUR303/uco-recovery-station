import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TopupService } from './topup.service';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user';

@UseGuards(JwtGuard)
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly topups: TopupService,
  ) {}

  /** The caller's wallet: renter → their own, admin → the company wallet. */
  @Get()
  async mine(@CurrentUser() user: AuthUser) {
    const wallet = await this.resolveWallet(user);

    const [topups, payouts] = await Promise.all([
      this.prisma.walletTopup.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      this.prisma.payout.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: { deposit: { select: { machine: { select: { serialNo: true } } } } },
      }),
    ]);

    return {
      balancePaise: wallet.balancePaise,
      heldPaise: wallet.heldPaise,
      spendablePaise: wallet.balancePaise - wallet.heldPaise,
      ownerType: wallet.ownerType,
      topups: topups.map((t) => ({
        id: t.id,
        amountPaise: t.amountPaise,
        status: t.status,
        createdAt: t.createdAt,
      })),
      payouts: payouts.map((p) => ({
        id: p.id,
        amountPaise: p.amountPaise,
        status: p.status,
        machineSerial: p.deposit?.machine.serialNo ?? null,
        createdAt: p.createdAt,
      })),
    };
  }

  /** Add funds. Renters only — the company wallet isn't topped up this way. */
  @UseGuards(RolesGuard)
  @Roles('renter')
  @Post('topup')
  async topup(@CurrentUser() user: AuthUser, @Body() body: { amountPaise?: number | string }) {
    const wallet = await this.resolveWallet(user);
    const amount = BigInt(Math.round(Number(body?.amountPaise)));
    if (!Number.isFinite(Number(body?.amountPaise)) || amount <= 0n) {
      throw new BadRequestException('A positive amount is required');
    }
    return this.topups.initiate(wallet.id, amount);
  }

  private async resolveWallet(user: AuthUser) {
    const where =
      user.role === 'admin'
        ? { ownerType: 'company' as const, ownerId: null }
        : { ownerType: 'renter' as const, ownerId: user.sub };
    const wallet = await this.prisma.wallet.findFirst({ where });
    if (!wallet) throw new NotFoundException('No wallet for this account');
    return wallet;
  }
}

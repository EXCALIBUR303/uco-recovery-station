import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

/**
 * Admin-side management of the rental programme (spec §6.2): approving new
 * renters, seeing their wallet balances, and setting the optional depositor-
 * facing branding (open question #4).
 */
@Injectable()
export class RentersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every renter with approval state, wallet balance, and machine count. */
  async list() {
    const renters = await this.prisma.dashboardUser.findMany({
      where: { role: 'renter' },
      orderBy: [{ approvedAt: 'asc' }, { createdAt: 'desc' }],
      include: {
        machines: { select: { id: true, serialNo: true } },
        rentalAgreements: {
          where: { status: { not: 'terminated' } },
          select: { monthlyFeePaise: true },
        },
      },
    });

    // One query for all renter wallets rather than N+1.
    const wallets = await this.prisma.wallet.findMany({
      where: { ownerType: 'renter', ownerId: { in: renters.map((r) => r.id) } },
      select: { ownerId: true, balancePaise: true, heldPaise: true },
    });
    const walletBy = new Map(wallets.map((w) => [w.ownerId, w]));

    return renters.map((r) => {
      const w = walletBy.get(r.id);
      return {
        id: r.id,
        displayName: r.displayName,
        email: r.email,
        phone: r.phone,
        isActive: r.isActive,
        approvedAt: r.approvedAt,
        pending: r.approvedAt == null,
        brandName: r.brandName,
        brandAccent: r.brandAccent,
        createdAt: r.createdAt,
        balancePaise: w?.balancePaise ?? 0n,
        heldPaise: w?.heldPaise ?? 0n,
        machines: r.machines,
        monthlyRentPaise: r.rentalAgreements.reduce((s, a) => s + a.monthlyFeePaise, 0n),
      };
    });
  }

  /** Approve a pending renter so they can be assigned a machine. */
  async approve(renterId: string, adminId: string) {
    const renter = await this.requireRenter(renterId);
    if (renter.approvedAt) return { alreadyApproved: true };

    await this.prisma.dashboardUser.update({
      where: { id: renterId },
      data: { approvedAt: new Date(), approvedBy: adminId },
    });
    return { approved: true };
  }

  /**
   * Suspend or restore dashboard access. Suspending does not stop their
   * machines — those follow the wallet — it only blocks sign-in.
   */
  async setActive(renterId: string, isActive: boolean) {
    await this.requireRenter(renterId);
    await this.prisma.dashboardUser.update({
      where: { id: renterId },
      data: { isActive },
    });
    return { isActive };
  }

  /**
   * Optional depositor-facing branding (open question #4). Clearing both fields
   * returns that renter's machines to the identical default experience.
   */
  async setBranding(renterId: string, brandName?: string | null, brandAccent?: string | null) {
    await this.requireRenter(renterId);
    const accent = brandAccent?.trim() || null;
    if (accent && !HEX_COLOUR.test(accent)) {
      throw new BadRequestException('Accent must be a hex colour like #7ac943');
    }
    await this.prisma.dashboardUser.update({
      where: { id: renterId },
      data: { brandName: brandName?.trim() || null, brandAccent: accent },
    });
    return { brandName: brandName?.trim() || null, brandAccent: accent };
  }

  private async requireRenter(id: string) {
    const user = await this.prisma.dashboardUser.findUnique({ where: { id } });
    if (!user || user.role !== 'renter') throw new NotFoundException('Unknown renter');
    return user;
  }
}

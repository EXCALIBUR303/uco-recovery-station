import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { DashboardUser } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './auth-user';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD = 8;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.dashboardUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    // Same error whether the email is unknown or the password is wrong, so an
    // attacker can't probe which accounts exist.
    if (!user || !user.isActive || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.session(user);
  }

  /**
   * Renter self-sign-up (spec §9.1) — the public front door of the dashboard.
   * Only ever creates a RENTER; admin accounts are provisioned separately, so a
   * public form can't mint one. A payout wallet is created alongside so the new
   * renter can add funds right away. The account starts with no machines until
   * the company assigns one.
   */
  async register(input: {
    email: string;
    password: string;
    displayName: string;
    phone?: string;
  }) {
    const email = input.email?.toLowerCase().trim() ?? '';
    const displayName = input.displayName?.trim() ?? '';

    if (!EMAIL_RE.test(email)) {
      throw new BadRequestException('Enter a valid email address');
    }
    if (!input.password || input.password.length < MIN_PASSWORD) {
      throw new BadRequestException(`Password must be at least ${MIN_PASSWORD} characters`);
    }
    if (!displayName) {
      throw new BadRequestException('Enter your name or business name');
    }

    const existing = await this.prisma.dashboardUser.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await hash(input.password, 10);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dashboardUser.create({
        data: {
          role: 'renter',
          email,
          passwordHash,
          displayName,
          phone: input.phone?.trim() || null,
        },
      });
      // every renter gets a payout wallet at zero balance
      await tx.wallet.create({
        data: { ownerType: 'renter', ownerId: created.id, balancePaise: 0n },
      });
      return created;
    });

    return this.session(user);
  }

  private async session(user: DashboardUser) {
    const payload: AuthUser = { sub: user.id, role: user.role, email: user.email };
    return {
      token: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
        displayName: user.displayName,
      },
    };
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './auth-user';

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

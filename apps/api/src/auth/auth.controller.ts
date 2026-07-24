import { Body, Controller, Get, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtGuard } from './jwt.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthUser } from './auth-user';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() body: { email?: string; password?: string }) {
    if (!body?.email || !body?.password) {
      throw new UnauthorizedException('Email and password are required');
    }
    return this.auth.login(body.email, body.password);
  }

  /** Renter self-sign-up (spec §9.1). Creates a renter account and logs in. */
  @Post('register')
  register(
    @Body()
    body: { email?: string; password?: string; displayName?: string; phone?: string },
  ) {
    return this.auth.register({
      email: body?.email ?? '',
      password: body?.password ?? '',
      displayName: body?.displayName ?? '',
      phone: body?.phone,
    });
  }

  /** Lets the dashboard confirm a stored token is still valid on load. */
  @UseGuards(JwtGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { id: user.sub, role: user.role, email: user.email };
  }
}

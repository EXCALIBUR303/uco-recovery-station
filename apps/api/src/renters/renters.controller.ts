import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RentersService } from './renters.service';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user';

// Managing the rental programme is admin-only (spec §6.2).
@UseGuards(JwtGuard, RolesGuard)
@Roles('admin')
@Controller('renters')
export class RentersController {
  constructor(private readonly renters: RentersService) {}

  @Get()
  list() {
    return this.renters.list();
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.renters.approve(id, user.sub);
  }

  @Post(':id/active')
  setActive(@Param('id') id: string, @Body() body: { isActive?: boolean }) {
    return this.renters.setActive(id, body?.isActive !== false);
  }

  @Post(':id/branding')
  setBranding(
    @Param('id') id: string,
    @Body() body: { brandName?: string | null; brandAccent?: string | null },
  ) {
    return this.renters.setBranding(id, body?.brandName, body?.brandAccent);
  }
}

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { MachinesService } from './machines.service';
import { JwtGuard } from '../auth/jwt.guard';
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
}

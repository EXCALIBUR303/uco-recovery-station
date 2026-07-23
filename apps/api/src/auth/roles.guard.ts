import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { DashboardRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Restrict a route to specific dashboard roles, e.g. @Roles('admin'). */
export const Roles = (...roles: DashboardRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<DashboardRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.user || !required.includes(req.user.role)) {
      throw new ForbiddenException('Not permitted for this role');
    }
    return true;
  }
}

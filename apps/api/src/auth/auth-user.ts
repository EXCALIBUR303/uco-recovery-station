import type { DashboardRole } from '@prisma/client';

/** The shape carried in the JWT and attached to each authenticated request. */
export type AuthUser = {
  sub: string; // dashboard_user id
  role: DashboardRole;
  email: string;
};

/**
 * How a query should be scoped for this user. Admins see the whole fleet;
 * renters see only machines they rent. Enforced on the backend (spec §9.2) so
 * a renter cannot reach another renter's data even by editing a URL.
 */
export function machineScopeFor(user: AuthUser): { renterId?: string } {
  return user.role === 'admin' ? {} : { renterId: user.sub };
}

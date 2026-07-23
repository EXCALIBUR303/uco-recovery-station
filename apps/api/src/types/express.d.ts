import type { AuthUser } from '../auth/auth-user';

// Attach the authenticated dashboard user to the Express request.
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};

import { Router } from 'express';
import { HttpError } from '../middleware/errorHandler';
import { createAdminLoginRateLimit } from '../middleware/rateLimit';
import type { AdminAuthService } from '../services/adminAuthService';
import { ADMIN_AUTH_COOKIE, clearAuthCookie, setAuthCookie } from '../utils/authCookies';

export function createAdminAuthRoutes(authService: AdminAuthService): Router {
  const router = Router();

  router.post('/login', createAdminLoginRateLimit(), (req, res, next) => {
    try {
      const password = String(req.body?.password || '');
      if (!password) {
        throw new HttpError(400, 'BAD_REQUEST', 'password is required');
      }

      const auth = authService.login(password);
      if (!auth) {
        throw new HttpError(401, 'UNAUTHORIZED', 'invalid password');
      }

      setAuthCookie(res, req, ADMIN_AUTH_COOKIE, auth.token, auth.expires_at);
      res.json(auth);
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', (req, res) => {
    clearAuthCookie(res, req, ADMIN_AUTH_COOKIE);
    res.json({ ok: true });
  });

  return router;
}

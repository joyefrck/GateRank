import { Router } from 'express';
import { HttpError } from '../middleware/errorHandler';
import type { AdminAuthService } from '../services/adminAuthService';

export function createAdminAuthRoutes(authService: AdminAuthService): Router {
  const router = Router();

  router.post('/login', (req, res, next) => {
    try {
      const password = String(req.body?.password || '');
      if (!password) {
        throw new HttpError(400, 'BAD_REQUEST', 'password is required');
      }

      const auth = authService.login(password);
      if (!auth) {
        throw new HttpError(401, 'UNAUTHORIZED', 'invalid password');
      }

      res.json(auth);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

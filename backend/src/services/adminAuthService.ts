import type { AdminAuthResponse } from '../types/domain';
import { getAdminAuthConfig } from '../utils/adminAuthConfig';
import { signAdminToken } from '../utils/token';

export class AdminAuthService {
  login(password: string): AdminAuthResponse | null {
    const config = getAdminAuthConfig();

    if (!config.uiPassword || !config.jwtSecret || password !== config.uiPassword) {
      return null;
    }

    const { token, expiresAt } = signAdminToken(config.jwtSecret, config.tokenTtlHours);
    return {
      token,
      expires_at: expiresAt.toISOString(),
    };
  }
}

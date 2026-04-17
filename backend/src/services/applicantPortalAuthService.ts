import { HttpError } from '../middleware/errorHandler';
import type { ApplicantAccount } from '../repositories/applicantAccountRepository';
import { getPortalAuthConfig } from '../utils/portalAuthConfig';
import { verifyPassword } from '../utils/password';
import { signApplicantToken } from '../utils/token';
import { formatSqlDateTimeInTimezone } from '../utils/time';

interface ApplicantPortalAuthServiceOptions {
  applicantAccountRepository: {
    getByEmail(email: string): Promise<ApplicantAccount | null>;
    getById(id: number): Promise<ApplicantAccount | null>;
    touchLogin(id: number, loggedInAt: string): Promise<boolean>;
    updatePassword(id: number, passwordHash: string, mustChangePassword: boolean): Promise<boolean>;
  };
}

export class ApplicantPortalAuthService {
  private readonly applicantAccountRepository: ApplicantPortalAuthServiceOptions['applicantAccountRepository'];

  constructor(options: ApplicantPortalAuthServiceOptions) {
    this.applicantAccountRepository = options.applicantAccountRepository;
  }

  async login(email: string, password: string): Promise<{
    token: string;
    expires_at: string;
    account: ApplicantAccount;
  }> {
    const account = await this.applicantAccountRepository.getByEmail(email);
    if (!account) {
      throw new HttpError(401, 'UNAUTHORIZED', '邮箱或密码错误');
    }

    const isValidPassword = await verifyPassword(password, account.password_hash);
    if (!isValidPassword) {
      throw new HttpError(401, 'UNAUTHORIZED', '邮箱或密码错误');
    }

    const config = getPortalAuthConfig();
    const { token, expiresAt } = signApplicantToken(
      config.jwtSecret,
      account.id,
      account.email,
      config.tokenTtlHours,
    );

    await this.applicantAccountRepository.touchLogin(
      account.id,
      formatSqlDateTimeInTimezone(new Date(), 'Asia/Shanghai'),
    );

    return {
      token,
      expires_at: expiresAt.toISOString(),
      account,
    };
  }
}

import express from 'express';
import helmet from 'helmet';
import { getDbPool } from './db/mysql';
import { adminAuth } from './middleware/adminAuth';
import { corsAllowlist } from './middleware/cors';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestContext } from './middleware/requestContext';
import { AccessTokenRepository } from './repositories/accessTokenRepository';
import { ApplicantAccountRepository } from './repositories/applicantAccountRepository';
import { ApplicantEmailChangeCodeRepository } from './repositories/applicantEmailChangeCodeRepository';
import { ApplicantTelegramBindingRepository } from './repositories/applicantTelegramBindingRepository';
import { ApplicantTelegramLoginFlowRepository } from './repositories/applicantTelegramLoginFlowRepository';
import { ApplicantXOAuthFlowRepository } from './repositories/applicantXOAuthFlowRepository';
import { AirportRepository } from './repositories/airportRepository';
import { AirportAdCampaignRepository } from './repositories/airportAdCampaignRepository';
import { AirportApplicationRepository } from './repositories/airportApplicationRepository';
import { ApplicationPaymentOrderRepository } from './repositories/applicationPaymentOrderRepository';
import { ApplicantBillingRepository } from './repositories/applicantBillingRepository';
import { AuditRepository } from './repositories/auditRepository';
import { NewsRepository } from './repositories/newsRepository';
import { MetricsRepository } from './repositories/metricsRepository';
import { PerformanceNodePreferenceRepository } from './repositories/performanceNodePreferenceRepository';
import { PerformanceRunRepository } from './repositories/performanceRunRepository';
import { ProbeSampleRepository } from './repositories/probeSampleRepository';
import { RankingRepository } from './repositories/rankingRepository';
import { ScoreRepository } from './repositories/scoreRepository';
import { SchedulerRunRepository } from './repositories/schedulerRunRepository';
import { SchedulerTaskRepository } from './repositories/schedulerTaskRepository';
import { StatsRepository } from './repositories/statsRepository';
import { SubscriptionNodeSnapshotRepository } from './repositories/subscriptionNodeSnapshotRepository';
import { ManualJobRepository } from './repositories/manualJobRepository';
import { MarketingEventRepository } from './repositories/marketingEventRepository';
import { SystemSettingRepository } from './repositories/systemSettingRepository';
import { createAdminAuthRoutes } from './routes/adminAuthRoutes';
import { createAdminRoutes } from './routes/adminRoutes';
import { createNewsAdminRoutes } from './routes/newsAdminRoutes';
import { createPortalRoutes } from './routes/portalRoutes';
import { createOutboundRoutes } from './routes/outboundRoutes';
import { createPublishRoutes } from './routes/publishRoutes';
import { createPublicPageRoutes } from './routes/publicPageRoutes';
import { createNewsPublicRoutes } from './routes/newsPublicRoutes';
import { createMachineReadableRoutes } from './routes/machineReadableRoutes';
import { createPublicRoutes } from './routes/publicRoutes';
import { createUserTelegramBotRoutes } from './routes/userTelegramBotRoutes';
import { AccessTokenService } from './services/accessTokenService';
import { AdminAuthService } from './services/adminAuthService';
import { ApplicantPortalAuthService } from './services/applicantPortalAuthService';
import { ApplicantXOAuthService } from './services/applicantXOAuthService';
import { AggregationService } from './services/aggregationService';
import { ManualJobService } from './services/manualJobService';
import { MailService } from './services/mailService';
import { MediaLibrarySettingsService } from './services/mediaLibrarySettingsService';
import { MarketingSettingsService } from './services/marketingSettingsService';
import { NewsContentService } from './services/newsContentService';
import { NewsCoverImageService } from './services/newsCoverImageService';
import { NewsMutationService } from './services/newsMutationService';
import { PaymentGatewaySettingsService } from './services/paymentGatewaySettingsService';
import { PaymentGatewayService } from './services/paymentGatewayService';
import { PexelsCoverService } from './services/pexelsCoverService';
import { NewsPublicService } from './services/newsPublicService';
import { PublicViewService } from './services/publicViewService';
import { RecomputeService } from './services/recomputeService';
import { RiskCheckService } from './services/riskCheckService';
import { SmtpSettingsService } from './services/smtpSettingsService';
import { AdminSchedulerService } from './services/adminSchedulerService';
import { SchedulerTaskExecutor } from './services/schedulerTaskExecutor';
import { TelegramNotificationService } from './services/telegramNotificationService';
import { UserTelegramBotMessageService } from './services/userTelegramBotMessageService';
import { UserTelegramBotSettingsService } from './services/userTelegramBotSettingsService';
import { XOAuthSettingsService } from './services/xOAuthSettingsService';
import { getNewsUploadRootDir } from './utils/newsStorage';
import { createTimedPromiseCache, PUBLIC_PAGE_CACHE_TTL_MS } from './utils/publicCache';

export async function createApp() {
  const pool = getDbPool();
  const airportRepository = new AirportRepository(pool);
  await airportRepository.ensureSchema();
  const airportAdCampaignRepository = new AirportAdCampaignRepository(pool);
  await airportAdCampaignRepository.ensureSchema();
  const airportApplicationRepository = new AirportApplicationRepository(pool);
  await airportApplicationRepository.ensureSchema();
  const applicantAccountRepository = new ApplicantAccountRepository(pool);
  await applicantAccountRepository.ensureSchema();
  const applicantEmailChangeCodeRepository = new ApplicantEmailChangeCodeRepository(pool);
  await applicantEmailChangeCodeRepository.ensureSchema();
  const applicantXOAuthFlowRepository = new ApplicantXOAuthFlowRepository(pool);
  await applicantXOAuthFlowRepository.ensureSchema();
  const applicantTelegramBindingRepository = new ApplicantTelegramBindingRepository(pool);
  await applicantTelegramBindingRepository.ensureSchema();
  const applicantTelegramLoginFlowRepository = new ApplicantTelegramLoginFlowRepository(pool);
  await applicantTelegramLoginFlowRepository.ensureSchema();
  const applicationPaymentOrderRepository = new ApplicationPaymentOrderRepository(pool);
  await applicationPaymentOrderRepository.ensureSchema();
  const applicantBillingRepository = new ApplicantBillingRepository(pool);
  await applicantBillingRepository.ensureSchema();
  await applicantBillingRepository.backfillLegacyAirportWallets();
  const metricsRepository = new MetricsRepository(pool);
  await metricsRepository.ensureSchema();
  const probeSampleRepository = new ProbeSampleRepository(pool);
  await probeSampleRepository.ensureSchema();
  const performanceRunRepository = new PerformanceRunRepository(pool);
  await performanceRunRepository.ensureSchema();
  const subscriptionNodeSnapshotRepository = new SubscriptionNodeSnapshotRepository(pool);
  await subscriptionNodeSnapshotRepository.ensureSchema();
  const performanceNodePreferenceRepository = new PerformanceNodePreferenceRepository(pool);
  await performanceNodePreferenceRepository.ensureSchema();
  const manualJobRepository = new ManualJobRepository(pool);
  await manualJobRepository.ensureSchema();
  const schedulerTaskRepository = new SchedulerTaskRepository(pool);
  await schedulerTaskRepository.ensureSchema();
  const schedulerRunRepository = new SchedulerRunRepository(pool);
  await schedulerRunRepository.ensureSchema();
  const systemSettingRepository = new SystemSettingRepository(pool);
  await systemSettingRepository.ensureSchema();
  const accessTokenRepository = new AccessTokenRepository(pool);
  await accessTokenRepository.ensureSchema();
  const marketingEventRepository = new MarketingEventRepository(pool);
  await marketingEventRepository.ensureSchema();
  const newsRepository = new NewsRepository(pool);
  await newsRepository.ensureSchema();
  const scoreRepository = new ScoreRepository(pool);
  const rankingRepository = new RankingRepository(pool);
  const statsRepository = new StatsRepository(pool);
  const auditRepository = new AuditRepository(pool);
  await auditRepository.ensureSchema();
  const authService = new AdminAuthService();
  const recomputeService = new RecomputeService({
    airportRepository,
    metricsRepository,
    scoreRepository,
    rankingRepository,
  });
  const aggregationService = new AggregationService({
    airportRepository,
    probeSampleRepository,
    metricsRepository,
    performanceRunRepository,
  });
  const riskCheckService = new RiskCheckService({
    airportRepository,
    metricsRepository,
  });
  const marketingSettingsService = new MarketingSettingsService({
    systemSettingRepository,
  });
  const smtpSettingsService = new SmtpSettingsService({
    systemSettingRepository,
  });
  const mailService = new MailService({
    smtpSettingsService,
  });
  const userTelegramBotSettingsService = new UserTelegramBotSettingsService({
    systemSettingRepository,
  });
  const userTelegramBotMessageService = new UserTelegramBotMessageService({
    userTelegramBotSettingsService,
    applicantTelegramBindingRepository,
  });
  const schedulerTaskExecutor = new SchedulerTaskExecutor({
    airportRepository,
    aggregationService,
    applicantBillingRepository,
    mailService,
    userTelegramBotMessageService,
    marketingSettingsService,
    recomputeService,
    riskCheckService,
  });
  const adminSchedulerService = new AdminSchedulerService({
    schedulerTaskRepository,
    schedulerRunRepository,
    schedulerTaskExecutor,
  });
  const manualJobService = new ManualJobService({
    manualJobRepository,
    aggregationService,
    recomputeService,
    riskCheckService,
    auditRepository,
  });
  await manualJobService.initialize();
    const publicViewService = new PublicViewService({
      airportRepository,
      metricsRepository,
      scoreRepository,
      applicantBillingRepository,
      marketingSettingsService,
      rankingRepository,
      statsRepository,
      subscriptionNodeSnapshotRepository,
    });
  const newsContentService = new NewsContentService();
  const newsCoverImageService = new NewsCoverImageService();
  const newsMutationService = new NewsMutationService({
    newsRepository,
    newsContentService,
    newsCoverImageService,
  });
  const mediaLibrarySettingsService = new MediaLibrarySettingsService({
    systemSettingRepository,
  });
  const paymentGatewaySettingsService = new PaymentGatewaySettingsService({
    systemSettingRepository,
  });
  const xOAuthSettingsService = new XOAuthSettingsService({
    systemSettingRepository,
  });
  const accessTokenService = new AccessTokenService({
    accessTokenRepository,
  });
  const paymentGatewayService = new PaymentGatewayService({
    paymentGatewaySettingsService,
  });
  const applicantPortalAuthService = new ApplicantPortalAuthService({
    applicantAccountRepository,
  });
  const applicantXOAuthService = new ApplicantXOAuthService({
    applicantAccountRepository,
    applicantXOAuthFlowRepository,
    configFactory: () => xOAuthSettingsService.getConfig(),
  });
  const pexelsCoverService = new PexelsCoverService(mediaLibrarySettingsService, newsCoverImageService);
  const newsPublicService = new NewsPublicService(newsRepository, newsContentService);
  const applicationNotificationService = new TelegramNotificationService({
    systemSettingRepository,
  });
  const publicApiPageCache = createTimedPromiseCache(PUBLIC_PAGE_CACHE_TTL_MS);
  const publicHtmlPageCache = createTimedPromiseCache(PUBLIC_PAGE_CACHE_TTL_MS);
  const publicPageCache = {
    clear(): void {
      publicApiPageCache.clear();
      publicHtmlPageCache.clear();
    },
  };

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.urlencoded({ extended: false, limit: process.env.URLENCODED_BODY_LIMIT || '100kb' }));
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
  app.use(requestContext);
  app.use('/uploads', express.static(getNewsUploadRootDir()));
  app.use(corsAllowlist);

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(
    '/api/v1',
    createPublicRoutes({
      airportRepository,
      airportApplicationRepository,
      applicantAccountRepository,
      applicantBillingRepository,
      airportAdCampaignRepository,
      applicationNotificationService,
      mailService,
      metricsRepository,
      scoreRepository,
      rankingRepository,
      publicViewService,
      pageCache: publicApiPageCache,
      marketingRepository: marketingEventRepository,
      marketingSettingsService,
    }),
  );

  app.use(
    '/api/v1',
    createPortalRoutes({
      applicantAccountRepository,
      applicantEmailChangeCodeRepository,
      airportApplicationRepository,
      airportRepository,
      applicationPaymentOrderRepository,
      applicantBillingRepository,
      airportAdCampaignRepository,
      applicantPortalAuthService,
      applicantXOAuthService,
      applicantTelegramBindingRepository,
      applicantTelegramLoginFlowRepository,
      userTelegramBotSettingsService,
      paymentGatewaySettingsService,
      marketingSettingsService,
      paymentGatewayService,
      applicationNotificationService,
      mailService,
      userTelegramBotMessageService,
      publicPageCache,
    }),
  );

  app.use(
    '/api/v1',
    createUserTelegramBotRoutes({
      userTelegramBotSettingsService,
      applicantTelegramBindingRepository,
      applicantTelegramLoginFlowRepository,
      applicantAccountRepository,
      airportApplicationRepository,
      applicantBillingRepository,
      paymentGatewaySettingsService,
      paymentGatewayService,
      marketingSettingsService,
    }),
  );

  app.use(
    '/api/v1',
    createOutboundRoutes({
      airportRepository,
      applicantBillingRepository,
      marketingSettingsService,
      mailService,
      userTelegramBotMessageService,
    }),
  );
  app.use(
    createNewsPublicRoutes({
      newsPublicService,
      publicViewService,
      marketingRepository: marketingEventRepository,
    }),
  );

  app.use('/api/v1/admin', createAdminAuthRoutes(authService));

  app.use(
    '/api/v1/admin',
    adminAuth,
    createAdminRoutes({
      airportRepository,
      airportApplicationRepository,
      applicationPaymentOrderRepository,
      applicantBillingRepository,
      applicantAccountRepository,
      probeSampleRepository,
      performanceRunRepository,
      subscriptionNodeSnapshotRepository,
      performanceNodePreferenceRepository,
      metricsRepository,
      scoreRepository,
      recomputeService,
      aggregationService,
      manualJobService,
      schedulerService: adminSchedulerService,
      marketingRepository: marketingEventRepository,
      auditRepository,
      publicViewService,
      publicPageCache,
      telegramNotificationService: applicationNotificationService,
      userTelegramBotSettingsService,
      mediaLibrarySettingsService,
      paymentGatewaySettingsService,
      marketingSettingsService,
      smtpSettingsService,
      xOAuthSettingsService,
      mailService,
      accessTokenService,
    }),
  );

  app.use(
    '/api/v1/admin',
    adminAuth,
    createNewsAdminRoutes({
      auditRepository,
      newsRepository,
      newsPublicService,
      pexelsCoverService,
      newsMutationService,
    }),
  );

  app.use(
    '/api/v1',
    createPublishRoutes({
      accessTokenService,
      auditRepository,
      newsMutationService,
    }),
  );

  app.use(
    createMachineReadableRoutes({
      publicViewService,
    }),
  );

  app.use(
    createPublicPageRoutes({
      publicViewService,
      airportAdCampaignRepository,
      pageCache: publicHtmlPageCache,
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return {
    app,
    airportRepository,
    recomputeService,
    aggregationService,
    riskCheckService,
    adminSchedulerService,
  };
}

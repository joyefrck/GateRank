import express from 'express';
import { getDbPool } from './db/mysql';
import { adminAuth } from './middleware/adminAuth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestContext } from './middleware/requestContext';
import { AccessTokenRepository } from './repositories/accessTokenRepository';
import { ApplicantAccountRepository } from './repositories/applicantAccountRepository';
import { AirportRepository } from './repositories/airportRepository';
import { AirportApplicationRepository } from './repositories/airportApplicationRepository';
import { ApplicationPaymentOrderRepository } from './repositories/applicationPaymentOrderRepository';
import { AuditRepository } from './repositories/auditRepository';
import { NewsRepository } from './repositories/newsRepository';
import { MetricsRepository } from './repositories/metricsRepository';
import { PerformanceRunRepository } from './repositories/performanceRunRepository';
import { ProbeSampleRepository } from './repositories/probeSampleRepository';
import { RankingRepository } from './repositories/rankingRepository';
import { ScoreRepository } from './repositories/scoreRepository';
import { SchedulerRunRepository } from './repositories/schedulerRunRepository';
import { SchedulerTaskRepository } from './repositories/schedulerTaskRepository';
import { StatsRepository } from './repositories/statsRepository';
import { ManualJobRepository } from './repositories/manualJobRepository';
import { MarketingEventRepository } from './repositories/marketingEventRepository';
import { SystemSettingRepository } from './repositories/systemSettingRepository';
import { createAdminAuthRoutes } from './routes/adminAuthRoutes';
import { createAdminRoutes } from './routes/adminRoutes';
import { createNewsAdminRoutes } from './routes/newsAdminRoutes';
import { createPortalRoutes } from './routes/portalRoutes';
import { createPublishRoutes } from './routes/publishRoutes';
import { createNewsPublicRoutes } from './routes/newsPublicRoutes';
import { createPublicRoutes } from './routes/publicRoutes';
import { AccessTokenService } from './services/accessTokenService';
import { AdminAuthService } from './services/adminAuthService';
import { ApplicantPortalAuthService } from './services/applicantPortalAuthService';
import { AggregationService } from './services/aggregationService';
import { ManualJobService } from './services/manualJobService';
import { MailService } from './services/mailService';
import { MediaLibrarySettingsService } from './services/mediaLibrarySettingsService';
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
import { getNewsUploadRootDir } from './utils/newsStorage';

export async function createApp() {
  const pool = getDbPool();
  const airportRepository = new AirportRepository(pool);
  await airportRepository.ensureSchema();
  const airportApplicationRepository = new AirportApplicationRepository(pool);
  await airportApplicationRepository.ensureSchema();
  const applicantAccountRepository = new ApplicantAccountRepository(pool);
  await applicantAccountRepository.ensureSchema();
  const applicationPaymentOrderRepository = new ApplicationPaymentOrderRepository(pool);
  await applicationPaymentOrderRepository.ensureSchema();
  const metricsRepository = new MetricsRepository(pool);
  await metricsRepository.ensureSchema();
  const probeSampleRepository = new ProbeSampleRepository(pool);
  await probeSampleRepository.ensureSchema();
  const performanceRunRepository = new PerformanceRunRepository(pool);
  await performanceRunRepository.ensureSchema();
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
  });
  const riskCheckService = new RiskCheckService({
    airportRepository,
    metricsRepository,
  });
  const schedulerTaskExecutor = new SchedulerTaskExecutor({
    airportRepository,
    aggregationService,
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
    rankingRepository,
    statsRepository,
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
  const smtpSettingsService = new SmtpSettingsService({
    systemSettingRepository,
  });
  const accessTokenService = new AccessTokenService({
    accessTokenRepository,
  });
  const mailService = new MailService({
    smtpSettingsService,
  });
  const paymentGatewayService = new PaymentGatewayService({
    paymentGatewaySettingsService,
  });
  const applicantPortalAuthService = new ApplicantPortalAuthService({
    applicantAccountRepository,
  });
  const pexelsCoverService = new PexelsCoverService(mediaLibrarySettingsService, newsCoverImageService);
  const newsPublicService = new NewsPublicService(newsRepository, newsContentService);
  const applicationNotificationService = new TelegramNotificationService({
    systemSettingRepository,
  });

  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(requestContext);
  app.use('/uploads', express.static(getNewsUploadRootDir()));
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-request-id, x-admin-actor');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(
    '/api/v1',
    createPublicRoutes({
      airportRepository,
      airportApplicationRepository,
      applicantAccountRepository,
      applicationNotificationService,
      mailService,
      metricsRepository,
      scoreRepository,
      rankingRepository,
      publicViewService,
      marketingRepository: marketingEventRepository,
    }),
  );

  app.use(
    '/api/v1',
    createPortalRoutes({
      applicantAccountRepository,
      airportApplicationRepository,
      applicationPaymentOrderRepository,
      applicantPortalAuthService,
      paymentGatewaySettingsService,
      paymentGatewayService,
    }),
  );
  app.use(
    createNewsPublicRoutes({
      newsPublicService,
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
      probeSampleRepository,
      performanceRunRepository,
      metricsRepository,
      scoreRepository,
      recomputeService,
      aggregationService,
      manualJobService,
      schedulerService: adminSchedulerService,
      marketingRepository: marketingEventRepository,
      auditRepository,
      publicViewService,
      telegramNotificationService: applicationNotificationService,
      mediaLibrarySettingsService,
      paymentGatewaySettingsService,
      smtpSettingsService,
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

import { RevenueRepository } from './repositories/revenueRepository';
import { RevenueService } from './services/revenueService';
import { createRevenueRoutes } from './routes/revenueRoutes';
import express from 'express';
import helmet from 'helmet';
import { getDbPool } from './db/mysql';
import { adminAuth } from './middleware/adminAuth';
import { performanceProbeAuth } from './middleware/performanceProbeAuth';
import { corsAllowlist } from './middleware/cors';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { privateSeoGuard } from './middleware/privateSeoGuard';
import { requestContext } from './middleware/requestContext';
import { createPerformanceProbeRateLimit } from './middleware/rateLimit';
import { AccessTokenRepository } from './repositories/accessTokenRepository';
import { ApplicantAccountRepository } from './repositories/applicantAccountRepository';
import { ApplicantEmailChangeCodeRepository } from './repositories/applicantEmailChangeCodeRepository';
import { ApplicantTelegramBindingRepository } from './repositories/applicantTelegramBindingRepository';
import { ApplicantTelegramLoginFlowRepository } from './repositories/applicantTelegramLoginFlowRepository';
import { ApplicantXOAuthFlowRepository } from './repositories/applicantXOAuthFlowRepository';
import { AirportRepository } from './repositories/airportRepository';
import { AirportAdCampaignRepository } from './repositories/airportAdCampaignRepository';
import { AdExpiryReminderRepository } from './repositories/adExpiryReminderRepository';
import { AirportApplicationRepository } from './repositories/airportApplicationRepository';
import { ApplicationPaymentOrderRepository } from './repositories/applicationPaymentOrderRepository';
import { ApplicantBillingRepository } from './repositories/applicantBillingRepository';
import { AuditRepository } from './repositories/auditRepository';
import { NewsRepository } from './repositories/newsRepository';
import { MonthlyReportRepository } from './repositories/monthlyReportRepository';
import { ToolDownloadRepository } from './repositories/toolDownloadRepository';
import { MetricsRepository } from './repositories/metricsRepository';
import { PerformanceNodePreferenceRepository } from './repositories/performanceNodePreferenceRepository';
import { PerformanceProbeRepository } from './repositories/performanceProbeRepository';
import { PerformanceProbeJobRepository } from './repositories/performanceProbeJobRepository';
import { PerformanceProbeSettingRepository } from './repositories/performanceProbeSettingRepository';
import { PerformanceRunRepository } from './repositories/performanceRunRepository';
import { PerformanceRunTargetRepository } from './repositories/performanceRunTargetRepository';
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
import { NetworkCoverageRunRepository } from './repositories/networkCoverageRunRepository';
import { createAdminAuthRoutes } from './routes/adminAuthRoutes';
import { createAdminRoutes } from './routes/adminRoutes';
import { createPerformanceProbeRoutes } from './routes/performanceProbeRoutes';
import { createNewsAdminRoutes } from './routes/newsAdminRoutes';
import { createMonthlyReportAdminRoutes } from './routes/monthlyReportAdminRoutes';
import { createPortalRoutes } from './routes/portalRoutes';
import { createOutboundRoutes } from './routes/outboundRoutes';
import { createPublishRoutes } from './routes/publishRoutes';
import { createPublicPageRoutes } from './routes/publicPageRoutes';
import { createNewsPublicRoutes } from './routes/newsPublicRoutes';
import { createToolsAdminRoutes } from './routes/toolsAdminRoutes';
import { createToolsPublicRoutes } from './routes/toolsPublicRoutes';
import { createDnsLeakInternalRoutes } from './routes/dnsLeakInternalRoutes';
import { createMachineReadableRoutes } from './routes/machineReadableRoutes';
import { createPublicRoutes } from './routes/publicRoutes';
import { createUserTelegramBotRoutes } from './routes/userTelegramBotRoutes';
import { AccessTokenService } from './services/accessTokenService';
import { AdminAuthService } from './services/adminAuthService';
import { ApplicantPortalAuthService } from './services/applicantPortalAuthService';
import { ApplicantXOAuthService } from './services/applicantXOAuthService';
import { AggregationService } from './services/aggregationService';
import { PerformanceProbeJobService } from './services/performanceProbeJobService';
import { PerformanceProbeDispatchService } from './services/performanceProbeDispatchService';
import { PerformanceAnomalyService } from './services/performanceAnomalyService';
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
import { MonthlyReportPublicService } from './services/monthlyReportPublicService';
import { MonthlyReportGenerationService } from './services/monthlyReportGenerationService';
import { IpGeolocationService } from './services/ipGeolocationService';
import { DnsLeakTestService } from './services/dnsLeakTestService';
import { ToolsDownloadService } from './services/toolsDownloadService';
import { PublicViewService } from './services/publicViewService';
import { AirportDealDetailService } from './services/airportDealDetailService';
import { RecomputeService } from './services/recomputeService';
import { RiskCheckService } from './services/riskCheckService';
import { SmtpSettingsService } from './services/smtpSettingsService';
import { AdExpiryReminderService } from './services/adExpiryReminderService';
import { AdminSchedulerService } from './services/adminSchedulerService';
import { SchedulerTaskExecutor } from './services/schedulerTaskExecutor';
import { SubscriptionNodeCaptureService } from './services/subscriptionNodeCaptureService';
import { TelegramNotificationService } from './services/telegramNotificationService';
import { UserTelegramBotMessageService } from './services/userTelegramBotMessageService';
import { UserTelegramBotSettingsService } from './services/userTelegramBotSettingsService';
import { XOAuthSettingsService } from './services/xOAuthSettingsService';
import { ScoreRuleService } from './services/scoreRuleService';
import { getNewsUploadRootDir } from './utils/newsStorage';
import { createTimedPromiseCache, PUBLIC_PAGE_CACHE_TTL_MS } from './utils/publicCache';
import { BillingEligibilityService } from './services/billingEligibilityService';
import { createLiveScoreRoutes } from './routes/liveScoreRoutes';

export async function createApp() {
  const pool = getDbPool();
  const airportRepository = new AirportRepository(pool);
  await airportRepository.ensureSchema();
  const airportAdCampaignRepository = new AirportAdCampaignRepository(pool);
  await airportAdCampaignRepository.ensureSchema();
  const adExpiryReminderRepository = new AdExpiryReminderRepository(pool);
  await adExpiryReminderRepository.ensureSchema();
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
  const performanceRunTargetRepository = new PerformanceRunTargetRepository(pool);
  await performanceRunTargetRepository.ensureSchema();
  const performanceProbeRepository = new PerformanceProbeRepository(pool);
  await performanceProbeRepository.ensureSchema();
  const performanceProbeSettingRepository = new PerformanceProbeSettingRepository(pool);
  await performanceProbeSettingRepository.ensureSchema();
  const subscriptionNodeSnapshotRepository = new SubscriptionNodeSnapshotRepository(pool);
  await subscriptionNodeSnapshotRepository.ensureSchema();
  const networkCoverageRunRepository = new NetworkCoverageRunRepository(pool);
  await networkCoverageRunRepository.ensureSchema();
  const performanceProbeJobRepository = new PerformanceProbeJobRepository(pool);
  await performanceProbeJobRepository.ensureSchema();
  const subscriptionNodeCaptureService = new SubscriptionNodeCaptureService();
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
  const scoreRuleService = new ScoreRuleService({ systemSettingRepository });
  const accessTokenRepository = new AccessTokenRepository(pool);
  await accessTokenRepository.ensureSchema();
  const marketingEventRepository = new MarketingEventRepository(pool);
  await marketingEventRepository.ensureSchema();
  const newsRepository = new NewsRepository(pool);
  await newsRepository.ensureSchema();
  const monthlyReportRepository = new MonthlyReportRepository(pool);
  await monthlyReportRepository.ensureSchema();
  const toolDownloadRepository = new ToolDownloadRepository(pool);
  await toolDownloadRepository.ensureSchema();
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
    networkCoverageRunRepository,
    scoreRuleService,
  });
  const aggregationService = new AggregationService({
    airportRepository,
    probeSampleRepository,
    metricsRepository,
    performanceRunRepository,
    performanceRunTargetRepository,
    performanceProbeSettingRepository,
  });
  const riskCheckService = new RiskCheckService({
    airportRepository,
    metricsRepository,
  });
  const marketingSettingsService = new MarketingSettingsService({
    systemSettingRepository,
  });
  const billingEligibility = new BillingEligibilityService(pool, marketingSettingsService, scoreRuleService);
  scoreRepository.billingEligibility = billingEligibility;
  applicantBillingRepository.billingEligibility = billingEligibility;
  const smtpSettingsService = new SmtpSettingsService({
    systemSettingRepository,
  });
  const mailService = new MailService({
    smtpSettingsService,
  });
  const adExpiryReminderService = new AdExpiryReminderService({
    repository: adExpiryReminderRepository,
    mailService,
  });
  const userTelegramBotSettingsService = new UserTelegramBotSettingsService({
    systemSettingRepository,
  });
  const userTelegramBotMessageService = new UserTelegramBotMessageService({
    userTelegramBotSettingsService,
    applicantTelegramBindingRepository,
  });
  const performanceProbeDispatchService = new PerformanceProbeDispatchService({
    airportRepository,
    probeRepository: performanceProbeRepository,
    settingRepository: performanceProbeSettingRepository,
    snapshotRepository: subscriptionNodeSnapshotRepository,
    preferenceRepository: performanceNodePreferenceRepository,
    jobRepository: performanceProbeJobRepository,
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
    scoreRepository,
    performanceProbeDispatchService,
    adExpiryReminderService,
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
    performanceProbeDispatchService,
  });
  await manualJobService.initialize();
  const toolsDownloadService = new ToolsDownloadService(toolDownloadRepository, systemSettingRepository);
  const ipCheckService = new IpGeolocationService();
  const dnsLeakTestService = new DnsLeakTestService({
    ipCheckService,
    zone: process.env.DNS_LEAK_TEST_ZONE,
    sessionSecret: process.env.DNS_PROBE_SESSION_SECRET,
    callbackSecret: process.env.DNS_PROBE_CALLBACK_SECRET,
    maxSessions: Number(process.env.DNS_LEAK_TEST_MAX_SESSIONS || 5_000),
  });
    const publicViewService = new PublicViewService({
      airportRepository,
      metricsRepository,
      scoreRepository,
      applicantBillingRepository,
      marketingSettingsService,
      rankingRepository,
      statsRepository,
      subscriptionNodeSnapshotRepository,
      networkCoverageRunRepository,
      scoreRuleService,
      toolsDownloadService,
      airportAdCampaignRepository,
      newsRepository,
    });
  const airportDealDetailService = new AirportDealDetailService({
    airportRepository,
    airportAdCampaignRepository,
  });
  const newsContentService = new NewsContentService();
  const newsCoverImageService = new NewsCoverImageService();
  const monthlyReportGenerationService = new MonthlyReportGenerationService({
    airportRepository,
    metricsRepository,
    scoreRepository,
    rankingRepository,
    monthlyReportRepository,
    newsContentService,
  });
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
  const monthlyReportPublicService = new MonthlyReportPublicService(monthlyReportRepository, airportRepository);
  const applicationNotificationService = new TelegramNotificationService({
    systemSettingRepository,
  });
  const publicPageCache = createTimedPromiseCache(PUBLIC_PAGE_CACHE_TTL_MS);
  const performanceAnomalyService = new PerformanceAnomalyService({
    runRepository: performanceRunRepository,
    targetRepository: performanceRunTargetRepository,
    metricsRepository,
  });
  const performanceProbeJobService = new PerformanceProbeJobService({
    jobRepository: performanceProbeJobRepository,
    snapshotRepository: subscriptionNodeSnapshotRepository,
    runRepository: performanceRunRepository,
    targetRepository: performanceRunTargetRepository,
    aggregationService,
    recomputeService,
    performanceAnomalyService,
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.urlencoded({ extended: false, limit: process.env.URLENCODED_BODY_LIMIT || '100kb' }));
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
  app.use(requestContext);
  app.use(privateSeoGuard);
  app.use('/uploads', express.static(getNewsUploadRootDir()));
  app.use(corsAllowlist);
  app.use('/api/v1', createLiveScoreRoutes(billingEligibility));

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(
    '/api/v1/performance-probe',
    createPerformanceProbeRateLimit(),
    performanceProbeAuth(performanceProbeRepository),
    createPerformanceProbeRoutes({ jobService: performanceProbeJobService }),
  );

  app.use(
    '/api/v1',
    createPublicRoutes({
      billingEligibility,
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
      airportDealDetailService,
      pageCache: publicPageCache,
      marketingRepository: marketingEventRepository,
      marketingSettingsService,
    }),
  );
  app.use(
    '/api/v1',
    createToolsPublicRoutes({
      toolsDownloadService,
      ipCheckService,
      dnsLeakTestService,
    }),
  );
  app.use(
    '/api/v1/internal',
    createDnsLeakInternalRoutes(dnsLeakTestService),
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
      scoreRepository,
      mailService,
      userTelegramBotMessageService,
    }),
  );
  app.use(
    createNewsPublicRoutes({
      newsPublicService,
      publicViewService,
      monthlyReportPublicService,
      airportAdCampaignRepository,
      marketingRepository: marketingEventRepository,
    }),
  );

  const revenueRepository = new RevenueRepository(pool);
  await revenueRepository.ensureSchema();
  app.use('/api/v1/admin', createAdminAuthRoutes(authService));
  app.use('/api/v1/admin', adminAuth, createRevenueRoutes(new RevenueService(revenueRepository)));

  app.use(
    '/api/v1/admin',
    adminAuth,
    createAdminRoutes({
      airportRepository,
      airportApplicationRepository,
      applicationPaymentOrderRepository,
      applicantBillingRepository,
      applicantAccountRepository,
      airportAdCampaignRepository,
      probeSampleRepository,
      performanceRunRepository,
      performanceRunTargetRepository,
      performanceProbeRepository,
      performanceProbeSettingRepository,
      subscriptionNodeSnapshotRepository,
      networkCoverageRunRepository,
      scoreRuleService,
      subscriptionNodeCaptureService,
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
    createToolsAdminRoutes({
      auditRepository,
      publicPageCache,
      toolsDownloadService,
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
    '/api/v1/admin',
    adminAuth,
    createMonthlyReportAdminRoutes({
      auditRepository,
      monthlyReportRepository,
      monthlyReportGenerationService,
      newsContentService,
      newsCoverImageService,
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
      airportAdCampaignRepository,
      monthlyReportPublicService,
      marketingRepository: marketingEventRepository,
    }),
  );

  app.use(
    createPublicPageRoutes({
      publicViewService,
      airportAdCampaignRepository,
      airportDealDetailService,
      monthlyReportPublicService,
      toolsDownloadService,
      pageCache: publicPageCache,
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

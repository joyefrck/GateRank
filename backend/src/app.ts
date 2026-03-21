import express from 'express';
import { getDbPool } from './db/mysql';
import { adminAuth } from './middleware/adminAuth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestContext } from './middleware/requestContext';
import { AirportRepository } from './repositories/airportRepository';
import { AuditRepository } from './repositories/auditRepository';
import { MetricsRepository } from './repositories/metricsRepository';
import { RankingRepository } from './repositories/rankingRepository';
import { ScoreRepository } from './repositories/scoreRepository';
import { createAdminRoutes } from './routes/adminRoutes';
import { createPublicRoutes } from './routes/publicRoutes';
import { RecomputeService } from './services/recomputeService';

export function createApp() {
  const pool = getDbPool();
  const airportRepository = new AirportRepository(pool);
  const metricsRepository = new MetricsRepository(pool);
  const scoreRepository = new ScoreRepository(pool);
  const rankingRepository = new RankingRepository(pool);
  const auditRepository = new AuditRepository(pool);
  const recomputeService = new RecomputeService({
    airportRepository,
    metricsRepository,
    scoreRepository,
    rankingRepository,
  });

  const app = express();
  app.use(express.json());
  app.use(requestContext);

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(
    '/api/v1',
    createPublicRoutes({
      airportRepository,
      metricsRepository,
      scoreRepository,
      rankingRepository,
    }),
  );

  app.use(
    '/api/v1/admin',
    adminAuth,
    createAdminRoutes({
      airportRepository,
      metricsRepository,
      recomputeService,
      auditRepository,
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, recomputeService };
}

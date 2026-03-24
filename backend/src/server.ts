import 'dotenv/config';
import type { Server } from 'node:http';
import { createApp } from './app';
import { DailyRecomputeJob } from './jobs/dailyRecomputeJob';

const port = Number(process.env.PORT || 8787);

let server: Server | null = null;
let job: DailyRecomputeJob | null = null;

void bootstrap().catch((error) => {
  console.error('[server] bootstrap failed', error);
  process.exit(1);
});

async function bootstrap(): Promise<void> {
  const { app, recomputeService, aggregationService } = await createApp();
  server = app.listen(port, () => {
    console.log(`[server] backend listening on :${port}`);
  });

  job = new DailyRecomputeJob(recomputeService, aggregationService);
  job.start();
}

function shutdown(signal: string): void {
  console.log(`[server] received ${signal}, shutting down`);
  job?.stop();
  if (!server) {
    process.exit(0);
    return;
  }
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

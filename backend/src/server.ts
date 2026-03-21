import 'dotenv/config';
import { createApp } from './app';
import { DailyRecomputeJob } from './jobs/dailyRecomputeJob';

const port = Number(process.env.PORT || 8787);

const { app, recomputeService } = createApp();
const server = app.listen(port, () => {
  console.log(`[server] backend listening on :${port}`);
});

const job = new DailyRecomputeJob(recomputeService);
job.start();

function shutdown(signal: string): void {
  console.log(`[server] received ${signal}, shutting down`);
  job.stop();
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

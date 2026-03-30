import 'dotenv/config';
import type { Server } from 'node:http';
import { createApp } from './app';
import { applyBackendEnvToProcessEnv } from './utils/backendEnv';

applyBackendEnvToProcessEnv();

const port = Number(process.env.PORT || 8787);

let server: Server | null = null;
let schedulerService: { startAll(): Promise<void>; stopAll(): void } | null = null;

void bootstrap().catch((error) => {
  console.error('[server] bootstrap failed', error);
  process.exit(1);
});

async function bootstrap(): Promise<void> {
  const { app, adminSchedulerService } = await createApp();
  server = app.listen(port, () => {
    console.log(`[server] backend listening on :${port}`);
  });
  schedulerService = adminSchedulerService;
  await schedulerService.startAll();
}

function shutdown(signal: string): void {
  console.log(`[server] received ${signal}, shutting down`);
  schedulerService?.stopAll();
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

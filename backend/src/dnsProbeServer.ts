import 'dotenv/config';
import { DnsLeakAuthoritativeServer } from './services/dnsLeakAuthoritativeServer';
import { applyBackendEnvToProcessEnv } from './utils/backendEnv';

applyBackendEnvToProcessEnv();

const zone = requiredEnv('DNS_LEAK_TEST_ZONE');
const publicIpv4 = requiredEnv('DNS_PROBE_PUBLIC_IPV4');
const sessionSecret = requiredEnv('DNS_PROBE_SESSION_SECRET');
const callbackSecret = requiredEnv('DNS_PROBE_CALLBACK_SECRET');
const callbackUrl = requiredEnv('DNS_PROBE_CALLBACK_URL');
const address = process.env.DNS_PROBE_ADDRESS || '0.0.0.0';
const port = Number(process.env.DNS_PROBE_PORT || 5353);

const server = new DnsLeakAuthoritativeServer({
  zone,
  publicIpv4,
  sessionSecret,
  callbackSecret,
  callbackUrl,
  callbackTimeoutMs: Number(process.env.DNS_PROBE_CALLBACK_TIMEOUT_MS || 3_000),
});

void server.listen({ address, port }).then((addresses) => {
  console.log('[dns-probe] authoritative server listening', {
    zone,
    udp: addresses.udp ? `${addresses.udp.address}:${addresses.udp.port}` : null,
    tcp: addresses.tcp ? `${addresses.tcp.address}:${addresses.tcp.port}` : null,
  });
}).catch((error) => {
  console.error('[dns-probe] startup failed', error);
  process.exit(1);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[dns-probe] received ${signal}, shutting down`);
  await server.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

function requiredEnv(name: string): string {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

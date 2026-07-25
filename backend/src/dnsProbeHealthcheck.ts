import DNS from 'dns2';

const zone = String(process.env.DNS_LEAK_TEST_ZONE || '').trim();
const port = Number(process.env.DNS_PROBE_PORT || 5353);
if (!zone) {
  console.error('[dns-probe-healthcheck] DNS_LEAK_TEST_ZONE is required');
  process.exit(1);
}

const resolve = DNS.UDPClient({
  dns: '127.0.0.1',
  port,
  timeout: 1_500,
  retryOverTCP: false,
});

void resolve(zone, 'SOA').then((response) => {
  const hasAuthoritativeSoa = response.header.aa === 1
    && response.answers.some((answer) => answer.type === DNS.Packet.TYPE.SOA);
  process.exit(hasAuthoritativeSoa ? 0 : 1);
}).catch(() => {
  process.exit(1);
});

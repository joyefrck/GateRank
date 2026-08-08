import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const files = {
  manager: 'scripts/manage_performance_probe.ts',
  service: 'ops/performance-probe/gaterank-probe.service',
  timer: 'ops/performance-probe/gaterank-probe.timer',
  env: 'ops/performance-probe/gaterank-probe.env.example',
  install: 'ops/performance-probe/install.sh',
  readme: 'ops/performance-probe/README.md',
} as const;

async function read(relativePath: string): Promise<string> {
  return readFile(path.join(ROOT, relativePath), 'utf8');
}

test('probe service runs serialized as a hardened non-root oneshot', async () => {
  const [service, timer] = await Promise.all([read(files.service), read(files.timer)]);

  assert.match(service, /^Type=oneshot$/m);
  assert.match(service, /^User=gaterank-probe$/m);
  assert.match(service, /^Group=gaterank-probe$/m);
  assert.match(service, /^UMask=0077$/m);
  assert.match(service, /^NoNewPrivileges=true$/m);
  assert.match(service, /^PrivateTmp=true$/m);
  assert.match(service, /^ProtectSystem=strict$/m);
  assert.match(service, /^ProtectHome=true$/m);
  assert.match(service, /^ReadWritePaths=\/var\/lib\/gaterank-probe$/m);
  assert.match(service, /^MemoryMax=\d+M$/m);
  assert.match(service, /^CPUQuota=\d+%$/m);
  assert.match(service, /^TimeoutStartSec=/m);
  assert.match(timer, /^Persistent=true$/m);
  assert.match(timer, /^RandomizedDelaySec=/m);
  assert.match(timer, /^Unit=gaterank-probe\.service$/m);
});

test('probe install pins sing-box and never activates the timer implicitly', async () => {
  const install = await read(files.install);

  assert.match(install, /SING_BOX_VERSION="1\.13\.12"/);
  assert.match(install, /SING_BOX_SHA256="[a-f0-9]{64}"/);
  assert.match(install, /sha256sum --check --status/);
  assert.match(install, /Debian 12 is required/);
  assert.match(install, /useradd --system/);
  assert.match(install, /python3 -m venv/);
  assert.doesNotMatch(install, /systemctl enable|systemctl start/);
});

test('probe manager issues one-time random tokens and refuses legacy or argv secrets', async () => {
  const manager = await read(files.manager);

  assert.match(manager, /randomBytes\(32\)/);
  assert.match(manager, /createHash\('sha256'\)/);
  assert.match(manager, /setTokenHash/);
  assert.match(manager, /will not be shown again/);
  assert.match(manager, /legacy-control is managed by the backend/);
  assert.match(manager, /Command-line arguments are not accepted/);
  assert.doesNotMatch(manager, /console\.(log|error)\([^\n]*(MYSQL_PASSWORD|tokenHash|process\.env)/);
});

test('probe artifacts contain no tracked secrets and document safe rotation and rollback', async () => {
  const entries = await Promise.all(Object.values(files).map(async (relativePath) => ({
    relativePath,
    content: await read(relativePath),
  })));
  const allArtifacts = entries.map((entry) => entry.content).join('\n');

  assert.doesNotMatch(allArtifacts, /ADMIN_API_KEY=[^\s#]+|PROBE_API_TOKEN=[^\s#]+|Bearer [A-Za-z0-9]/);
  assert.doesNotMatch(allArtifacts, /BEGIN (RSA|OPENSSH) PRIVATE KEY/);
  assert.match(allArtifacts, /mode 0600|m 0600/);
  assert.match(allArtifacts, /SSH 密钥登录/);
  assert.match(allArtifacts, /journalctl/);
  assert.match(allArtifacts, /PROBE_ACTION=issue-token/);
  assert.match(allArtifacts, /PROBE_ACTION=revoke-token/);
  assert.match(allArtifacts, /systemctl disable --now gaterank-probe\.timer/);
  assert.match(allArtifacts, /历史报告/);
});

import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  augmentPathWithCommonBinaryDirs,
} from '../utils/runtimeBinary';
import { getAdminAuthConfig } from '../utils/adminAuthConfig';
import { signAdminToken } from '../utils/token';
import { assertHeaderSafeValue, summarizeManualJobScriptFailure } from './manualJobService';

const execFileAsync = promisify(execFile);

export interface SubscriptionNodeCaptureResult {
  airport_id: number;
  snapshot_id: number;
  captured_at: string;
  subscription_format: string | null;
  parsed_nodes_count: number;
  supported_nodes_count: number;
  unsupported_nodes_count: number;
}

export class SubscriptionNodeCaptureService {
  private readonly apiBase: string;
  private readonly adminApiKey: string;
  private readonly adminBearerToken: string;
  private readonly pythonBin: string;
  private readonly repoRoot: string;
  private readonly runtimePath: string;
  private readonly scriptTimeoutMs: number;

  constructor() {
    this.apiBase = (process.env.API_BASE || `http://127.0.0.1:${process.env.PORT || 8787}`).replace(/\/+$/, '');
    const authConfig = getAdminAuthConfig();
    this.adminApiKey = process.env.ADMIN_API_KEY || authConfig.apiKey || '';
    this.adminBearerToken = authConfig.jwtSecret
      ? signAdminToken(authConfig.jwtSecret, authConfig.tokenTtlHours).token
      : '';
    this.pythonBin = process.env.PYTHON_BIN || 'python3';
    this.repoRoot = process.cwd();
    this.runtimePath = augmentPathWithCommonBinaryDirs(process.env.PATH);
    this.scriptTimeoutMs = Math.max(1000, Number(process.env.SUBSCRIPTION_CAPTURE_TIMEOUT_MS || 60000));
  }

  async capture(airportId: number, _actor: string): Promise<SubscriptionNodeCaptureResult> {
    if (!this.adminApiKey && !this.adminBearerToken) {
      throw new Error('ADMIN_API_KEY / ADMIN_BEARER_TOKEN 未配置，无法获取订阅节点');
    }
    assertHeaderSafeValue('ADMIN_API_KEY', this.adminApiKey, 'x-api-key');
    assertHeaderSafeValue('ADMIN_BEARER_TOKEN', this.adminBearerToken, 'Authorization');

    const scriptPath = path.resolve(this.repoRoot, 'scripts', 'capture_subscription_nodes.py');
    try {
      const { stdout } = await execFileAsync(this.pythonBin, [scriptPath], {
        cwd: this.repoRoot,
        env: {
          ...process.env,
          PATH: this.runtimePath,
          API_BASE: this.apiBase,
          ADMIN_API_KEY: this.adminApiKey,
          ADMIN_BEARER_TOKEN: this.adminBearerToken,
          AIRPORT_ID: String(airportId),
          SOURCE: 'admin-capture',
        },
        maxBuffer: 10 * 1024 * 1024,
        timeout: this.scriptTimeoutMs,
      });
      return parseCaptureOutput(stdout);
    } catch (error) {
      throw new Error(summarizeManualJobScriptFailure(error));
    }
  }
}

function parseCaptureOutput(stdout: string): SubscriptionNodeCaptureResult {
  const output = stdout.trim();
  if (!output) {
    throw new Error('capture script did not return JSON output');
  }
  const parsed = JSON.parse(output) as Record<string, unknown>;
  const snapshotId = Number(parsed.snapshot_id);
  const airportId = Number(parsed.airport_id);
  if (!Number.isFinite(snapshotId) || snapshotId <= 0 || !Number.isFinite(airportId) || airportId <= 0) {
    throw new Error('capture script returned invalid snapshot summary');
  }
  return {
    airport_id: airportId,
    snapshot_id: snapshotId,
    captured_at: String(parsed.captured_at || ''),
    subscription_format: parsed.subscription_format == null ? null : String(parsed.subscription_format),
    parsed_nodes_count: Number(parsed.parsed_nodes_count || 0),
    supported_nodes_count: Number(parsed.supported_nodes_count || 0),
    unsupported_nodes_count: Number(parsed.unsupported_nodes_count || 0),
  };
}

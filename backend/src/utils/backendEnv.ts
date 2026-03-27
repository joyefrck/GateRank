import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';

const cachedEnvByPath = new Map<string, Record<string, string>>();

interface BackendEnvOptions {
  cwd?: string;
  envPath?: string;
}

export function applyBackendEnvToProcessEnv(options: BackendEnvOptions = {}): Record<string, string> {
  const env = loadBackendEnv(options);
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return env;
}

export function loadBackendEnv(options: BackendEnvOptions = {}): Record<string, string> {
  const envPath = resolveBackendEnvPath(options);
  if (!envPath) {
    return {};
  }

  const cached = cachedEnvByPath.get(envPath);
  if (cached) {
    return cached;
  }

  try {
    const parsed = parse(readFileSync(envPath, 'utf8'));
    cachedEnvByPath.set(envPath, parsed);
    return parsed;
  } catch {
    cachedEnvByPath.set(envPath, {});
    return {};
  }
}

function resolveBackendEnvPath(options: BackendEnvOptions): string | null {
  if (options.envPath) {
    return existsSync(options.envPath) ? options.envPath : null;
  }

  const cwd = options.cwd || process.cwd();
  const candidates = [
    path.resolve(cwd, 'backend/.env'),
    path.resolve(cwd, '.env'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

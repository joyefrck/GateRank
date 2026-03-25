import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_BINARY_DIRS = [
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
  '/opt/homebrew/bin',
  '/snap/bin',
];

export function resolveBinaryPath(
  binaryName: string,
  explicitPath?: string,
  candidateDirs: string[] = DEFAULT_BINARY_DIRS,
): string {
  const trimmed = explicitPath?.trim();
  if (trimmed) {
    return trimmed;
  }

  for (const dir of candidateDirs) {
    const candidate = path.join(dir, binaryName);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }

  return binaryName;
}

export function augmentPathWithCommonBinaryDirs(
  currentPath?: string,
  candidateDirs: string[] = DEFAULT_BINARY_DIRS,
): string {
  const entries = (currentPath || '').split(path.delimiter).filter(Boolean);
  const merged = [...entries];

  for (const dir of candidateDirs) {
    if (dir && !merged.includes(dir)) {
      merged.push(dir);
    }
  }

  return merged.join(path.delimiter);
}

export function normalizeSingBoxError(message: string, singBoxBin: string): string {
  if (message.includes('singbox_not_found')) {
    return `未找到 sing-box 可执行文件。当前使用 ${singBoxBin}。请在服务环境中配置 SING_BOX_BIN（例如 /usr/local/bin/sing-box），或把 sing-box 所在目录加入 PATH。`;
  }

  if (message.includes('singbox_start_failed')) {
    return 'sing-box 已找到，但本地代理启动失败。请检查 sing-box 是否可正常运行，以及代理端口是否被占用。';
  }

  return message;
}

function isExecutable(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

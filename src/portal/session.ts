export class PortalAuthenticationError extends Error {
  constructor(readonly code: string) {
    super('登录已失效，请重新登录');
    this.name = 'PortalAuthenticationError';
  }
}

export async function readPortalResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null) as { code?: string; message?: string } | null;
  if (response.status === 401) {
    throw new PortalAuthenticationError(data?.code || 'UNAUTHORIZED');
  }
  if (!response.ok) {
    throw new Error(data?.message || `请求失败: ${response.status}`);
  }
  return data as T;
}

export function portalLoadError(error: unknown, allowAnonymous = false): string {
  if (allowAnonymous && error instanceof PortalAuthenticationError && error.code === 'PORTAL_AUTH_REQUIRED') {
    return '';
  }
  return error instanceof Error ? error.message : '加载失败';
}

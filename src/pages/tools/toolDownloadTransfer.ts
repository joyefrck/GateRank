export interface TransferProgress { loaded: number; total: number | null }
export interface TransferFailure { message: string; retryAt: number }

export function downloadFilename(header: string | null, fallback: string): string {
  const encoded = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  let name = header?.match(/filename="([^"]+)"|filename=([^;]+)/i)?.slice(1).find(Boolean) || fallback;
  if (encoded) {
    try { name = decodeURIComponent(encoded); } catch { /* Use plain filename for malformed headers. */ }
  }
  return name.replace(/[\\/\x00-\x1f\x7f]/g, '_').trim() || fallback;
}

export function retryAfterDeadline(value: string | null, now = Date.now()): number {
  if (!value) return now + 60_000;
  const seconds = Number(value);
  return Math.max(now, Number.isFinite(seconds) ? now + seconds * 1000 : Date.parse(value) || now + 60_000);
}

export function startToolDownload(url: string, fallbackName: string, callbacks: {
  progress: (value: TransferProgress) => void;
  complete: (blob: Blob, filename: string) => void;
  failure: (error: TransferFailure) => void;
}, createRequest = () => new XMLHttpRequest()): () => void {
  const request = createRequest();
  let disposed = false;
  request.open('GET', url);
  request.responseType = 'blob';
  request.onprogress = (event) => {
    if (!disposed && request.status === 200) callbacks.progress({
      loaded: event.loaded,
      total: event.lengthComputable && event.total > 0 ? event.total : null,
    });
  };
  request.onload = () => {
    if (disposed) return;
    if (request.status === 200 && request.response instanceof Blob && request.response.size > 0) {
      callbacks.complete(request.response, downloadFilename(request.getResponseHeader('Content-Disposition'), fallbackName));
    } else {
      callbacks.failure({
        message: request.status === 429 ? '下载请求过于频繁，请稍后重试。'
          : request.status === 404 ? '安装包不存在或已下架，请使用官方入口。'
          : request.status === 403 ? '下载请求被拒绝，请使用官方入口。'
          : '下载失败，请重试或使用官方入口。',
        retryAt: request.status === 429 ? retryAfterDeadline(request.getResponseHeader('Retry-After')) : 0,
      });
    }
  };
  request.onerror = request.ontimeout = () => {
    if (!disposed) callbacks.failure({ message: '网络连接中断，请重试或使用官方入口。', retryAt: 0 });
  };
  request.send();
  return () => {
    disposed = true;
    request.onprogress = request.onload = request.onerror = request.ontimeout = null;
    request.abort();
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';

type TurnstileApi = {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  remove(id: string): void;
};
declare global {
  interface Window { turnstile?: TurnstileApi }
}
let scriptPromise: Promise<TurnstileApi> | undefined;
function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(fail, 15000);
    function fail() {
      window.clearTimeout(timeout);
      script.remove();
      scriptPromise = undefined;
      reject(new Error('真人校验加载失败，请重试'));
    }
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timeout);
      if (window.turnstile) resolve(window.turnstile);
      else fail();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function useTurnstile() {
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [generation, setGeneration] = useState(0);
  const onChange = useCallback((value: string, allowed: boolean) => {
    setToken(value);
    setReady(allowed);
  }, []);
  const reset = useCallback(() => {
    setToken('');
    setReady(false);
    setGeneration((value) => value + 1);
  }, []);
  return { token, ready, generation, onChange, reset };
}

export function TurnstileWidget({ action, generation, onChange }: {
  action: 'portal_login' | 'airport_apply';
  generation: number;
  onChange: (token: string, ready: boolean) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let widgetId: string | undefined;
    let api: TurnstileApi | undefined;
    const abort = new AbortController();
    const timeout = window.setTimeout(() => abort.abort(), 15000);
    setError('');
    setLoading(true);
    onChange('', false);
    void (async () => {
      const apiBase = (import.meta.env.VITE_API_BASE || '').trim().replace(/\/+$/, '');
      const response = await fetch(`${apiBase}/api/v1/security/turnstile`, { cache: 'no-store', credentials: 'include', signal: abort.signal });
      if (!response.ok) throw new Error('真人校验暂时不可用，请重试');
      const config = await response.json();
      window.clearTimeout(timeout);
      if (!active) return;
      if (config.enabled === false) { setLoading(false); onChange('', true); return; }
      if (config.enabled !== true || typeof config.site_key !== 'string' || !config.site_key) throw new Error('真人校验暂时不可用，请重试');
      api = await loadScript();
      if (!active || !container.current) return;
      widgetId = api.render(container.current, {
        sitekey: config.site_key, action, theme: 'light', size: 'flexible', language: 'zh-cn',
        'response-field': false,
        callback: (token: string) => { if (active) { setError(''); onChange(token, true); } },
        'expired-callback': () => { if (active) onChange('', false); },
        'error-callback': () => { if (active) { onChange('', false); setError('真人校验失败，请重试'); } },
        'timeout-callback': () => { if (active) { onChange('', false); setError('真人校验超时，请重试'); } },
      });
      setLoading(false);
    })().catch(() => {
      if (active) { setLoading(false); setError('真人校验加载失败，请检查网络后重试'); onChange('', false); }
    }).finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      abort.abort();
      window.clearTimeout(timeout);
      if (api && widgetId !== undefined) api.remove(widgetId);
    };
  }, [action, generation, onChange, retry]);
  return (
    <div className="w-full max-w-[300px]" aria-label="真人校验">
      <div ref={container} />
      {loading && <p role="status" className="text-xs text-neutral-500">正在加载真人校验…</p>}
      {error && <div role="alert" className="text-xs leading-5 text-rose-700">{error} <button type="button" className="min-h-10 underline" onClick={() => setRetry((value) => value + 1)}>重新验证</button></div>}
    </div>
  );
}

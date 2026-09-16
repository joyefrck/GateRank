import React, { useEffect, useRef, useState } from 'react';
import { Mail } from 'lucide-react';

interface Props {
  key?: React.Key;
  airportId: number;
  request: (path: string, init?: RequestInit) => Promise<unknown>;
}

export function BalanceReminderButton({ airportId, request }: Props) {
  const pending = useRef(false);
  const [sending, setSending] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!retryAt) return;
    const update = () => {
      const seconds = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) setRetryAt(0);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  const send = async () => {
    if (pending.current || Date.now() < retryAt) return;
    pending.current = true;
    setSending(true);
    setMessage('');
    setError('');
    try {
      const result = await request(`/api/v1/admin/airports/${airportId}/balance-reminder`, { method: 'POST' }) as { to_email: string };
      setMessage(`已发送至 ${result.to_email}`);
      setRemaining(60);
      setRetryAt(Date.now() + 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '邮件发送失败，请稍后重试');
    } finally {
      pending.current = false;
      setSending(false);
    }
  };

  return (
    <div className="pt-2">
      <button
        type="button"
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={sending || remaining > 0}
        onClick={() => void send()}
        aria-busy={sending}
      >
        <Mail size={16} aria-hidden="true" />
        {sending ? '发送中…' : remaining > 0 ? `已发送（${remaining}s）` : '邮件催促'}
      </button>
      {message && <p role="status" className="mt-2 break-all text-sm text-emerald-700">{message}</p>}
      {error && <p role="alert" className="mt-2 break-words text-sm text-rose-700">{error}</p>}
    </div>
  );
}

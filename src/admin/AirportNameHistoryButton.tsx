import React, { useEffect, useId, useRef, useState } from 'react';
import { History, X } from 'lucide-react';
import type { AirportNameHistoryEntry } from '../../shared/airportNameHistory';

export function AirportNameHistoryButton({
  airportId,
  request,
  formatTime,
}: {
  airportId: number;
  request: (path: string) => Promise<unknown>;
  formatTime: (value: string) => string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestId = useRef(0);
  const titleId = useId();
  const [items, setItems] = useState<AirportNameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    dialogRef.current?.close();
    return () => { requestId.current += 1; };
  }, [airportId]);

  const loadHistory = async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError('');
    setItems([]);
    try {
      const result = await request(`/api/v1/admin/airports/${airportId}/name-history`) as { items: AirportNameHistoryEntry[] };
      if (currentRequest === requestId.current) setItems(result.items);
    } catch (err) {
      if (currentRequest === requestId.current) setError(err instanceof Error ? err.message : '加载历史名称失败');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        onClick={() => { dialogRef.current?.showModal(); void loadHistory(); }}
      >
        <History size={16} aria-hidden="true" />
        查看历史名称
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-0 text-neutral-900 shadow-xl backdrop:bg-black/45"
        onClose={() => { requestId.current += 1; }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
          <div>
            <h3 id={titleId} className="text-lg font-bold">历史名称</h3>
            <p className="mt-1 text-sm text-neutral-500">记录每次保存时的名称变更，按修改时间倒序展示。</p>
          </div>
          <button
            type="button"
            aria-label="关闭历史名称"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-neutral-200 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            onClick={() => dialogRef.current?.close()}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="p-5" aria-live="polite" aria-busy={loading}>
          {loading ? <p className="py-6 text-center text-sm text-neutral-500">正在加载历史名称...</p>
            : error ? (
              <div className="space-y-3 text-center text-sm">
                <p role="alert" className="break-words text-rose-600">{error}</p>
                <button type="button" className="min-h-10 rounded-lg border px-4 py-2" onClick={() => void loadHistory()}>重新加载</button>
              </div>
            ) : items.length === 0 ? (
              <div className="py-6 text-center text-sm text-neutral-500">
                <p>暂无名称变更记录</p>
                <p className="mt-2 text-xs">名称历史从功能启用后开始记录。</p>
              </div>
            ) : (
              <ol className="divide-y divide-neutral-200">
                {items.map((item) => (
                  <li key={item.id} className="py-4 first:pt-0 last:pb-0">
                    <p className="mb-3 text-xs text-neutral-500">修改时间（北京时间）：{formatTime(item.changed_at)}</p>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div className="min-w-0"><dt className="text-neutral-500">原名称</dt><dd className="mt-1 break-words font-medium">{item.old_name}</dd></div>
                      <div className="min-w-0"><dt className="text-neutral-500">修改后名称</dt><dd className="mt-1 break-words font-medium">{item.new_name}</dd></div>
                    </dl>
                  </li>
                ))}
              </ol>
            )}
        </div>
      </dialog>
    </>
  );
}

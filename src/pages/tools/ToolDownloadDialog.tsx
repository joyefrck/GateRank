import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { DownloadAdView } from '../../../shared/airportAds';
import { buildToolControlledDownloadUrl, getToolDownloadPlatformLabel, type ToolDownloadItem, type ToolDownloadPlatform } from '../../../shared/toolDownloads';
import { SponsoredDealCard } from '../home/HomePageV3';
import { startToolDownload, type TransferProgress, type TransferFailure } from './toolDownloadTransfer';

const buttonClass = 'min-h-10 rounded-lg px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50';
const bytes = (value: number) => `${(value / 1024 / 1024).toFixed(1)} MB`;

export function ToolDownloadDialog({ item, platform, onClose }: {
  item: ToolDownloadItem;
  platform: ToolDownloadPlatform;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [ads, setAds] = useState<DownloadAdView[] | null>(null);
  const [adError, setAdError] = useState(false);
  const [progress, setProgress] = useState<TransferProgress>({ loaded: 0, total: null });
  const [status, setStatus] = useState<'downloading' | 'complete' | 'error'>('downloading');
  const [failure, setFailure] = useState<TransferFailure | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const savedFile = useRef<{ url: string; filename: string } | null>(null);

  const save = () => {
    if (!savedFile.current) return;
    const anchor = document.createElement('a');
    anchor.href = savedFile.current.url;
    anchor.download = savedFile.current.filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  };
  const requestClose = () => status === 'downloading' ? setConfirmClose(true) : onClose();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    element.showModal();
    closeButton.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/tools/download-ads', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Ad request failed');
        const data = await response.json();
        if (!Array.isArray(data.items)) throw new Error('Invalid ads');
        setAds(data.items);
      })
      .catch(() => { if (!controller.signal.aborted) setAdError(true); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    // Defer one task so StrictMode's setup/cleanup probe cannot double-count a download.
    const timer = window.setTimeout(() => {
      try {
        dispose = startToolDownload(buildToolControlledDownloadUrl(item, platform), `${item.slug}-${platform}${item.file_extension ? `.${item.file_extension.replace(/^\./, '')}` : ''}`, {
          progress: setProgress,
          complete: (blob, filename) => {
            savedFile.current = { url: URL.createObjectURL(blob), filename };
            setProgress({ loaded: blob.size, total: blob.size });
            setStatus('complete');
            setConfirmClose(false);
            save();
          },
          failure: (error) => { setNow(Date.now()); setFailure(error); setStatus('error'); setConfirmClose(false); },
        });
      } catch {
        setFailure({ message: '无法启动下载，请重试或使用官方入口。', retryAt: 0 });
        setStatus('error');
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      dispose?.();
      if (savedFile.current) URL.revokeObjectURL(savedFile.current.url);
      savedFile.current = null;
    };
  }, [item, platform, attempt]);

  useEffect(() => {
    if (!failure?.retryAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [failure]);

  const retrySeconds = Math.max(0, Math.ceil(((failure?.retryAt || 0) - now) / 1000));
  const percent = progress.total ? Math.min(status === 'complete' ? 100 : 99, Math.floor(progress.loaded / progress.total * 100)) : null;

  return createPortal(
    <dialog ref={dialog} aria-labelledby="tool-download-title" onCancel={(event) => { event.preventDefault(); requestClose(); }}
      className="m-auto w-[calc(100%-32px)] max-w-[520px] max-h-[calc(100dvh-32px)] overflow-hidden [&[open]]:flex [&[open]]:flex-col rounded-3xl border border-gray-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/45">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <h2 id="tool-download-title" className="text-lg font-black">{status === 'complete' ? '文件已接收' : status === 'error' ? '下载未完成' : '正在下载'}</h2>
        <button ref={closeButton} type="button" aria-label="关闭下载弹窗" onClick={requestClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-indigo-400"><X size={20} /></button>
      </div>
      <section aria-label="优秀机场推荐" className="flex min-h-0 flex-col px-5 pt-4">
        <div className="mb-3 flex shrink-0 items-center gap-2"><h3 className="font-black">优秀机场推荐</h3></div>
        <div className="min-h-0 max-h-[min(30dvh,280px)] space-y-3 overflow-y-auto overscroll-contain rounded-lg p-1" tabIndex={0} aria-label="正在投放的广告">
          {ads?.map((ad) => <SponsoredDealCard key={ad.campaign_id} deal={ad} pageKind="tools_download" showAdLabel />)}
          {adError || ads?.length === 0 ? <p className="py-4 text-sm text-slate-500">{adError ? '广告暂时无法加载，不影响下载。' : '当前暂无有效广告。'}</p>
            : ads === null ? <p className="py-4 text-sm text-slate-500">正在加载广告…</p> : null}
        </div>
      </section>
      <section aria-label="文件下载进度" className="mt-4 shrink-0 border-t border-gray-100 bg-slate-50/60 p-5">
        <p className="break-words font-bold">{item.name} <span className="text-sm font-medium text-slate-500">· {getToolDownloadPlatformLabel(platform)}</span></p>
        <div className="mt-3 flex justify-between gap-2 text-xs text-slate-500"><span>{bytes(progress.loaded)}{progress.total ? ` / ${bytes(progress.total)}` : ' · 总大小待确认'}</span><span>{percent !== null ? `${percent}%` : status === 'error' ? '已停止' : '接收中'}</span></div>
        <progress aria-label="文件接收进度" max={100} value={percent ?? (status === 'error' ? 0 : undefined)} className="mt-2 h-2 w-full overflow-hidden rounded-full accent-indigo-600 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-indigo-600 [&::-moz-progress-bar]:bg-indigo-600" />
        <p role="status" className="mt-3 text-sm leading-6 text-slate-600">{status === 'complete' ? '文件已接收，已请求浏览器保存。弹窗将保留，您可主动关闭。' : status === 'error' ? failure?.message : '正在接收文件，请保持页面打开。'}</p>
        {confirmClose ? <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-bold">关闭将取消当前下载，下次需要重新开始。</p>
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" className={`${buttonClass} bg-slate-950 text-white`} onClick={() => setConfirmClose(false)}>继续下载</button><button type="button" className={`${buttonClass} border border-slate-300 bg-white`} onClick={onClose}>取消下载并关闭</button></div>
        </div> : <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {status === 'complete' && <button type="button" className={`${buttonClass} bg-slate-950 text-white`} onClick={save}>再次保存</button>}
          {status === 'error' && <button type="button" disabled={retrySeconds > 0} className={`${buttonClass} bg-slate-950 text-white`} onClick={() => { if (Date.now() < (failure?.retryAt || 0)) return; setFailure(null); setProgress({ loaded: 0, total: null }); setStatus('downloading'); setAttempt((value) => value + 1); }}> {retrySeconds > 0 ? `${retrySeconds} 秒后重试` : '重新下载'}</button>}
          <button type="button" className={`${buttonClass} border border-slate-200 bg-white`} onClick={requestClose}>{status === 'downloading' ? '取消下载' : '关闭'}</button>
          {status === 'error' && item.official_url && <a href={item.official_url} target="_blank" rel="nofollow noopener noreferrer" className="px-2 py-3 text-sm font-bold text-indigo-600">官方入口 ↗</a>}
        </div>}
      </section>
    </dialog>, document.body,
  );
}

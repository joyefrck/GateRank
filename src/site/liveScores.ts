import { useEffect, useState } from 'react';

/** Revalidate after connection/reconnection, eligibility changes and returning to the tab. */
export function useLiveScoreRevision(): number {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    const visibility = () => { if (document.visibilityState === 'visible') refresh(); };
    const source = new EventSource(`${String(import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')}/api/v1/scores/events`);
    source.onopen = refresh;
    source.onmessage = refresh;
    source.addEventListener('unavailable', refresh);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pageshow', refresh);
    return () => {
      source.close();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);
  return revision;
}

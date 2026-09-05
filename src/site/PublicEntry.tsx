import { Component, Suspense, lazy, startTransition, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { HomePageV3 } from '../pages/home/HomePageV3';
import { trackPageView } from './analytics';
import { flushMarketingEvents, trackMarketingPageView } from './marketing';

let LoadedApp: ComponentType | undefined;
const loadApp = async () => {
  const module = await import('../App');
  LoadedApp = module.default;
  return module;
};
const OtherPages = lazy(loadApp);

// Resolve the initial route before createRoot replaces the server-rendered document.
export async function preloadPublicRoute(): Promise<void> {
  if (window.location.pathname !== '/') await loadApp();
}

function currentLocation() {
  return { pathname: window.location.pathname, search: window.location.search };
}

class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  declare props: { children: ReactNode };
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <main className="mx-auto max-w-3xl px-6 py-20" role="alert">
        <p>页面加载失败，请重新打开。</p>
        <a href={window.location.href} className="mt-4 inline-block underline">重新加载页面</a>
      </main>;
    }
    return this.props.children;
  }
}

export default function PublicEntry() {
  const [location, setLocation] = useState(currentLocation);
  const isHome = location.pathname === '/';

  useEffect(() => {
    // Keep the current page visible during the first download of another route.
    const onPop = () => startTransition(() => setLocation(currentLocation()));
    const flush = () => flushMarketingEvents();
    window.addEventListener('popstate', onPop);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  useEffect(() => {
    if (!isHome) return; // Other pages retain their existing App tracking.
    const timer = window.setTimeout(() => {
      trackPageView();
      trackMarketingPageView('home');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isHome, location]);

  return <RouteErrorBoundary key={location.pathname}>
    <Suspense fallback={<main className="px-6 py-20 text-center" role="status">正在加载页面…</main>}>
      {isHome
        ? <HomePageV3 date={new URLSearchParams(location.search).get('date') || undefined} />
        : LoadedApp ? <LoadedApp /> : <OtherPages />}
    </Suspense>
  </RouteErrorBoundary>;
}

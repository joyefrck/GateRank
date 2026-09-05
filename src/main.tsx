import {StrictMode, type ComponentType} from 'react';
import {createRoot} from 'react-dom/client';
import PublicEntry, { preloadPublicRoute } from './site/PublicEntry.tsx';
import './index.css';
import { initializeAnalytics } from './site/analytics.ts';

const isAdminPath = window.location.pathname.startsWith('/admin');
const isPrivatePath = isAdminPath || window.location.pathname.startsWith('/portal');
const root = createRoot(document.getElementById('root')!);

function markPrivatePathNoIndex(): void {
  if (!isPrivatePath) {
    return;
  }

  const robots = document.head.querySelector('meta[name="robots"]') ?? document.createElement('meta');
  robots.setAttribute('name', 'robots');
  robots.setAttribute('content', 'noindex,nofollow,noarchive,nosnippet');
  if (!robots.parentElement) {
    document.head.appendChild(robots);
  }
}

function renderApp(AppComponent: ComponentType): void {
  root.render(
    <StrictMode>
      <AppComponent />
    </StrictMode>,
  );
}

async function bootstrap(): Promise<void> {
  markPrivatePathNoIndex();

  if (isAdminPath) {
    const { default: AdminApp } = await import('./admin/AdminApp.tsx');
    renderApp(AdminApp);
    return;
  }

  await preloadPublicRoute();
  initializeAnalytics();
  renderApp(PublicEntry);
}

void bootstrap().catch(() => {
  // Keep useful SSR content and links available if a route chunk cannot load.
  const notice = document.createElement('p');
  notice.setAttribute('role', 'alert');
  notice.textContent = '交互功能加载失败，请刷新页面重试。';
  document.getElementById('root')?.appendChild(notice);
});

import {StrictMode, type ComponentType} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
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

  initializeAnalytics();
  renderApp(App);
}

void bootstrap();

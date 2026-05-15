import {StrictMode, type ComponentType} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeAnalytics } from './site/analytics.ts';

const isAdminPath = window.location.pathname.startsWith('/admin');
const root = createRoot(document.getElementById('root')!);

function renderApp(AppComponent: ComponentType): void {
  root.render(
    <StrictMode>
      <AppComponent />
    </StrictMode>,
  );
}

async function bootstrap(): Promise<void> {
  if (isAdminPath) {
    const { default: AdminApp } = await import('./admin/AdminApp.tsx');
    renderApp(AdminApp);
    return;
  }

  initializeAnalytics();
  renderApp(App);
}

void bootstrap();

import {StrictMode, type ComponentType} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';

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

  const [{ initializeAnalytics }, { default: App }] = await Promise.all([
    import('./site/analytics.ts'),
    import('./App.tsx'),
  ]);
  initializeAnalytics();
  renderApp(App);
}

void bootstrap();

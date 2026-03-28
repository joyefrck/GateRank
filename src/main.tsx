import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AdminApp from './admin/AdminApp.tsx';
import { initializeAnalytics } from './site/analytics.ts';
import './index.css';

const isAdminPath = window.location.pathname.startsWith('/admin');

if (!isAdminPath) {
  initializeAnalytics();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminPath ? <AdminApp /> : <App />}
  </StrictMode>,
);

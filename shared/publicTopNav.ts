import { PUBLIC_SITE_BRAND_NAME } from './publicBrand';
import { PUBLIC_NAVIGATION_ITEMS, type PublicNavigationKind, type PublicNavigationItem } from './publicNavigation';

export const PUBLIC_TOP_NAV_STYLES = `
  .public-top-nav {
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(255,255,255,0.8);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgb(245,245,245);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
  }
  .public-top-nav-inner {
    width: min(1280px, 100%);
    height: 72px;
    margin: 0 auto;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    box-sizing: border-box;
  }
  .public-top-nav-start {
    display: flex;
    align-items: center;
    gap: 40px;
    min-width: 0;
  }
  .public-top-nav-brand {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    color: rgb(23,23,23);
    text-decoration: none;
  }
  .public-top-nav-brand-mark {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgb(23,23,23);
    color: #ffffff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
  }
  .public-top-nav-brand-mark svg {
    width: 20px;
    height: 20px;
    display: block;
  }
  .public-top-nav-brand-title {
    font-size: 18px;
    font-weight: 700;
    line-height: 18px;
    letter-spacing: -0.9px;
  }
  .public-top-nav-links {
    display: none;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    font-weight: 700;
    line-height: 19.5px;
    letter-spacing: 2.34px;
  }
  .public-top-nav-link {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 0;
    padding: 8px 16px;
    border-radius: 999px;
    background: transparent;
    color: rgb(115,115,115);
    font: inherit;
    letter-spacing: inherit;
    text-decoration: none;
    transition: color 180ms ease, background 180ms ease, box-shadow 180ms ease;
  }
  .public-top-nav-trigger {
    cursor: default;
  }
  .public-top-nav-link:hover {
    background: rgb(245,245,245);
    color: rgb(23,23,23);
  }
  .public-top-nav-link.is-active {
    background: rgb(255,241,242);
    color: rgb(225,29,72);
    box-shadow: inset 0 0 0 1px rgb(255,228,230), 0 1px 2px rgba(17,17,17,0.04);
  }
  .public-top-nav-badge {
    border-radius: 6px;
    background: rgb(244,63,94);
    padding: 4px 8px;
    font-size: 10px;
    font-weight: 900;
    line-height: 10px;
    letter-spacing: 1.8px;
    color: #ffffff;
  }
  .public-top-nav-item {
    position: relative;
    display: inline-flex;
  }
  .public-top-nav-submenu {
    position: absolute;
    left: 0;
    top: calc(100% + 8px);
    display: none;
    min-width: 260px;
    box-sizing: border-box;
    border: 1px solid rgb(229,229,229);
    border-radius: 8px;
    background: rgba(255,255,255,0.98);
    padding: 8px;
    box-shadow: 0 18px 46px rgba(15,23,42,0.12);
  }
  .public-top-nav-submenu::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: -9px;
    height: 9px;
  }
  .public-top-nav-item:hover .public-top-nav-submenu,
  .public-top-nav-item:focus-within .public-top-nav-submenu {
    display: grid;
    gap: 4px;
  }
  .public-top-nav-submenu-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border-radius: 6px;
    padding: 9px 10px;
    color: rgb(64,64,64);
    text-decoration: none;
    letter-spacing: 0;
    line-height: 1.35;
  }
  .public-top-nav-submenu-link > span:first-child {
    white-space: nowrap;
  }
  .public-top-nav-submenu-link:hover {
    background: rgb(245,245,245);
    color: rgb(23,23,23);
  }
  .public-top-nav-submenu-badge {
    flex: 0 0 auto;
    border-radius: 5px;
    background: rgb(245,245,245);
    padding: 3px 5px;
    color: rgb(115,115,115);
    font-size: 10px;
    font-weight: 900;
    white-space: nowrap;
  }
  .public-top-nav-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .public-top-nav-login,
  .public-top-nav-apply {
    min-height: 44px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    font-size: 11px;
    font-weight: 900;
    line-height: 16.5px;
    letter-spacing: 1.76px;
    text-transform: uppercase;
    text-decoration: none;
    white-space: nowrap;
    transition: color 180ms ease, background 180ms ease, border-color 180ms ease;
  }
  .public-top-nav-login {
    gap: 8px;
    border: 1px solid rgb(229,229,229);
    background: #ffffff;
    color: rgb(64,64,64);
    padding: 10px 16px;
  }
  .public-top-nav-login:hover {
    border-color: rgb(23,23,23);
    color: rgb(23,23,23);
  }
  .public-top-nav-apply {
    gap: 8px;
    background: rgb(23,23,23);
    color: #ffffff;
    -webkit-text-fill-color: #ffffff;
    forced-color-adjust: none;
    color-scheme: light;
    padding: 10px 16px;
    box-shadow: 0 16px 34px rgba(17,17,17,0.20);
  }
  .public-top-nav-apply:hover {
    background: rgb(38,38,38);
  }
  .public-top-nav-apply svg {
    width: 14px;
    height: 14px;
    flex: 0 0 auto;
  }
  .public-top-nav-apply-short {
    display: none;
  }
  @media (min-width: 768px) {
    .public-top-nav-login,
    .public-top-nav-apply {
      font-size: 12px;
      line-height: 18px;
      letter-spacing: 1.92px;
    }
    .public-top-nav-apply {
      gap: 12px;
      padding-left: 20px;
      padding-right: 20px;
    }
  }
  @media (min-width: 1024px) {
    .public-top-nav-links {
      display: flex;
    }
  }
  @media (max-width: 639px) {
    .public-top-nav-apply {
      padding-left: 16px;
      padding-right: 16px;
    }
    .public-top-nav-apply-long {
      display: none;
    }
    .public-top-nav-apply-short {
      display: inline;
    }
  }
`;

export function renderPublicTopNav(active: PublicNavigationKind | null): string {
  return `
    <nav class="public-top-nav" data-public-top-nav="true">
      <div class="public-top-nav-inner">
        <div class="public-top-nav-start">
          <a class="public-top-nav-brand" href="/" data-client-nav="true">
            <span class="public-top-nav-brand-mark" aria-hidden="true">
              ${renderZapIcon()}
            </span>
            <span class="public-top-nav-brand-title">${escapeHtml(PUBLIC_SITE_BRAND_NAME)}</span>
          </a>
          <div class="public-top-nav-links">
            ${PUBLIC_NAVIGATION_ITEMS.map((item) => renderTopNavItem(item, active)).join('')}
          </div>
        </div>
        <div class="public-top-nav-actions">
          <a class="public-top-nav-login" href="/portal" target="_blank" rel="noreferrer">登录</a>
          <a class="public-top-nav-apply" href="/apply" target="_blank" rel="noreferrer">
            <span class="public-top-nav-apply-long">申请入驻测试</span>
            <span class="public-top-nav-apply-short">申请</span>
            ${renderExternalLinkIcon()}
          </a>
        </div>
      </div>
    </nav>
  `;
}

function renderTopNavItem(item: PublicNavigationItem, active: PublicNavigationKind | null): string {
  const classes = ['public-top-nav-link'];
  if (item.kind === active) {
    classes.push('is-active');
  }
  const label = `${escapeHtml(item.label)}${item.badge ? `<span class="public-top-nav-badge">${escapeHtml(item.badge)}</span>` : ''}`;
  const clientNavAttribute = item.kind === 'news' ? '' : ' data-client-nav="true"';
  const link = item.href
    ? `<a class="${classes.join(' ')}" href="${escapeAttribute(item.href)}"${item.children?.length ? ' aria-haspopup="true"' : ''}${clientNavAttribute}>${label}</a>`
    : `<button class="${classes.concat('public-top-nav-trigger').join(' ')}" type="button" aria-haspopup="true">${label}</button>`;
  if (!item.children || item.children.length === 0) {
    return link;
  }
  return `<span class="public-top-nav-item">${link}<span class="public-top-nav-submenu">${item.children.map((child) => `<a class="public-top-nav-submenu-link" href="${escapeAttribute(child.href)}" data-client-nav="true"><span>${escapeHtml(child.label)}</span>${child.badge ? `<span class="public-top-nav-submenu-badge">${escapeHtml(child.badge)}</span>` : ''}</a>`).join('')}</span></span>`;
}

function renderZapIcon(): string {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2 6 13h5l-1 9 8-12h-5l0-8Z"></path>
    </svg>
  `;
}

function renderExternalLinkIcon(): string {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 3h6v6"></path>
      <path d="M10 14 21 3"></path>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    </svg>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

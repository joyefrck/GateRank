import { PUBLIC_SITE_BRAND_NAME } from './publicBrand';
import { PUBLIC_NAVIGATION_ITEMS, type PublicNavigationKind, type PublicNavigationItem } from './publicNavigation';

export const PUBLIC_TOP_NAV_HEIGHT_PX = 64;
export const PUBLIC_TOP_NAV_BORDER_PX = 1;
export const PUBLIC_TOP_NAV_STICKY_OFFSET_PX = PUBLIC_TOP_NAV_HEIGHT_PX + PUBLIC_TOP_NAV_BORDER_PX;

export const PUBLIC_TOP_NAV_STYLES = `
  html:has(.public-top-nav-mobile[open]) {
    overflow: hidden;
  }
  .public-top-nav-root {
    position: sticky;
    top: 0;
    z-index: 40;
  }
  .public-top-nav-root > .public-top-nav {
    position: relative;
    top: auto;
    z-index: auto;
  }
  .public-top-nav {
    position: sticky;
    top: 0;
    z-index: 40;
    background: rgba(255,255,255,0.95);
    backdrop-filter: blur(12px);
    border-bottom: ${PUBLIC_TOP_NAV_BORDER_PX}px solid rgb(245,245,245);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
  }
  .public-top-nav-inner {
    width: min(1280px, 100%);
    height: ${PUBLIC_TOP_NAV_HEIGHT_PX}px;
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
    gap: 22px;
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
    border-radius: 12px;
    background: rgb(0,0,0);
    color: #ffffff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  }
  .public-top-nav-brand-mark svg {
    width: 20px;
    height: 20px;
    display: block;
  }
  .public-top-nav-brand-title {
    font-size: 19px;
    font-weight: 700;
    line-height: 20px;
    letter-spacing: -0.45px;
    white-space: nowrap;
  }
  .public-top-nav-links {
    display: none;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    letter-spacing: 0;
  }
  .public-top-nav-link {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    padding: 6px 16px;
    border-radius: 999px;
    background: transparent;
    color: rgb(115,115,115);
    font: inherit;
    letter-spacing: inherit;
    text-decoration: none;
    white-space: nowrap;
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
    color: rgb(244,63,94);
    box-shadow: inset 0 0 0 1px rgba(254,205,211,0.6), 0 1px 2px rgba(17,17,17,0.04);
  }
  .public-top-nav-badge {
    border-radius: 4px;
    background: rgb(244,63,94);
    padding: 4px 5px;
    font-size: 10px;
    font-weight: 700;
    line-height: 10px;
    letter-spacing: 0.8px;
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
    gap: 12px;
  }
  .public-top-nav-mobile {
    position: relative;
  }
  .public-top-nav-mobile > summary {
    width: 44px;
    height: 44px;
    border: 1px solid rgb(229,229,229);
    border-radius: 10px;
    background: #ffffff;
    color: rgb(38,38,38);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    list-style: none;
  }
  .public-top-nav-mobile > summary::-webkit-details-marker {
    display: none;
  }
  .public-top-nav-mobile > summary:hover,
  .public-top-nav-mobile > summary:focus-visible {
    border-color: rgb(163,163,163);
    outline: none;
  }
  .public-top-nav-mobile-menu-icon,
  .public-top-nav-mobile-close-icon {
    width: 20px;
    height: 20px;
  }
  .public-top-nav-mobile-close-icon {
    display: none;
  }
  .public-top-nav-mobile[open] .public-top-nav-mobile-menu-icon {
    display: none;
  }
  .public-top-nav-mobile[open] .public-top-nav-mobile-close-icon {
    display: block;
  }
  .public-top-nav-mobile-panel {
    position: fixed;
    left: 12px;
    right: 12px;
    top: 78px;
    max-height: calc(100dvh - 94px);
    overflow-y: auto;
    border: 1px solid rgb(229,229,229);
    border-radius: 18px;
    background: rgba(255,255,255,0.98);
    padding: 10px;
    box-shadow: 0 24px 64px rgba(15,23,42,0.18);
  }
  .public-top-nav-mobile-list {
    display: grid;
    gap: 4px;
  }
  .public-top-nav-mobile-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 44px;
    border-radius: 10px;
    padding: 10px 12px;
    color: rgb(64,64,64);
    font-size: 14px;
    font-weight: 800;
    text-decoration: none;
  }
  .public-top-nav-mobile-link:hover,
  .public-top-nav-mobile-link:focus-visible,
  .public-top-nav-mobile-link.is-active {
    background: rgb(255,241,242);
    color: rgb(225,29,72);
    outline: none;
  }
  .public-top-nav-mobile-group {
    border-top: 1px solid rgb(245,245,245);
    padding-top: 4px;
  }
  .public-top-nav-mobile-child {
    min-height: 40px;
    padding-left: 28px;
    color: rgb(82,82,82);
    font-size: 12px;
  }
  .public-top-nav-mobile-apply {
    margin-top: 8px;
    background: rgb(23,23,23);
    color: #ffffff;
  }
  .public-top-nav-login,
  .public-top-nav-apply {
    min-height: 38px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    letter-spacing: 0;
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
    transform-origin: center;
    transition: color 180ms ease, background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
  }
  .public-top-nav-login {
    gap: 6px;
    border: 1px solid rgb(243,244,246);
    background: rgba(249,250,251,0.5);
    color: rgb(64,64,64);
    padding: 10px 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .public-top-nav-login:hover {
    border-color: rgb(229,231,235);
    background: rgb(243,244,246);
    color: rgb(0,0,0);
    transform: scale(1.02);
  }
  .public-top-nav-apply {
    gap: 6px;
    background: rgb(0,0,0);
    color: #ffffff;
    -webkit-text-fill-color: #ffffff;
    forced-color-adjust: none;
    color-scheme: light;
    padding: 10px 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  }
  .public-top-nav-apply:hover {
    background: rgb(38,38,38);
    transform: translateY(-0.5px) scale(1.02);
    box-shadow: 0 4px 10px rgba(0,0,0,0.16);
  }
  .public-top-nav-login:active,
  .public-top-nav-apply:active {
    transform: scale(0.98);
  }
  .public-top-nav-login:focus-visible,
  .public-top-nav-apply:focus-visible {
    outline: 2px solid rgb(23,23,23);
    outline-offset: 2px;
  }
  .public-top-nav-apply svg {
    width: 14px;
    height: 14px;
    flex: 0 0 auto;
  }
  .public-top-nav-apply-short {
    display: none;
  }
  @media (min-width: 640px) {
    .public-top-nav-inner {
      padding-left: 24px;
      padding-right: 24px;
    }
  }
  @media (min-width: 1024px) {
    .public-top-nav-inner {
      padding-left: 32px;
      padding-right: 32px;
    }
  }
  @media (min-width: 1240px) {
    .public-top-nav-apply {
      padding-left: 16px;
      padding-right: 16px;
    }
    .public-top-nav-links {
      display: flex;
    }
    .public-top-nav-mobile {
      display: none;
    }
  }
  @media (max-width: 639px) {
    .public-top-nav-inner {
      height: ${PUBLIC_TOP_NAV_HEIGHT_PX}px;
      padding-left: 12px;
      padding-right: 12px;
    }
    .public-top-nav-brand {
      gap: 8px;
    }
    .public-top-nav-brand-mark {
      width: 34px;
      height: 34px;
    }
    .public-top-nav-brand-title {
      width: 70px;
      white-space: normal;
      line-height: 18px;
    }
    .public-top-nav-login {
      min-height: 48px;
      padding: 8px 10px;
    }
    .public-top-nav-apply {
      display: inline-flex;
      width: 92px;
      min-height: 48px;
      justify-content: center;
      padding: 6px 10px;
      white-space: normal;
      text-align: center;
      line-height: 17px;
    }
    .public-top-nav-mobile {
      display: none;
    }
    .public-top-nav-mobile-panel {
      top: 70px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .public-top-nav-link,
    .public-top-nav-login,
    .public-top-nav-apply {
      transition: none;
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
          <a class="public-top-nav-login" href="/portal" data-client-nav="true">${renderLoginIcon()}登录</a>
          <a class="public-top-nav-apply" href="/apply" data-client-nav="true">
            <span class="public-top-nav-apply-long">申请入驻测试</span>
            <span class="public-top-nav-apply-short">申请</span>
            ${renderExternalLinkIcon()}
          </a>
          <details class="public-top-nav-mobile" data-public-mobile-drawer="true">
            <summary aria-label="打开主导航" aria-haspopup="true">
              <span class="public-top-nav-mobile-menu-icon" aria-hidden="true">${renderMenuIcon()}</span>
              <span class="public-top-nav-mobile-close-icon" aria-hidden="true">${renderCloseIcon()}</span>
            </summary>
            <div class="public-top-nav-mobile-panel">
              <div class="public-top-nav-mobile-list">
                ${PUBLIC_NAVIGATION_ITEMS.map((item) => renderMobileNavItem(item, active)).join('')}
                <a class="public-top-nav-mobile-link public-top-nav-mobile-apply" href="/apply" data-client-nav="true">申请入驻测试 ${renderExternalLinkIcon()}</a>
              </div>
            </div>
          </details>
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

function renderMobileNavItem(item: PublicNavigationItem, active: PublicNavigationKind | null): string {
  const activeClass = item.kind === active ? ' is-active' : '';
  const clientNavAttribute = item.kind === 'news' ? '' : ' data-client-nav="true"';
  const mainLink = item.href
    ? `<a class="public-top-nav-mobile-link${activeClass}" href="${escapeAttribute(item.href)}"${clientNavAttribute}><span>${escapeHtml(item.label)}</span>${item.badge ? `<span class="public-top-nav-badge">${escapeHtml(item.badge)}</span>` : ''}</a>`
    : `<span class="public-top-nav-mobile-link"><span>${escapeHtml(item.label)}</span>${item.badge ? `<span class="public-top-nav-badge">${escapeHtml(item.badge)}</span>` : ''}</span>`;
  if (!item.children?.length) {
    return mainLink;
  }
  return `<div class="public-top-nav-mobile-group">${mainLink}${item.children.map((child) => `<a class="public-top-nav-mobile-link public-top-nav-mobile-child" href="${escapeAttribute(child.href)}" data-client-nav="true"><span>${escapeHtml(child.label)}</span>${child.badge ? `<span class="public-top-nav-submenu-badge">${escapeHtml(child.badge)}</span>` : ''}</a>`).join('')}</div>`;
}

function renderZapIcon(): string {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"></path>
    </svg>
  `;
}

function renderLoginIcon(): string {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
      <path d="m10 17 5-5-5-5"></path>
      <path d="M15 12H3"></path>
    </svg>
  `;
}

function renderMenuIcon(): string {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M4 7h16"></path>
      <path d="M4 12h16"></path>
      <path d="M4 17h16"></path>
    </svg>
  `;
}

function renderCloseIcon(): string {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="m6 6 12 12"></path>
      <path d="m18 6-12 12"></path>
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

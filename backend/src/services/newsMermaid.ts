import { frontendAssetDirectory } from '../../../shared/frontendAssetPaths';

export const NEWS_MERMAID_MODULE_PATH = `/${frontendAssetDirectory(process.env.PUBLIC_FRONTEND_ASSET_VERSION)}/news-mermaid.js`;

export function hasNewsMermaidDiagram(html: string): boolean {
  return /<code\b[^>]*\bdata-language=(?:"mermaid"|'mermaid')[^>]*>/i.test(html);
}

export function renderNewsMermaidModuleScript(html: string): string {
  return hasNewsMermaidDiagram(html)
    ? `<script type="module" src="${NEWS_MERMAID_MODULE_PATH}"></script>`
    : '';
}

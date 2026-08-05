# News Mermaid Flowchart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Mermaid fenced code as an accessible GateRank news flowchart with an enlarged dialog view and resilient source fallback.

**Architecture:** Keep the sanitized Mermaid source in the SSR code block, add a small backend helper that conditionally emits a self-hosted module entry, and let a dedicated browser enhancer replace only valid Mermaid blocks with SVG. Styling remains in the existing SSR news stylesheet so formal and preview article pages share the same result.

**Tech Stack:** TypeScript, Vite multi-entry build, Mermaid, Marked, sanitize-html, Node test runner, browser DOM APIs.

---

## File map

- Create `backend/src/services/newsMermaid.ts`: detect Mermaid code blocks and emit the conditional module tag.
- Create `backend/tests/newsMermaid.test.ts`: cover exact language matching and conditional asset loading.
- Create `src/news/mermaidEnhancer.ts`: render SVG, retain failure fallback, and manage the enlarged dialog.
- Modify `backend/src/services/newsPageRenderer.ts`: add flowchart/dialog styles and include the conditional module tag.
- Modify `vite.config.ts`: add the stable `news-mermaid` build entry.
- Modify `package.json` and `package-lock.json`: add the pinned Mermaid runtime dependency.

### Task 1: Conditional news Mermaid asset

**Files:**
- Create: `backend/src/services/newsMermaid.ts`
- Test: `backend/tests/newsMermaid.test.ts`

- [ ] **Step 1: Write failing helper tests**

```ts
test('detects only Mermaid language code blocks', () => {
  assert.equal(hasNewsMermaidDiagram('<code class="news-code" data-language="mermaid">flowchart TD</code>'), true);
  assert.equal(hasNewsMermaidDiagram('<code class="news-code" data-language="typescript">const x = 1</code>'), false);
});

test('emits the self-hosted module only for Mermaid articles', () => {
  assert.match(renderNewsMermaidModuleScript('<code data-language="mermaid">x</code>'), /\/assets\/news-mermaid\.js/);
  assert.equal(renderNewsMermaidModuleScript('<p>ordinary article</p>'), '');
});
```

- [ ] **Step 2: Run the test and confirm the missing-module failure**

Run: `npx tsx --test backend/tests/newsMermaid.test.ts`

Expected: FAIL because `backend/src/services/newsMermaid.ts` does not exist.

- [ ] **Step 3: Implement exact detection and conditional output**

```ts
export const NEWS_MERMAID_MODULE_PATH = '/assets/news-mermaid.js';

export function hasNewsMermaidDiagram(html: string): boolean {
  return /<code\b[^>]*\bdata-language=(?:"mermaid"|'mermaid')[^>]*>/i.test(html);
}

export function renderNewsMermaidModuleScript(html: string): string {
  return hasNewsMermaidDiagram(html)
    ? `<script type="module" src="${NEWS_MERMAID_MODULE_PATH}"></script>`
    : '';
}
```

- [ ] **Step 4: Run the focused helper test**

Run: `npx tsx --test backend/tests/newsMermaid.test.ts`

Expected: 2 tests pass.

### Task 2: Self-hosted browser enhancer

**Files:**
- Create: `src/news/mermaidEnhancer.ts`
- Modify: `vite.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Add the Mermaid dependency and stable Vite entry**

Run: `npm install mermaid@11.16.1`

Add the following Vite input while preserving the existing main entry:

```ts
input: {
  index: path.resolve(__dirname, 'index.html'),
  'news-mermaid': path.resolve(__dirname, 'src/news/mermaidEnhancer.ts'),
},
```

- [ ] **Step 2: Implement strict rendering and per-diagram fallback**

```ts
import mermaid from 'mermaid';

const selector = '.news-body pre.news-code-block > code.news-code[data-language="mermaid"]';

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'base',
  themeVariables: {
    fontFamily: 'Inter, PingFang SC, Microsoft YaHei, sans-serif',
    primaryColor: '#ffffff',
    primaryTextColor: '#111111',
    primaryBorderColor: '#cbd5e1',
    lineColor: '#c93a2e',
  },
});

async function enhanceNewsMermaidDiagrams(): Promise<void> {
  const blocks = Array.from(document.querySelectorAll<HTMLElement>(selector));
  for (const [index, code] of blocks.entries()) {
    const source = code.textContent?.trim() || '';
    const fallback = code.parentElement;
    if (!source || !fallback) continue;
    try {
      const { svg } = await mermaid.render(`news-mermaid-${Date.now()}-${index}`, source);
      const card = document.createElement('figure');
      card.className = 'news-mermaid-card';
      const viewport = document.createElement('div');
      viewport.className = 'news-mermaid-viewport';
      viewport.innerHTML = svg;
      const renderedSvg = viewport.querySelector('svg');
      renderedSvg?.setAttribute('role', 'img');
      renderedSvg?.setAttribute('aria-label', '流程图');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'news-mermaid-expand';
      button.textContent = '放大查看';
      button.addEventListener('click', () => openMermaidDialog(renderedSvg, button));
      card.append(buildMermaidHeader(button), viewport, buildMermaidCaption());
      fallback.replaceWith(card);
    } catch {
      const message = document.createElement('p');
      message.className = 'news-mermaid-error';
      message.textContent = '流程图暂时无法渲染，已保留源码。';
      fallback.after(message);
    }
  }
}

void enhanceNewsMermaidDiagrams();
```

Add these helpers above `enhanceNewsMermaidDiagrams`:

```ts
let dialog: HTMLDialogElement | null = null;
let dialogContent: HTMLElement | null = null;
let dialogTrigger: HTMLButtonElement | null = null;
let previousBodyOverflow = '';

function buildMermaidHeader(button: HTMLButtonElement): HTMLElement {
  const header = document.createElement('div');
  header.className = 'news-mermaid-header';
  const label = document.createElement('span');
  label.className = 'news-mermaid-label';
  label.textContent = '流程图';
  header.append(label, button);
  return header;
}

function buildMermaidCaption(): HTMLElement {
  const caption = document.createElement('figcaption');
  caption.className = 'news-mermaid-caption';
  caption.textContent = '流程图 · 可点击放大查看';
  return caption;
}

function ensureMermaidDialog(): HTMLDialogElement {
  if (dialog && dialogContent) return dialog;
  dialog = document.createElement('dialog');
  dialog.className = 'news-mermaid-modal';
  dialog.setAttribute('aria-labelledby', 'news-mermaid-modal-title');
  const panel = document.createElement('div');
  panel.className = 'news-mermaid-modal-panel';
  const header = document.createElement('div');
  header.className = 'news-mermaid-modal-header';
  const title = document.createElement('h2');
  title.id = 'news-mermaid-modal-title';
  title.textContent = '流程图放大查看';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'news-mermaid-modal-close';
  close.textContent = '关闭';
  close.addEventListener('click', () => dialog?.close());
  dialogContent = document.createElement('div');
  dialogContent.className = 'news-mermaid-modal-content';
  header.append(title, close);
  panel.append(header, dialogContent);
  dialog.append(panel);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    dialogContent?.replaceChildren();
    document.body.style.overflow = previousBodyOverflow;
    dialogTrigger?.focus();
    dialogTrigger = null;
  });
  document.body.append(dialog);
  return dialog;
}

function openMermaidDialog(svg: SVGElement | null, trigger: HTMLButtonElement): void {
  if (!svg) return;
  const modal = ensureMermaidDialog();
  dialogContent?.replaceChildren(svg.cloneNode(true));
  dialogTrigger = trigger;
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  modal.showModal();
  modal.querySelector<HTMLButtonElement>('.news-mermaid-modal-close')?.focus();
}
```

- [ ] **Step 3: Build and confirm the stable self-hosted entry**

Run: `npm run build && test -f dist/assets/news-mermaid.js`

Expected: build exits 0 and `dist/assets/news-mermaid.js` exists.

### Task 3: SSR styling and page wiring

**Files:**
- Modify: `backend/src/services/newsPageRenderer.ts`
- Modify: `backend/tests/newsMermaid.test.ts`

- [ ] **Step 1: Add a failing renderer integration assertion**

Render one article containing `<code data-language="mermaid">` and one ordinary article, then assert only the first HTML document contains `<script type="module" src="/assets/news-mermaid.js"></script>`.

- [ ] **Step 2: Wire the helper into the shared article renderer**

```ts
import { renderNewsMermaidModuleScript } from './newsMermaid';

// At the end of the article body, after the existing inline behavior script:
${renderNewsMermaidModuleScript(articleBodyHtml)}
```

- [ ] **Step 3: Add GateRank flowchart and dialog styles**

Add focused selectors for `.news-mermaid-card`, `.news-mermaid-header`, `.news-mermaid-expand`, `.news-mermaid-viewport`, `.news-mermaid-modal`, `.news-mermaid-modal-panel`, `.news-mermaid-modal-close`, and `.news-mermaid-error`. Use the existing white surface, near-black action, 24px radius, visible focus ring, a 40px minimum control height, horizontal overflow on narrow screens, and `::backdrop` for the modal.

- [ ] **Step 4: Run helper and news route tests**

Run: `npx tsx --test backend/tests/newsMermaid.test.ts backend/tests/newsPublicRoutes.test.ts`

Expected: all selected tests pass.

### Task 4: Full verification and browser acceptance

**Files:**
- Modify only if verification exposes a defect in the scoped implementation.

- [ ] **Step 1: Run static checks and focused tests separately**

Run:

```bash
npm run lint
npm run server:typecheck
npx tsx --test backend/tests/newsContentService.test.ts backend/tests/newsMermaid.test.ts backend/tests/newsPublicRoutes.test.ts
```

Expected: each command exits 0; test output reports the exact passing count.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: exit 0, stable Mermaid entry present, and no unintended generated source changes.

- [ ] **Step 3: Start or reuse local services without duplicates**

Inspect ports 3000 and 8787 first. Start only missing services, confirm `/healthz` returns 200, and open the target article through the local Vite proxy.

- [ ] **Step 4: Verify desktop behavior in Chrome**

Confirm the target article contains a rendered SVG, the black Mermaid source block is absent in the success state, “放大查看” opens the dialog, background/close button/`Escape` close it, and browser logs contain no Mermaid errors.

- [ ] **Step 5: Verify mobile behavior in Chrome**

Use a narrow viewport, confirm the chart remains readable with horizontal overflow when needed, controls remain at least 40px, and the enlarged dialog fits the viewport.

- [ ] **Step 6: Commit the implementation**

```bash
git add package.json package-lock.json vite.config.ts src/news/mermaidEnhancer.ts backend/src/services/newsMermaid.ts backend/src/services/newsPageRenderer.ts backend/tests/newsMermaid.test.ts docs/superpowers/plans/2026-08-05-news-mermaid-flowchart.md
git commit -m "feat: render Mermaid diagrams in news articles"
```

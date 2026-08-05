import mermaid from 'mermaid';

const MERMAID_SELECTOR = '.news-body pre.news-code-block > code.news-code[data-language="mermaid"]';

let dialog: HTMLDialogElement | null = null;
let dialogContent: HTMLElement | null = null;
let dialogTrigger: HTMLButtonElement | null = null;
let previousBodyOverflow = '';

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'base',
  themeVariables: {
    fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
    primaryColor: '#ffffff',
    primaryTextColor: '#111111',
    primaryBorderColor: '#cbd5e1',
    lineColor: '#c93a2e',
    secondaryColor: '#f8fafc',
    tertiaryColor: '#fff7f5',
  },
});

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
  if (dialog && dialogContent) {
    return dialog;
  }

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

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'news-mermaid-modal-close';
  closeButton.textContent = '关闭';
  closeButton.addEventListener('click', () => dialog?.close());

  dialogContent = document.createElement('div');
  dialogContent.className = 'news-mermaid-modal-content';

  header.append(title, closeButton);
  panel.append(header, dialogContent);
  dialog.append(panel);

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
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

function openMermaidDialog(svg: SVGElement, trigger: HTMLButtonElement): void {
  const modal = ensureMermaidDialog();
  dialogContent?.replaceChildren(svg.cloneNode(true));
  dialogTrigger = trigger;
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  modal.showModal();
  if (dialogContent) {
    centerScrollableDiagram(dialogContent);
  }
  modal.querySelector<HTMLButtonElement>('.news-mermaid-modal-close')?.focus();
}

function centerScrollableDiagram(container: HTMLElement): void {
  window.requestAnimationFrame(() => {
    container.scrollLeft = Math.max(0, (container.scrollWidth - container.clientWidth) / 2);
  });
}

function showMermaidError(fallback: HTMLElement): void {
  const message = document.createElement('p');
  message.className = 'news-mermaid-error';
  message.textContent = '流程图暂时无法渲染，已保留源码。';
  fallback.after(message);
}

async function enhanceNewsMermaidDiagrams(): Promise<void> {
  const blocks = Array.from(document.querySelectorAll<HTMLElement>(MERMAID_SELECTOR));

  for (const [index, code] of blocks.entries()) {
    const source = code.textContent?.trim() || '';
    const fallback = code.parentElement;
    if (!source || !fallback) {
      continue;
    }

    try {
      const { svg } = await mermaid.render(`news-mermaid-${Date.now()}-${index}`, source);
      const card = document.createElement('figure');
      card.className = 'news-mermaid-card';

      const viewport = document.createElement('div');
      viewport.className = 'news-mermaid-viewport';
      viewport.innerHTML = svg;

      const renderedSvg = viewport.querySelector<SVGSVGElement>('svg');
      if (!renderedSvg) {
        throw new Error('Mermaid did not return an SVG element');
      }
      renderedSvg.setAttribute('role', 'img');
      renderedSvg.setAttribute('aria-label', '流程图');
      renderedSvg.removeAttribute('height');

      const expandButton = document.createElement('button');
      expandButton.type = 'button';
      expandButton.className = 'news-mermaid-expand';
      expandButton.textContent = '放大查看';
      expandButton.setAttribute('aria-label', '放大查看流程图');
      expandButton.addEventListener('click', () => openMermaidDialog(renderedSvg, expandButton));

      card.append(buildMermaidHeader(expandButton), viewport, buildMermaidCaption());
      fallback.replaceWith(card);
      centerScrollableDiagram(viewport);
    } catch {
      showMermaidError(fallback);
    }
  }
}

void enhanceNewsMermaidDiagrams();

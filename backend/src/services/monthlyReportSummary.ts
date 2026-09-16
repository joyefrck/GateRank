import { marked, type Token, type Tokens } from 'marked';
import type { MonthlyReport, MonthlyReportListItem } from '../types/domain';

/** Read the published snapshot, never today's ranking or an invented zero. */
export function extractMonthlyReportSummary(report: MonthlyReportListItem, detail?: MonthlyReport) {
  const markdown = detail?.content_markdown.trim() || monthlyReportHtmlToMarkdown(detail?.content_html || '');
  const tokens = marked.lexer(markdown);
  const text = plainText(markdown);
  const sample = text.match(/样本(?:数|范围)[：:]\s*(\d+)/)
    || text.match(/(?:报告覆盖|基于[^。\n]*?的)\s*(\d+)\s*个已上架机场/)
    || text.match(/\|\s*已上架样本\s*\|\s*(\d+)\s*\|/);
  const top = text.match(/Top\s*3\s*机场[：:]\s*([^\n。；;]+)/i)
    || text.match(/本月综合表现最靠前的是\s*([^\n。；;]+)/);
  const ranking = section(tokens, /^(?:综合榜单变化|综合榜单|综合排名)$/);
  const topAirports = top
    ? top[1].split(/[、,，]/).map((name) => name.trim()).filter((name) => name && name !== '暂无样本').slice(0, 3)
    : airportNames(ranking).slice(0, 3);
  const summary = section(tokens, /^(?:执行摘要|本月摘要)$/)
    .filter((token) => token.type === 'paragraph')
    .map((token) => plainText(token.raw)).join('\n\n');
  const risk = section(tokens, /^风险(?:观察|与合规观察)$/);
  return {
    sample_size: sample ? Number(sample[1]) : null,
    top_airports: topAirports,
    summary: summary || detail?.excerpt || report.excerpt,
    risk_observations: observations(risk),
    new_airports: airportNames(section(tokens, /^(?:新入榜样本|新入榜机场|新增机场)$/)),
    abnormal_airports: airportNames(section(tokens, /^(?:异常观察样本|异常机场)$/)),
  };
}

function section(tokens: Token[], title: RegExp): Token[] {
  const start = tokens.findIndex((token) => token.type === 'heading'
    && title.test(plainText(token.text).replace(/^[一二三四五六七八九十\d]+[、.．]\s*/, '')));
  if (start < 0) return [];
  const heading = tokens[start] as Tokens.Heading;
  const end = tokens.findIndex((token, index) => index > start && token.type === 'heading' && token.depth <= heading.depth);
  return tokens.slice(start + 1, end < 0 ? undefined : end);
}

function airportNames(tokens: Token[]): string[] {
  return [...new Set(tokens.flatMap((token) => {
    if (token.type !== 'table') return [];
    const table = token as Tokens.Table;
    const index = table.header.findIndex((cell) => /^(?:机场|机场名称)$/.test(plainText(cell.text)));
    return index < 0 ? [] : table.rows.map((row) => plainText(row[index]?.text || '')).filter(Boolean);
  }))];
}

function observations(tokens: Token[]): string[] {
  return tokens.flatMap((token) => {
    if (token.type === 'paragraph') return [plainText(token.text)];
    if (token.type === 'list') return (token as Tokens.List).items.map((item) => plainText(item.text));
    if (token.type === 'table') {
      const table = token as Tokens.Table;
      return table.rows.map((row) => row.map((cell, index) => (
        `${plainText(table.header[index].text)}：${plainText(cell.text)}`
      )).join('；'));
    }
    return [];
  });
}

function plainText(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (entity, code: string) => {
      const point = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
      return point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    })
    .replace(/&amp;/g, '&')
    .trim();
}

/** Preserve headings and table cells for historical HTML-only reports. */
export function monthlyReportHtmlToMarkdown(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_table, body: string) => {
      const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => (
        [...row[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)]
          .map((cell) => plainText(cell[1]).replace(/\|/g, '\\|').replace(/\s+/g, ' '))
      ));
      if (!rows.length) return '';
      return `\n\n${[rows[0], rows[0].map(() => '---'), ...rows.slice(1)].map((row) => `| ${row.join(' | ')} |`).join('\n')}\n\n`;
    })
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_tag, level: string, body: string) => `\n\n${'#'.repeat(Number(level))} ${plainText(body)}\n\n`)
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_tag, body: string) => `\n- ${plainText(body)}\n`)
    .replace(/<\/(?:p|div|blockquote)>|<br\s*\/?\s*>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .trim();
}

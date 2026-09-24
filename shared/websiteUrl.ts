/** Normalize only website fields. Never use for subscription URLs or arbitrary links. */
export function normalizeWebsiteUrl(value: string): string {
  const input = value.trim();
  const invalid = () => new Error('官网地址无效，请填写 HTTP/HTTPS 域名或完整网址');
  if (!input || /[\s\\\u0000-\u001f\u007f]/u.test(input)) throw invalid();
  // A scheme-like prefix must be HTTP(S), except a bare host followed by a port.
  if (/^[a-z][a-z\d+.-]*:/i.test(input) && !/^https?:\/\//i.test(input)
    && !/^[^/:]+:\d+(?:[/?#]|$)/.test(input)) throw invalid();
  let url: URL;
  try {
    url = new URL(input.startsWith('//') ? `https:${input}` : /^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch { throw invalid(); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password
    || (!url.hostname.includes('.') && !url.hostname.startsWith('['))) throw invalid();
  return url.href;
}

export function normalizeWebsiteUrls(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean).map(normalizeWebsiteUrl))];
}

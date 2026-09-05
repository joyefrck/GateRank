export function insertSeoTopicImageMarkdown(input: {
  markdown: string;
  start: number;
  end: number;
  url: string;
  alt: string;
}): { markdown: string; cursor: number } {
  const start = Math.max(0, Math.min(input.start, input.markdown.length));
  const end = Math.max(start, Math.min(input.end, input.markdown.length));
  const before = input.markdown.slice(0, start);
  const after = input.markdown.slice(end);
  const leading =
    !before || before.endsWith("\n\n")
      ? ""
      : before.endsWith("\n")
        ? "\n"
        : "\n\n";
  const trailing =
    !after || after.startsWith("\n\n")
      ? ""
      : after.startsWith("\n")
        ? "\n"
        : "\n\n";
  const safeAlt = input.alt.replace(/[\]\\]/g, "").trim() || "专题正文图片";
  const inserted = `${leading}![${safeAlt}](${input.url})${trailing}`;
  return {
    markdown: `${before}${inserted}${after}`,
    cursor: before.length + inserted.length,
  };
}

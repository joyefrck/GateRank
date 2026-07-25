export const PUBLIC_SITE_BRAND_NAME = '机场榜GateRank';

export function withPublicBrandTitle(title: string): string {
  const normalizedTitle = title.trim();
  const titleWithoutTrailingBrand = normalizedTitle
    .replace(/\s*(?:\|\s*)?(?:机场榜\s*)?GateRank\s*$/i, '')
    .trim();

  return titleWithoutTrailingBrand
    ? `${titleWithoutTrailingBrand} | ${PUBLIC_SITE_BRAND_NAME}`
    : PUBLIC_SITE_BRAND_NAME;
}

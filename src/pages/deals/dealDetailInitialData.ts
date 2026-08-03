import type { AirportDealDetailView } from '../../../shared/airportAds';

interface DealDetailInitialDataEnvelope {
  kind?: string;
  params?: { slug?: string };
  payload?: AirportDealDetailView;
}

export function readDealDetailInitialData(
  slug: string,
  documentRef: Document | null = getBrowserDocument(),
): AirportDealDetailView | null {
  const element = documentRef?.getElementById('__GATERANK_INITIAL_DATA__');
  if (!element?.textContent) return null;
  try {
    const envelope = JSON.parse(element.textContent) as DealDetailInitialDataEnvelope;
    return envelope.kind === 'deal_detail'
      && envelope.params?.slug === slug
      && envelope.payload
      ? envelope.payload
      : null;
  } catch {
    return null;
  }
}

export function shouldFetchDealDetailData(initialData: AirportDealDetailView | null): boolean {
  return !initialData;
}

function getBrowserDocument(): Document | null {
  return typeof document === 'undefined' ? null : document;
}

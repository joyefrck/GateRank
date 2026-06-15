import type { AirportDealView } from '../../../shared/airportAds';

export interface DealsResponse {
  items: AirportDealView[];
  total: number;
}

interface DealsInitialDataEnvelope {
  kind?: string;
  payload?: DealsResponse;
}

export function readDealsInitialData(documentRef: Document | null = getBrowserDocument()): DealsResponse | null {
  const element = documentRef?.getElementById('__GATERANK_INITIAL_DATA__');
  if (!element?.textContent) {
    return null;
  }
  try {
    const envelope = JSON.parse(element.textContent) as DealsInitialDataEnvelope;
    return envelope.kind === 'deals' && envelope.payload ? envelope.payload : null;
  } catch {
    return null;
  }
}

export function shouldFetchDealsData(initialData: DealsResponse | null): boolean {
  return !initialData;
}

function getBrowserDocument(): Document | null {
  return typeof document === 'undefined' ? null : document;
}

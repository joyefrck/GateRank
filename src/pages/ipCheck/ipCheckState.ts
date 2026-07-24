import {
  IP_CHECK_TRANSLATIONS,
  type IpCheckErrorCode,
  type IpCheckLanguage,
} from '../../../shared/ipCheck';

export function shouldUseIpifyFallback(code: string, query: string | undefined): boolean {
  return code === 'IP_CHECK_CLIENT_IP_REQUIRED' && query === undefined;
}

export function resolveIpCheckErrorMessage(code: string, language: IpCheckLanguage): string {
  const errors = IP_CHECK_TRANSLATIONS[language].errors;
  const messages: Partial<Record<IpCheckErrorCode, string>> = {
    IP_CHECK_INVALID_QUERY: errors.invalid,
    IP_CHECK_CLIENT_IP_REQUIRED: errors.clientIpRequired,
    IP_CHECK_LOOKUP_FAILED: errors.lookupFailed,
    IP_CHECK_RATE_LIMITED: errors.rateLimited,
    IP_CHECK_UPSTREAM_ERROR: errors.upstream,
    IP_CHECK_NOT_CONFIGURED: errors.notConfigured,
    IP_CHECK_UPSTREAM_TIMEOUT: errors.timeout,
  };
  return messages[code as IpCheckErrorCode] || errors.network;
}

export function resolveVisibleQuery(manualQuery: string | undefined, resolvedIp: string): string {
  return manualQuery === undefined ? resolvedIp : manualQuery;
}

import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';

export class IpCheckTargetError extends Error {
  constructor() {
    super('IP_CHECK_INVALID_QUERY');
  }
}

export function normalizeIpCheckTarget(value: unknown): string {
  if (typeof value !== 'string') {
    throw new IpCheckTargetError();
  }
  const input = value.trim();
  if (!input || input.length > 253) {
    throw new IpCheckTargetError();
  }

  const ipVersion = isIP(input);
  if (ipVersion > 0) {
    if (!isPublicIpAddress(input)) {
      throw new IpCheckTargetError();
    }
    return input.toLowerCase();
  }

  if (input.includes('://') || /[/?#@\s]/.test(input) || hasPortSuffix(input)) {
    throw new IpCheckTargetError();
  }
  const ascii = domainToASCII(input).toLowerCase().replace(/\.$/, '');
  const labels = ascii.split('.');
  if (
    !ascii
    || ascii.length > 253
    || labels.length < 2
    || labels.some((label) => !isValidDomainLabel(label))
    || !isValidTopLevelDomain(labels.at(-1) || '')
    || ascii === 'localhost'
    || ascii.endsWith('.local')
  ) {
    throw new IpCheckTargetError();
  }
  return ascii;
}

export function isPublicIpAddress(value: string): boolean {
  const version = isIP(value);
  if (version === 4) {
    return isPublicIpv4(value);
  }
  if (version === 6) {
    return isPublicIpv6(value);
  }
  return false;
}

function isPublicIpv4(value: string): boolean {
  const [a, b, c] = value.split('.').map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function isPublicIpv6(value: string): boolean {
  const normalized = value.toLowerCase();
  if (normalized === '::' || normalized === '::1') return false;
  if (normalized.startsWith('::ffff:')) return false;
  const firstGroup = Number.parseInt(normalized.split(':')[0] || '0', 16);
  if (!Number.isFinite(firstGroup)) return false;
  if ((firstGroup & 0xfe00) === 0xfc00) return false;
  if ((firstGroup & 0xffc0) === 0xfe80) return false;
  if ((firstGroup & 0xff00) === 0xff00) return false;
  if (normalized.startsWith('2001:db8:') || normalized === '2001:db8::') return false;
  return true;
}

function isValidDomainLabel(label: string): boolean {
  return label.length >= 1
    && label.length <= 63
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label);
}

function isValidTopLevelDomain(label: string): boolean {
  return /^[a-z]{2,63}$/.test(label) || /^xn--[a-z0-9-]{2,59}$/.test(label);
}

function hasPortSuffix(value: string): boolean {
  return /^[^:]+:\d+$/.test(value);
}

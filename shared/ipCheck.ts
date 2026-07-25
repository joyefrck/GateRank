export type IpCheckLanguage = 'zh' | 'en';

export type IpCheckErrorCode =
  | 'IP_CHECK_INVALID_QUERY'
  | 'IP_CHECK_CLIENT_IP_REQUIRED'
  | 'IP_CHECK_LOOKUP_FAILED'
  | 'IP_CHECK_RATE_LIMITED'
  | 'IP_CHECK_UPSTREAM_ERROR'
  | 'IP_CHECK_NOT_CONFIGURED'
  | 'IP_CHECK_UPSTREAM_TIMEOUT';

export interface IpCheckRequest {
  query?: string;
}

export interface IpCheckResult {
  ip: string;
  country: string;
  country_code: string;
  region: string;
  region_name: string;
  city: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isp: string;
  organization: string;
  asn: string;
}

export interface IpCheckSuccessResponse {
  checked_at: string;
  result: IpCheckResult;
}

export interface IpCheckErrorResponse {
  code: IpCheckErrorCode;
  message: string;
  request_id: string;
}

export const IP_CHECK_TRANSLATIONS = {
  zh: {
    title: 'IP 地理位置查询',
    description: '快速查询 IP 地址或域名的地理位置、ISP 信息及详细数据',
    searchPlaceholder: '输入 IP 地址或域名',
    searchButton: '查询',
    searching: '查询中...',
    currentNetwork: '当前出口网络',
    ipAddress: 'IP 地址',
    country: '国家/地区',
    city: '城市',
    postalCode: '邮政编码',
    isp: 'ISP 服务商',
    timezone: '时区',
    details: '详细信息',
    longitude: '经度',
    latitude: '纬度',
    asn: 'ASN',
    organization: '组织',
    unknown: '未知',
    copy: '复制',
    copied: '已复制',
    loadingMap: '地图加载中...',
    mapUnavailable: '地图暂时无法加载，文本查询结果不受影响。',
    retry: '重试',
    dataSource: 'IP 数据由 ipwho.is 提供，地图由 OpenStreetMap 与 CARTO 提供。',
    privacy: 'GateRank 不持久保存查询历史；为节省免费额度，成功结果会在 API 进程内存中临时缓存最多 24 小时；ipwho.is 会根据其服务政策处理查询目标。',
    errors: {
      invalid: '请输入有效的公网 IPv4、IPv6 地址或域名。',
      clientIpRequired: '暂时无法从当前连接识别出口 IP，正在尝试浏览器检测。',
      lookupFailed: '无法解析该 IP 或域名，请检查后重试。',
      rateLimited: '查询过于频繁，请稍后再试。',
      upstream: 'IP 查询服务暂时不可用，请稍后重试。',
      notConfigured: 'IP 查询服务尚未完成配置。',
      timeout: 'IP 查询服务响应超时，请重试。',
      network: '网络连接失败，请检查网络后重试。',
    },
  },
  en: {
    title: 'IP Geolocation Lookup',
    description: 'Quickly look up IP or domain location, ISP, and network details',
    searchPlaceholder: 'Enter an IP address or domain',
    searchButton: 'Search',
    searching: 'Searching...',
    currentNetwork: 'Current network',
    ipAddress: 'IP address',
    country: 'Country/region',
    city: 'City',
    postalCode: 'Postal code',
    isp: 'ISP',
    timezone: 'Timezone',
    details: 'Details',
    longitude: 'Longitude',
    latitude: 'Latitude',
    asn: 'ASN',
    organization: 'Organization',
    unknown: 'Unknown',
    copy: 'Copy',
    copied: 'Copied',
    loadingMap: 'Loading map...',
    mapUnavailable: 'The map is temporarily unavailable. Text results are unaffected.',
    retry: 'Retry',
    dataSource: 'IP data is provided by ipwho.is. Map data is provided by OpenStreetMap and CARTO.',
    privacy: 'GateRank does not persist lookup history. To conserve the free quota, successful results are temporarily cached in API process memory for up to 24 hours. ipwho.is processes lookup targets under its own service policies.',
    errors: {
      invalid: 'Enter a valid public IPv4 address, IPv6 address, or domain.',
      clientIpRequired: 'The current public IP could not be detected from this connection. Trying browser detection.',
      lookupFailed: 'This IP or domain could not be resolved. Check it and try again.',
      rateLimited: 'Too many lookups. Please try again shortly.',
      upstream: 'The IP lookup service is temporarily unavailable.',
      notConfigured: 'The IP lookup service has not been configured.',
      timeout: 'The IP lookup service timed out. Please retry.',
      network: 'The network request failed. Check your connection and retry.',
    },
  },
} as const;

export type IpCheckTranslations = (typeof IP_CHECK_TRANSLATIONS)[IpCheckLanguage];

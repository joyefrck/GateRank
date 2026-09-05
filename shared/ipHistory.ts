export interface IpHistoryRow {
  name: string;
  resource: string;
  country: string | null;
  info: string | null;
  first_seen: string | null;
  last_seen: string | null;
  active: boolean | null;
}
export interface IpHistoryResult {
  asn: IpHistoryRow[];
  organizations: IpHistoryRow[];
  allocations: IpHistoryRow[];
  errors: string[];
  checked_at: string;
  cached: boolean;
}

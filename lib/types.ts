// Shared response shapes for the dashboard API.
//
// Web-analytics model (table `web_sessions`, one row = one session):
//   Total Sessions       -> sessions          = COUNT(*)
//   Session Duration     -> sessionDuration    = AVG(session_duration_s)
//   Avg Unique Pageviews -> uniquePageviews    = AVG(unique_pageviews)
//   Avg Time on Page     -> timeOnPage         = AVG(time_on_page_s)

export type MetricKey =
  | "sessions"
  | "sessionDuration"
  | "uniquePageviews"
  | "timeOnPage";

export type DimensionKey =
  | "device"
  | "channel"
  | "source"
  | "country"
  | "page"
  | "sourceMedium";

export interface SparklinePoint {
  month: string; // 'YYYY-MM'
  value: number;
}

export interface KpiBlock {
  current: number;
  prior: number;
  deltaPct: number;
  sparkline: SparklinePoint[];
}

export interface KpisResponse {
  sessions: KpiBlock;
  sessionDuration: KpiBlock;
  uniquePageviews: KpiBlock;
  timeOnPage: KpiBlock;
}

/** "Which devices bring the most sessions?" */
export interface DeviceBreakdownItem {
  device: string;
  count: number; // sessions
  sharePct: number;
  avgUniquePageviews: number;
  deltaPct: number;
}

/** "Which referral sites bring the most traffic?" */
export interface ReferrerBreakdownItem {
  source: string;
  medium: string;
  count: number; // sessions
}

/** "Where does the traffic come from?" — geo bubbles. */
export interface GeoItem {
  country: string;
  lat: number;
  lng: number;
  count: number;
}

/** "Which channels bring the most sessions?" */
export interface ChannelBreakdownItem {
  channel: string;
  count: number; // sessions
  avgUniquePageviews: number;
  sparkline: SparklinePoint[];
}

/** "What are the most visited pages?" */
export interface PageBreakdownItem {
  pageTitle: string;
  count: number; // sessions
  avgTimeOnPage: number;
  bounceRate: number; // 0..1
}

export interface TopPerformerItem {
  key: string;
  value: number;
  deltaPct: number;
  sparkline: SparklinePoint[];
}

export interface TopPerformersResponse {
  metric: MetricKey;
  dimension: DimensionKey;
  monthlyTrend: SparklinePoint[];
  top: TopPerformerItem[];
}

export interface FilterOptionsResponse {
  devices: string[];
  channels: string[];
  countries: string[];
  sources: string[];
  dateBounds: { min: string; max: string };
}

export interface HealthResponse {
  status: "ok";
  rows: number;
  range: { min: string; max: string };
}

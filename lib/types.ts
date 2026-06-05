// Shared response shapes for the dashboard API.
//
// Metric mapping (mockup web-analytics intent -> real social-engagement data):
//   Total Sessions        -> totalPosts        = COUNT(*)
//   Session Duration       -> avgEngagementRate = AVG(engagement_rate)
//   Avg Unique Pageviews   -> avgImpressions    = AVG(impressions)
//   Avg Time on Page       -> avgEngagements    = AVG(likes+shares+comments)

export type MetricKey =
  | "totalPosts"
  | "avgEngagementRate"
  | "avgImpressions"
  | "avgEngagements";

export type DimensionKey =
  | "platform"
  | "brand"
  | "product"
  | "channel"
  | "location";

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
  totalPosts: KpiBlock;
  avgEngagementRate: KpiBlock;
  avgImpressions: KpiBlock;
  avgEngagements: KpiBlock;
}

export interface PlatformBreakdownItem {
  platform: string;
  count: number;
  sharePct: number;
  deltaPct: number;
}

export interface BrandBreakdownItem {
  brand: string;
  count: number;
  impressions: number;
}

export interface GeoItem {
  location: string;
  lat: number;
  lng: number;
  count: number;
}

export interface ChannelBreakdownItem {
  channel: string; // campaign_phase
  count: number;
  avgImpressions: number;
  sparkline: SparklinePoint[];
}

export interface ProductBreakdownItem {
  product: string;
  count: number;
  avgEngagements: number;
  sharePct: number;
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
  platforms: string[];
  countries: string[];
  brands: string[];
  campaigns: string[];
  sentiments: string[];
  dateBounds: { min: string; max: string };
}

export interface HealthResponse {
  status: "ok";
  rows: number;
  range: { min: string; max: string };
}

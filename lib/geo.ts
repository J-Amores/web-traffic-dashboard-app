// Static lat/lng for every distinct `location` value present in the DB.
// Derived from `SELECT DISTINCT location` (33 values). Any location not in
// this map is omitted from the /api/geo response and logged once.

export const GEO_COORDS: Record<string, { lat: number; lng: number }> = {
  "Barcelona, Spain": { lat: 41.3874, lng: 2.1686 },
  "Beijing, China": { lat: 39.9042, lng: 116.4074 },
  "Berlin, Germany": { lat: 52.52, lng: 13.405 },
  "Cairo, Egypt": { lat: 30.0444, lng: 31.2357 },
  "Chicago, USA": { lat: 41.8781, lng: -87.6298 },
  "Delhi, India": { lat: 28.6139, lng: 77.209 },
  "Dubai, UAE": { lat: 25.2048, lng: 55.2708 },
  "Houston, USA": { lat: 29.7604, lng: -95.3698 },
  "Johannesburg, South Africa": { lat: -26.2041, lng: 28.0473 },
  "Lagos, Nigeria": { lat: 6.5244, lng: 3.3792 },
  "London, UK": { lat: 51.5074, lng: -0.1278 },
  "Los Angeles, USA": { lat: 34.0522, lng: -118.2437 },
  "Lyon, France": { lat: 45.764, lng: 4.8357 },
  "Madrid, Spain": { lat: 40.4168, lng: -3.7038 },
  "Manchester, UK": { lat: 53.4808, lng: -2.2426 },
  "Melbourne, Australia": { lat: -37.8136, lng: 144.9631 },
  "Mexico City, Mexico": { lat: 19.4326, lng: -99.1332 },
  "Milan, Italy": { lat: 45.4642, lng: 9.19 },
  "Mumbai, India": { lat: 19.076, lng: 72.8777 },
  "Munich, Germany": { lat: 48.1351, lng: 11.582 },
  "New York, USA": { lat: 40.7128, lng: -74.006 },
  "Osaka, Japan": { lat: 34.6937, lng: 135.5023 },
  "Paris, France": { lat: 48.8566, lng: 2.3522 },
  "Rio de Janeiro, Brazil": { lat: -22.9068, lng: -43.1729 },
  "Rome, Italy": { lat: 41.9028, lng: 12.4964 },
  "Seoul, South Korea": { lat: 37.5665, lng: 126.978 },
  "Shanghai, China": { lat: 31.2304, lng: 121.4737 },
  Singapore: { lat: 1.3521, lng: 103.8198 },
  "Sydney, Australia": { lat: -33.8688, lng: 151.2093 },
  "São Paulo, Brazil": { lat: -23.5505, lng: -46.6333 },
  "Tokyo, Japan": { lat: 35.6762, lng: 139.6503 },
  "Toronto, Canada": { lat: 43.6532, lng: -79.3832 },
  "Vancouver, Canada": { lat: 49.2827, lng: -123.1207 },
};

const warnedMissing = new Set<string>();

/** Look up coords; log once per unmapped location and return null. */
export function coordsFor(
  location: string
): { lat: number; lng: number } | null {
  const hit = GEO_COORDS[location];
  if (hit) return hit;
  if (!warnedMissing.has(location)) {
    warnedMissing.add(location);
    // eslint-disable-next-line no-console
    console.warn(`[geo] no coordinates mapped for location: "${location}"`);
  }
  return null;
}

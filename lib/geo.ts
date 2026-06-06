// Static lat/lng centroids for every distinct `country` value the seed emits
// (see scripts/generate-seed.mjs COUNTRIES). Any country not in this map is
// omitted from the /api/geo response and logged once.

export const COUNTRY_COORDS: Record<string, { lat: number; lng: number }> = {
  "United States": { lat: 39.8283, lng: -98.5795 },
  "United Kingdom": { lat: 54.0, lng: -2.0 },
  Germany: { lat: 51.1657, lng: 10.4515 },
  France: { lat: 46.2276, lng: 2.2137 },
  Italy: { lat: 41.8719, lng: 12.5674 },
  Spain: { lat: 40.4637, lng: -3.7492 },
  Japan: { lat: 36.2048, lng: 138.2529 },
  China: { lat: 35.8617, lng: 104.1954 },
  India: { lat: 20.5937, lng: 78.9629 },
  Brazil: { lat: -14.235, lng: -51.9253 },
  Mexico: { lat: 23.6345, lng: -102.5528 },
  Canada: { lat: 56.1304, lng: -106.3468 },
  Australia: { lat: -25.2744, lng: 133.7751 },
  "United Arab Emirates": { lat: 23.4241, lng: 53.8478 },
  Netherlands: { lat: 52.1326, lng: 5.2913 },
  "South Korea": { lat: 35.9078, lng: 127.7669 },
};

const warnedMissing = new Set<string>();

/** Look up coords; log once per unmapped country and return null. */
export function coordsFor(
  country: string
): { lat: number; lng: number } | null {
  const hit = COUNTRY_COORDS[country];
  if (hit) return hit;
  if (!warnedMissing.has(country)) {
    warnedMissing.add(country);
    // eslint-disable-next-line no-console
    console.warn(`[geo] no coordinates mapped for country: "${country}"`);
  }
  return null;
}

// Country metadata for the live-ops console.
//
// Bridges our /api/geo full country NAMEs to the ISO2 keys used by the
// dotted-map data + color palette ported from the Vercel-style template.
// Colors reuse the template's per-country palette (country-data.ts).

/** Full country name (as returned by /api/geo) -> ISO2 code. */
export const COUNTRY_ISO2: Record<string, string> = {
  "United States": "US",
  "United Kingdom": "GB",
  Germany: "DE",
  France: "FR",
  Italy: "IT",
  Spain: "ES",
  Japan: "JP",
  China: "CN",
  India: "IN",
  Brazil: "BR",
  Mexico: "MX",
  Canada: "CA",
  Australia: "AU",
  "United Arab Emirates": "AE",
  Netherlands: "NL",
  "South Korea": "KR",
};

/**
 * Per-ISO2 dot/bullet color, reused verbatim from the template palette.
 * Unknown codes fall back to a neutral gray.
 */
export const COUNTRY_COLORS: Record<string, string> = {
  US: "#1e40af",
  DE: "#FFCE00",
  GB: "#2563eb",
  IN: "#f59e0b",
  BR: "#FF0000",
  JP: "#dc143c",
  FR: "#1d4ed8",
  CA: "#b91c1c",
  AU: "#3b82f6",
  KR: "#3b82f6",
  NL: "#ea580c",
  CN: "#991b1b",
  MX: "#15803d",
  ES: "#b91c1c",
  IT: "#15803d",
  AE: "#f59e0b",
};

export function iso2For(country: string): string | undefined {
  return COUNTRY_ISO2[country];
}

export function colorForIso2(iso2: string): string {
  return COUNTRY_COLORS[iso2] ?? "#666666";
}

/**
 * Deterministic fallback colour for a party abbreviation.
 * Used when the real party colours from /api/partijen/kleuren are unavailable.
 */
export function partyColor(abbr: string): string {
  let h = 0;
  for (let i = 0; i < abbr.length; i++) h = (h * 31 + abbr.charCodeAt(i)) & 0xffff;
  return `hsl(${(h % 300) + 180}, 45%, 38%)`;
}

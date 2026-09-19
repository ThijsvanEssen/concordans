// Shared formatters and label maps used by the parlementair readers.

export const FASE_LABELS: Record<string, string> = {
  wetsvoorstel: 'Wetsvoorstel',
  mvt: 'MvT',
  advies_rvs: 'Advies RvS',
  nota: "Nota's",
  verslag: 'Verslag',
  amendementen: 'Amendementen',
  stemming: 'Stemming',
  afgehandeld: 'Afgehandeld',
  onbekend: '?',
};

export const KIND_SHORT: Record<string, string> = {
  wetsvoorstel: 'Wetsvoorstel',
  initiatiefwetsvoorstel: 'Initiatiefwet',
  begroting: 'Begroting',
  motie: 'Motie',
  overig: 'Overig',
};

export function formatDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatLongDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function seatTotal(rows: { aantal_zetels: number }[]) {
  return rows.reduce((s, r) => s + (r.aantal_zetels || 0), 0);
}

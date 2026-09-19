/** Compares two article number strings numerically, with letter suffix. */
export function compareArticleNumbers(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const re = /^(\d+)([a-z]*)$/i;
  const ma = (a ?? '').match(re);
  const mb = (b ?? '').match(re);
  if (ma && mb) {
    const na = parseInt(ma[1], 10);
    const nb = parseInt(mb[1], 10);
    if (na !== nb) return na - nb;
    return ma[2].localeCompare(mb[2]);
  }
  return (a ?? '').localeCompare(b ?? '');
}

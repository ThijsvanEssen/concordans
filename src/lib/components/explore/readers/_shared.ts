// Shared formatters and label maps used by the parliamentary readers.

export const FASE_LABELS: Record<string, string> = {
	wetsvoorstel: 'Wetsvoorstel',
	mvt: 'MvT',
	advies_rvs: 'Advies RvS',
	nota: "Nota's",
	verslag: 'Verslag',
	amendementen: 'Amendementen',
	stemming: 'Stemming',
	afgehandeld: 'Afgehandeld',
	onbekend: '?'
};

export const KIND_SHORT: Record<string, string> = {
	wetsvoorstel: 'Wetsvoorstel',
	initiatiefwetsvoorstel: 'Initiatiefwet',
	begroting: 'Begroting',
	motie: 'Motie',
	overig: 'Overig'
};

/** A node prop (untyped in the API schema) as text, or null when it is not a non-empty string. */
export const textProp = (value: unknown): string | null =>
	typeof value === 'string' && value ? value : null;

export function formatDate(d: string | null) {
	if (!d) return '';
	return new Date(d).toLocaleDateString('nl-NL', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
}

export function formatLongDate(d: string | null) {
	if (!d) return '';
	return new Date(d).toLocaleDateString('nl-NL', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}

export function seatTotal(rows: { aantal_zetels: number }[]) {
	return rows.reduce((s, r) => s + (r.aantal_zetels || 0), 0);
}

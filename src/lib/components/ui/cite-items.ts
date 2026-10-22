// The items of a Citeer menu, always in one order: kort, voluit, met datum, link.

export type CiteItem = { kind: 'kort' | 'voluit' | 'met datum' | 'link'; text: string };

type Forms = { kort?: string | null; voluit?: string | null; metDatum?: string | null };
/** A bron's citation record (citation-record.ts), or its parts. */
type RecordForms = { short: string; full: string; dated: string | null };

export function citeItems(given: Forms | RecordForms | null, link?: string | null): CiteItem[] {
	const forms: Forms | null =
		given && 'short' in given
			? { kort: given.short, voluit: given.full, metDatum: given.dated }
			: given;
	const items: CiteItem[] = [];
	if (forms?.kort) items.push({ kind: 'kort', text: forms.kort });
	if (forms?.voluit) items.push({ kind: 'voluit', text: forms.voluit });
	if (forms?.metDatum) items.push({ kind: 'met datum', text: forms.metDatum });
	if (link) items.push({ kind: 'link', text: link });
	return items;
}

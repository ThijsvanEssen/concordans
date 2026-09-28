// The items of a Citeer menu, always in one order: kort, voluit, met datum, link.

export type CiteItem = { kind: 'kort' | 'voluit' | 'met datum' | 'link'; text: string };

export function citeItems(
	forms: { kort?: string | null; voluit?: string | null; metDatum?: string | null } | null,
	link?: string | null
): CiteItem[] {
	const items: CiteItem[] = [];
	if (forms?.kort) items.push({ kind: 'kort', text: forms.kort });
	if (forms?.voluit) items.push({ kind: 'voluit', text: forms.voluit });
	if (forms?.metDatum) items.push({ kind: 'met datum', text: forms.metDatum });
	if (link) items.push({ kind: 'link', text: link });
	return items;
}

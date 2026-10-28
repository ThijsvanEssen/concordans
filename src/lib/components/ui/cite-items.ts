// The items of a Citeer menu, always in one order: kort, voluit, met datum, link.

export type CiteItem = {
	kind: 'kort' | 'voluit' | 'met datum' | 'link';
	/** What is copied. */
	text: string;
	/** What the menu shows where that differs: a link without the parameter that only opens the text. */
	shown?: string;
};

/**
 * The address as the menu shows it, without `lezen=1`. The copied link keeps it on purpose: it
 * opens the text, not the network (ArticleReader `readLink`); a reader sees only the address.
 */
const withoutLezen = (link: string) =>
	link
		.replace(/\?lezen=1(&|(?=#|$))/, (_, rest) => (rest ? '?' : ''))
		.replace(/&lezen=1(?=&|#|$)/, '');

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
	if (link) items.push({ kind: 'link', text: link, shown: withoutLezen(link) });
	return items;
}

/** What a copied form is called in the status line: the short citation, with the form after it
 *  where it is another than the short one; a link is the link to it. */
export function citedWhat(items: CiteItem[], item: CiteItem, name: string): string {
	const kort = items.find((i) => i.kind === 'kort')?.text ?? name;
	if (item.kind === 'kort') return kort;
	if (item.kind === 'link') return `link naar ${kort}`;
	return `${kort}, ${item.kind}`;
}

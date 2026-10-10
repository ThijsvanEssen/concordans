// What an opened row of Actueel shows, per kind (RijInhoud): the bron's content, or nothing,
// and then the row does not open: its title goes to the reader.
import type { FeedItem } from '$lib/components/actueel/feed';

export type MetInhoud = Pick<FeedItem, 'kind' | 'node' | 'summary' | 'vote'> &
	Partial<Pick<FeedItem, 'has_text' | 'dictum'>>;
export type Inhoud = 'dictum' | 'toelichting' | 'opening' | 'stemming' | 'samenvatting' | null;

const telt = (i: MetInhoud) => {
	const t = (i.vote?.tally ?? {}) as Record<string, number>;
	return (t['Voor'] ?? 0) + (t['Tegen'] ?? 0) > 0;
};

/**
 * What the row of an item shows when it opens; null: it has nothing beyond the row. A paper
 * whose text is not in the data yet (`has_text: false`, its text follows its PDF by days)
 * does not open, unless the feed gives a motion's dictum; `has_text` null (another kind, or
 * not filled yet) opens as before.
 */
export function inhoudVan(i: MetInhoud): Inhoud {
	const zonderTekst = i.has_text === false;
	switch (i.kind) {
		case 'Motie':
			return i.dictum?.trim() || !zonderTekst ? 'dictum' : null;
		case 'Amendement':
			return zonderTekst ? null : 'toelichting';
		case 'Voorstel van wet':
		case 'Nota van wijziging':
		case 'Brief regering':
			return zonderTekst ? null : 'opening';
		case 'stemming':
			return telt(i) ? 'stemming' : null;
		case 'uitspraak':
		case 'publicatie':
		case 'inwerkingtreding':
			return i.summary?.trim() ? 'samenvatting' : null;
		// A toezegging is its text, and that is the row's title.
		default:
			return null;
	}
}

/** About six lines of a stuk: from its first paragraph of running text (past the letterhead),
 * to the end of a sentence. */
export function openingVan(tekst: string | null | undefined, lengte = 600): string | null {
	const regels = (tekst ?? '')
		.split('\n')
		.map((r) => r.replace(/\s+/g, ' ').trim())
		.filter(Boolean);
	const begin = regels.findIndex((r) => r.length >= 80 && /[a-z]/.test(r));
	if (begin < 0) return null;
	const lopend = regels.slice(begin).join(' ');
	if (lopend.length <= lengte) return lopend;
	const stuk = lopend.slice(0, lengte);
	const punt = stuk.lastIndexOf('. ');
	return punt > lengte / 2 ? stuk.slice(0, punt + 1) : `${stuk.trimEnd()}…`;
}

/** The toelichting of an amendement: its section by that name, else what follows the word. */
export function toelichtingVan(
	tekst: string | null | undefined,
	secties: readonly { heading: string; char_start: number; char_end: number }[]
): string | null {
	const t = tekst ?? '';
	const s = secties.find((x) => /^toelichting\b/i.test(x.heading.trim()));
	const deel = s
		? t.slice(s.char_start, s.char_end)
		: (/\n\s*Toelichting\s*\n([\s\S]*)/i.exec(t)?.[1] ?? '');
	const zonderKop = deel.replace(/^\s*Toelichting\s*/i, '');
	return openingVan(zonderKop) ?? (zonderKop.trim() || null);
}

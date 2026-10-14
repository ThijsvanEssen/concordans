// What an opened row shows, per kind (RijInhoud): the bron's content, or nothing, and then
// the row does not open: its title goes to the reader. Actueel and Gevolgd by the feed's kind;
// a Kamerstuk in Verbonden, Bronnen and Gemarkeerd by its own (kernSoort): one core text for
// one stuk wherever its row opens.
import { hasVotes } from '$lib/components/parliamentary/stemming';
import type { FeedItem } from '$lib/components/actueel/feed';
import { dictumUit } from '$lib/onderwerpen/strekking';

export type MetInhoud = { node: { collection: string; key: string } } & Partial<
	Pick<
		FeedItem,
		'kind' | 'summary' | 'vote' | 'has_text' | 'dictum' | 'date' | 'publication' | 'commencement'
	>
> & {
		/** Of an amendement, the opening of its toelichting as the API gives it (API 0.79.55). */
		explanation?: string | null;
	};
/** `kern`: a stuk's core text by its own kind (kernSoort), where the row does not know it. */
export type Inhoud =
	| 'dictum'
	| 'toelichting'
	| 'opening'
	| 'kern'
	| 'stemming'
	| 'samenvatting'
	| 'wijzigingen'
	| 'inwerkingtreding'
	| null;

const telt = (i: MetInhoud) => hasVotes(i.vote?.tally);

/**
 * The core text a list already gives, without a request: a motie's dictum, an amendement's
 * explanation (`kern`: whichever the stuk has).
 */
export function kernUitLijst(
	soort: Inhoud,
	i: Pick<MetInhoud, 'dictum' | 'explanation'>
): { tekst: string; als: 'dictum' | 'toelichting' } | null {
	const dictum = i.dictum?.trim();
	const uitleg = i.explanation?.trim();
	if (dictum && (soort === 'dictum' || soort === 'kern')) return { tekst: dictum, als: 'dictum' };
	if (uitleg && (soort === 'toelichting' || soort === 'kern'))
		return { tekst: uitleg, als: 'toelichting' };
	return null;
}

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
			return i.summary?.trim() ? 'samenvatting' : null;
		// A publication its changes per law, asked when the row opens (wijzigingen.ts): what the
		// feed's row cannot say. An inwerkingtreding the publication that brought it, where the
		// row does not name it already (`commencement.publication`, API 0.79.55).
		case 'publicatie':
			return 'wijzigingen';
		case 'inwerkingtreding':
			return i.commencement?.instrument && !i.commencement.publication ? 'inwerkingtreding' : null;
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

/** What a stuk opens on by its own kind (`Motie (gewijzigd/nader)`, `Amendement`, `Brief
 *  regering`): a motie its dictum, an amendement its toelichting, another its opening. */
export function kernSoort(kind: string | null | undefined): 'dictum' | 'toelichting' | 'opening' {
	const k = (kind ?? '').trim();
	if (/^motie\b/i.test(k)) return 'dictum';
	if (/^amendement\b/i.test(k)) return 'toelichting';
	return 'opening';
}

/** A stuk as its detail gives it, for its core text. */
export type Stuk = {
	text?: string | null;
	dictum?: string | null;
	explanation?: string | null;
	sections?: readonly { heading: string; char_start: number; char_end: number }[] | null;
};

/** The core text of a stuk: the API's dictum or explanation before the one read from the
 *  text, the toelichting of an amendement, the opening of another stuk. */
export function kernVan(soort: 'dictum' | 'toelichting' | 'opening', d: Stuk): string | null {
	if (soort === 'dictum') return d.dictum?.trim() || dictumUit(d.text ?? null);
	if (soort === 'toelichting')
		return d.explanation?.trim() || toelichtingVan(d.text, d.sections ?? []);
	return openingVan(d.text);
}

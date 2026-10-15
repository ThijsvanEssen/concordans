// An overweging read in place: the judgment's detail (asked once, shared with the reader and
// Verbonden) laid out as its reader lays it out, and the overweging an anchor names in it.
// Gemarkeerd opens a kept r.o. with it (MapInhoud), a reference to a judgment at an r.o.
// shows it in its card (OverwegingKaart): one way to read an r.o. without the judgment.
import { truncate } from '$lib/text/words';
import { getJudgmentDetail } from '$lib/api/judgments';
import type { Schema } from '$lib/api/types';
import {
	bodyItems,
	signatureStart,
	type BodyItem
} from '$lib/components/explore/readers/judgment-text';
import { overwegingVan } from '$lib/map/inhoud';
import { uitspraakNoten, type Noot } from '$lib/text/voetnoten';
import { paragraphAnchor, paragraphNumber } from '$lib/text/anchor';
import { keyEcli } from './address';
import { once } from '$lib/api/records';

export type Uitspraak = {
	j: Schema<'JudgmentDetailResponse'>['judgment'];
	/** The body up to the signature, as the reader lays it out. */
	items: BodyItem[];
	/** Its footnotes by their anchor (`fn-35`); the markers stand in `items`. */
	noten: Map<string, Noot>;
};

/** The body of a judgment as its reader lays it out: its overwegingen with their notes. */
export function legUit(j: Schema<'JudgmentDetailResponse'>['judgment']): Uitspraak {
	const paragraphs = j.paragraphs ?? [];
	const { noten, perAlinea } = uitspraakNoten(j.footnotes);
	return {
		j,
		items: bodyItems(paragraphs.slice(0, signatureStart(paragraphs)), perAlinea),
		noten
	};
}

/** The judgment of a key (`ecli_nl_hr_2019_2006`) or an ECLI, laid out once. */
export function laadUitspraak(keyOfEcli: string): Promise<Uitspraak> | null {
	const ecli = keyOfEcli.startsWith('ECLI:') ? keyOfEcli : keyEcli(keyOfEcli);
	if (!ecli) return null;
	return once(`judgments/${ecli}/gelegd`, () =>
		getJudgmentDetail(ecli).then(({ judgment: j }) => legUit(j))
	);
}

/** Whether an anchor names an overweging: `rov-5.1`. */
export const isOverwegingAnker = (at: string | null | undefined): at is string =>
	paragraphNumber(at) !== null;

/** Whether a reference is to a judgment at an overweging: its card is the overweging. */
export const isOverwegingRef = (ref: string | null, at: string | null | undefined) =>
	!!ref && ref.startsWith('judgments/') && isOverwegingAnker(at);

/** Whether the judgment has the overweging, as the reader numbers it. */
export const heeftOverweging = (u: Uitspraak, at: string) => !!overwegingVan(u.items, at);

/** The text of an overweging, its paragraphs joined: for a card that shows only words. */
export function tekstVanOverweging(u: Uitspraak, at: string, max = 400): string | null {
	const deel = overwegingVan(u.items, at);
	if (!deel) return null;
	const t = deel.items
		.map((i) => (i.kind === 'rov' || i.kind === 'prose' ? i.body : i.text))
		.join(' ')
		.replace(/\s+/g, ' ')
		.trim();
	return truncate(t, max, { atWord: true });
}

/**
 * The overweging a note stands in, by the note's anchor or its label: `rov-5.7.6` and its
 * number, where the reader numbers it; the paragraph's own anchor where it does not. Null
 * where no paragraph refers to the note.
 */
export function overwegingVanNoot(
	u: Pick<Uitspraak, 'items' | 'noten'>,
	noot: string
): { at: string; num: string | null; id: string } | null {
	const id = u.noten.has(noot) ? noot : [...u.noten.values()].find((n) => n.label === noot)?.id;
	if (!id) return null;
	const k = u.items.findIndex(
		(i) => (i.kind === 'rov' || i.kind === 'prose') && i.noten?.some((m) => m.id === id)
	);
	if (k < 0) return null;
	for (let i = k; i >= 0; i--) {
		const item = u.items[i];
		if (item.kind === 'rov') return { at: paragraphAnchor(item.num), num: item.num, id };
		if (item.kind !== 'prose' || !item.within) break;
	}
	const own = u.items[k];
	return { at: (own.kind === 'prose' && own.id) || id, num: null, id };
}

// An overweging read in place: the judgment's detail (asked once, shared with the reader and
// Verbonden) laid out as its reader lays it out, and the overweging an anchor names in it.
// Gemarkeerd opens a kept r.o. with it (MapInhoud), a reference to a judgment at an r.o.
// shows it in its card (OverwegingKaart): one way to read an r.o. without the judgment.
import { getJudgmentDetail } from '$lib/api/judgments';
import type { Schema } from '$lib/api/types';
import {
	bodyItems,
	signatureStart,
	type BodyItem
} from '$lib/components/explore/readers/judgment-text';
import { overwegingVan } from '$lib/map/inhoud';
import { keyEcli } from './leesbaar';

export type Uitspraak = {
	j: Schema<'JudgmentDetailResponse'>['judgment'];
	/** The body up to the signature, as the reader lays it out. */
	items: BodyItem[];
};

const gelegd = new Map<string, Promise<Uitspraak>>();

/** The judgment of a key (`ecli_nl_hr_2019_2006`) or an ECLI, laid out once. */
export function laadUitspraak(keyOfEcli: string): Promise<Uitspraak> | null {
	const ecli = keyOfEcli.startsWith('ECLI:') ? keyOfEcli : keyEcli(keyOfEcli);
	if (!ecli) return null;
	let p = gelegd.get(ecli);
	if (!p) {
		p = getJudgmentDetail(ecli).then(({ judgment: j }) => {
			const paragraphs = j.paragraphs ?? [];
			return { j, items: bodyItems(paragraphs.slice(0, signatureStart(paragraphs))) };
		});
		p.catch(() => gelegd.delete(ecli));
		gelegd.set(ecli, p);
	}
	return p;
}

/** Whether an anchor names an overweging: `rov-5.1`, or a paragraph id the reader numbers. */
export const isOverwegingAnker = (at: string | null | undefined): at is string =>
	!!at && at.startsWith('rov-');

/** Whether a reference is to a judgment at an overweging: its card is the overweging. */
export const isOverwegingRef = (ref: string | null, at: string | null | undefined) =>
	!!ref && ref.startsWith('judgments/') && isOverwegingAnker(at);

/** The number of the overweging an anchor names: `5.1` of `rov-5.1`. */
export const nummerVan = (at: string) => at.replace(/^rov-/, '');

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
	if (t.length <= max) return t;
	const cut = t.lastIndexOf(' ', max);
	return `${t.slice(0, cut > 0 ? cut : max)}…`;
}

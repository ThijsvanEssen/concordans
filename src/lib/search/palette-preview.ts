// What the right column of ⌘K reads of the bron the keys are on: its kind and name once, its
// status and day in words, and per kind the first sentence or passage, so a bron is chosen
// without opening it. First from the row that is there; what the row lacks comes from the card
// of a bron (`loadPreview`), a law's first article and a dossier's stand, each asked once.
import { getDossier } from '$lib/api/dossiers';
import { ifExists } from '$lib/api/errors';
import { getInstrumentArticles } from '$lib/api/instruments';
import { once } from '$lib/api/records';
import { focusOf } from '$lib/bron/href';
import { firstSentence, loadPreview, PREVIEW_CHARS, type Preview } from '$lib/bron/preview';
import { onDate, sinceDate } from '$lib/text/datum';
import { kindName } from '$lib/text/law-kind';
import { bronLabel, isCollection, type Collection } from '$lib/vocabulary';
import { expiredTitle, extra, presentHit } from './present';
import type { ChosenBron } from './targets';

type Segment = { text: string; mark: boolean };

/** What a load adds to the row: the card of the bron, with the text a law opens with. */
export type PreviewRest = { card: Preview | null; first: string | null; standing: string[] };

type PalettePreviewData = {
	kind: string;
	name: string;
	/** In words: `Ingetrokken per 1 oktober 2012`, `In werking sinds 1 januari 1994`. */
	status: string | null;
	/** What places it: the law of an article, the ECLI of a judgment, the indieners of a stuk. */
	places: string[];
	passage: Segment[] | null;
};

/** How much of a law's first article the column asks for. */
const FIRST_CHARS = PREVIEW_CHARS;

export const collectionOfBron = (bron: ChosenBron): Collection | null => {
	const name = bron.hit?.collection ?? focusOf(bron.ref)?.split('/')[0];
	return name && isCollection(name) ? name : null;
};

/** A law in words: withdrawn, else since when it holds, else since when its text does. */
function statusOfBron(bron: ChosenBron, collection: Collection, expired: string | null) {
	if (expired) return expired;
	const hit = bron.hit;
	if (!hit || collection !== 'instruments') return null;
	const day = extra(hit, 'date_in_force') || extra(hit, 'version_date_in_force');
	return day ? `In werking ${sinceDate(day)}` : null;
}

/** The kind as the row says it; a card that is in says it better. */
function kindOfBron(bron: ChosenBron, collection: Collection, card: Preview | null): string {
	if (card) return card.kicker;
	const kind = bron.hit && collection === 'instruments' ? kindName(extra(bron.hit, 'kind')) : null;
	return kind ?? bronLabel(collection);
}

/** What places a bron: from its row, and what has come in of the rest. */
function placesOfBron(
	bron: ChosenBron,
	collection: Collection,
	context: string | undefined,
	person: Segment[] | null,
	loaded: PreviewRest | null
): string[] {
	const card = loaded?.card;
	const lines = [
		// A law's kind and day stand in its soort and status.
		collection === 'instruments' ? null : context,
		person?.map((part) => part.text).join(''),
		card?.dossier,
		card?.submitters,
		card?.outcome,
		...(loaded?.standing ?? []),
		card?.extra
	];
	return [...new Set(lines.filter((l): l is string => !!l && l !== bron.label))];
}

/** Its name: the label of the row; for a bron named by what was typed, the name its card gives. */
const nameOfBron = (bron: ChosenBron, loaded: PreviewRest | null): string =>
	(bron.unnamed && loaded?.card?.title) || bron.label;

/** The passage: the words found in the row, else what has come in; a person is no passage. */
function passageOfBron(
	snippet: Segment[] | null,
	person: Segment[] | null,
	loaded: PreviewRest | null
): Segment[] | null {
	const first = loaded?.first ?? loaded?.card?.lines;
	return (person ? null : snippet) ?? (first ? [{ text: first, mark: false }] : null);
}

/** What the column reads now: the row, and what has come in of the rest. */
export function previewOfBron(
	bron: ChosenBron,
	q: string,
	loaded: PreviewRest | null,
	now = new Date()
): PalettePreviewData | null {
	const collection = collectionOfBron(bron);
	if (!collection) return null;
	const shown = bron.hit && presentHit(bron.hit, q, [], now);
	const snippet = shown ? shown.snippet : null;
	// A judgment found by a person: who they are in the case places it, its summary is the text.
	const person = bron.hit?.extra?.person ? snippet : null;
	const expired = (shown && shown.expired) || expiredTitle(collection, bron.expiredOn, now);
	return {
		kind: kindOfBron(bron, collection, loaded ? loaded.card : null),
		name: nameOfBron(bron, loaded),
		status: statusOfBron(bron, collection, expired),
		places: placesOfBron(bron, collection, shown ? shown.context : undefined, person, loaded),
		passage: passageOfBron(snippet, person, loaded)
	};
}

/** Whether the row says all there is to say: an article found by a passage. */
export const rowSaysAll = (bron: ChosenBron): boolean =>
	bron.hit?.collection === 'articles' && !!presentHit(bron.hit, '', []).snippet;

/** The first sentence of a law's first article, with its number; null where it has none. */
async function firstOfLaw(key: string): Promise<string | null> {
	const list = await ifExists(
		getInstrumentArticles(key.toUpperCase(), { limit: 1, text_preview_chars: FIRST_CHARS })
	);
	const first = list?.items[0];
	// "1. In deze wet …": the number of its first lid is no sentence.
	const sentence = firstSentence(first?.text_preview?.replace(/^\s*\d+\.\s+/, '') ?? null);
	return sentence ? `${first?.label ?? 'Artikel'}: ${sentence}` : null;
}

/** Who brought a dossier in, and the day of its last stuk. */
async function standingOfDossier(number: string): Promise<string[]> {
	const dossier = await ifExists(getDossier(number));
	const who = dossier?.proposed_by?.name;
	const last = onDate(dossier?.last_activity);
	return [who ? `Ingediend door ${who}` : '', last ? `Laatste stuk ${last}` : ''].filter(Boolean);
}

/** The rest of a bron, asked once per bron; the column keeps what it had if it fails. */
export function loadPalettePreview(bron: ChosenBron): Promise<PreviewRest> {
	const id = focusOf(bron.ref) ?? '';
	return once(`data/${id}#${bron.at ?? ''}`, async () => {
		const [collection, key] = [id.slice(0, id.indexOf('/')), id.slice(id.indexOf('/') + 1)];
		const [card, first, standing] = await Promise.all([
			loadPreview(bron.ref, bron.at ?? null),
			collection === 'instruments' ? firstOfLaw(key) : null,
			collection === 'dossiers' ? standingOfDossier(key) : []
		]);
		return { card, first, standing };
	});
}

/** The kinds of regeling that take `het`: het koninklijk besluit, het verdrag. */
const NEUTER_KINDS =
	/^(koninklijk besluit|rijksbesluit|reglement|(bilateraal |multilateraal )?verdrag)/;

/**
 * "de wet", "het artikel": what Enter opens, in words. A regeling by its own kind, `kind` as
 * the column heads it (UX-toets 5 Nov: a beleidsregel opened as "de wet").
 */
export function whatOpens(collection: Collection, kind?: string | null): string {
	if (collection === 'instruments' && kind) {
		// "AMvB" keeps its capitals, "Beleidsregel" reads "beleidsregel".
		const word = /^\p{Lu}\p{Ll}/u.test(kind) ? kind[0].toLowerCase() + kind.slice(1) : kind;
		return `${NEUTER_KINDS.test(word) ? 'het' : 'de'} ${word}`;
	}
	const neuter = ['articles', 'dossiers', 'documents', 'cabinets', 'ministries'];
	return `${neuter.includes(collection) ? 'het' : 'de'} ${bronLabel(collection).toLowerCase()}`;
}

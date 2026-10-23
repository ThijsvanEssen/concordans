// How complete a part of a bron is in the dataset, in the one form the site says it: a quiet
// line where the reader would otherwise take silence for completeness (besluit 23). The words
// live here and only here; the shape is the API's `completeness` (docs/api.md "Completeness"):
// per part a state, a date and how many are missing.
import type { Schema } from '$lib/api/types';
import { langeDatum, asOfDate } from '$lib/text/datum';
import { formatCount } from '$lib/text/getal';
import { capitalize, joinAnd, plural } from '$lib/text/words';

type Part = Schema<'Part'>;
/** How far a part is complete: its state, and where the API gives them a date and a count. */
type PartState = Pick<Schema<'PartStateDTO'>, 'state'> & Partial<Schema<'PartStateDTO'>>;

/** What the API says of a record or a source, per part; a part left out lacks nothing known. */
export type Completeness = Partial<Record<Part, PartState>>;

/** What a search reads of a type (`searched.<type>` of /api/search); an API before 0.80.1
 *  gives no `signed_for`. */
export type Searched = Omit<Schema<'SearchedDTO'>, 'signed_for'> &
	Partial<Pick<Schema<'SearchedDTO'>, 'signed_for'>>;

/** A part as the reader names it, in a line that starts with it. */
const PART: Record<Part, string> = {
	text: 'tekst',
	paragraphs: "alinea's",
	tables: 'tabellen',
	references: 'verwijzingen',
	definitions: 'begrippen',
	versions: 'versies',
	succession: 'opvolging',
	outcome: 'uitkomst',
	source: 'bron'
};

/** What the dataset lacks of a value: a date, a name, an advice. Waarde says it of an empty cell. */
const IN_DATA = 'in de gegevens';
export const NOT_IN_DATA = `niet ${IN_DATA}`;

/** A part of a bron the dataset lacks, as a line: `Tekst niet in de gegevens`. */
export const lacks = (what: string) => `${capitalize(what)} ${NOT_IN_DATA}`;

/**
 * What one place of a bron lacks that the source should give: `successor`, an old article the
 * transposition table places nowhere (`TRANSPOSED_TO` to the new law with outcome `gat`).
 */
export type Lack = 'successor';

/** The line of a Lack: `Geen opvolger in de transponeringstabel`. */
export const LACK: Record<Lack, string> = {
	successor: 'Geen opvolger in de transponeringstabel'
};

/** A part of which the dataset holds none, in a line: `geen artikelen in de gegevens`. */
export const noneHeld = (what: string) => `geen ${what} ${IN_DATA}`;

/** A bron the dataset does not hold, as a sentence: `Wet X staat niet in de gegevens`. */
export const notHeld = (name: string) => `${name} staat ${NOT_IN_DATA}`;

/** What a search reads, as the API names it: `title` → titels. */
const SEARCHED: Record<Schema<'Searched'>, string> = {
	title: 'titels',
	name: 'namen',
	number: 'nummers',
	summary: 'inhoudsindicaties',
	text: 'de tekst',
	kind: 'de soort'
};

const day = (iso: string | null | undefined) => langeDatum(iso?.slice(0, 10));

/** Of a source: whether the runs still fetch from it. Null while they do. */
function sourceLine(s: PartState | undefined): string | null {
	const until = s?.as_of ? `, stand ${day(s.as_of)}` : '';
	if (s?.state === 'paused') return `wordt niet meer bijgewerkt${until}`;
	if (s?.state === 'unavailable') return `onbereikbaar${until}`;
	if (s?.state === 'pending') return 'nog niet beschikbaar';
	return null;
}

/**
 * Of a text: why it is not there, as the API says it of a Kamerstuk (with its `reason` where
 * one state has two causes; an API without it gets the plainer line), of a paper of the Eerste
 * Kamer and of a publication; where a reader shows no text and the API says nothing
 * (`noText`), that the dataset lacks it. Null where it is there.
 */
function textLine(t: PartState | undefined, noText: boolean): string | null {
	if (t?.state === 'pending' && t.reason === 'awaiting_normalize')
		return t.as_of
			? `tekst nog niet beschikbaar, ontvangen op ${day(t.as_of)}`
			: 'tekst nog niet beschikbaar';
	if (t?.state === 'pending' && t.reason === 'source_pdf_only')
		return 'tekst nog niet beschikbaar, de bron heeft alleen de pdf';
	if (t?.state === 'pending') return 'tekst nog niet beschikbaar';
	if (t?.state === 'not_in_source') return `tekst ${NOT_IN_DATA}, de bron levert geen tekst`;
	if (t?.state === 'not_fetched') return 'tekst alleen bij de bron';
	if (t?.state === 'none') return 'geen leesbare tekst in de bron';
	return noText ? `tekst ${NOT_IN_DATA}` : null;
}

/**
 * Of the references in a text: how many are not linked. With `target_not_loaded` each one
 * missing points to a text the dataset does not hold yet; without a reason some may not have
 * been laid at all.
 */
function referencesLine(r: PartState | undefined): string | null {
	if (r?.state !== 'partial') return null;
	const n = r.missing;
	const what = n
		? `${formatCount(n)} ${plural(n, 'verwijzing', 'verwijzingen')}`
		: 'verwijzingen deels';
	return r.reason === 'target_not_loaded'
		? `${what} naar tekst die niet in de gegevens staat`
		: `${what} nog niet gekoppeld`;
}

/**
 * What a line says: `of` the source a line about a source is of, `noText` a reader without
 * text, `shown` how many of a part the reader shows: a part still pending of which it shows
 * some is read in part (`Verwijzingen deels beschikbaar`), not yet at all.
 */
type CoverageOptions = { of?: string; noText?: boolean; shown?: Shown };

/** How many of each part the reader shows. */
export type Shown = Partial<Record<Part, number>>;

/**
 * The line, in words: `Tekst nog niet beschikbaar`, `Tekst alleen bij de bron`, `12 verwijzingen nog niet gekoppeld,
 * begrippen nog niet beschikbaar`, `Geen einde vastgelegd, laatste activiteit 3 maart 2019`, `HUDOC wordt niet meer bijgewerkt,
 * …`. Null where nothing is known to lack.
 */
export function coverageLine(
	completeness: Completeness | null | undefined,
	{ of, noText = false, shown = {} }: CoverageOptions = {}
): string | null {
	const c = completeness ?? {};
	const said: string[] = [];
	const text = textLine(c.text, noText);
	if (text) said.push(text);
	if (c.versions?.state === 'not_in_source') {
		const on = c.versions.as_of ? ` op ${day(c.versions.as_of)}` : '';
		said.push(`tekst zoals vastgesteld${on}, latere wijzigingen niet verwerkt`);
	}
	const references = referencesLine(c.references);
	if (references) said.push(references);
	// A text not there takes its paragraphs and tables with it: the text line says it.
	const withText = !c.text || c.text.state === 'done';
	const outcomeOn = c.outcome?.state === 'pending' ? c.outcome.as_of : null;
	const pending = (Object.keys(PART) as Part[]).filter(
		(p) =>
			c[p]?.state === 'pending' &&
			p !== 'source' &&
			p !== 'text' &&
			(withText || (p !== 'paragraphs' && p !== 'tables')) &&
			(p !== 'outcome' || !outcomeOn)
	);
	const begun = pending.filter((p) => (shown[p] ?? 0) > 0);
	const notYet = pending.filter((p) => !begun.includes(p));
	if (begun.length) said.push(`${joinAnd(begun.map((p) => PART[p]))} deels beschikbaar`);
	if (notYet.length) said.push(`${joinAnd(notYet.map((p) => PART[p]))} nog niet beschikbaar`);
	// An open bill: the Kamer records no withdrawal, so it is not known to run still.
	if (outcomeOn) said.push(`geen einde vastgelegd, laatste activiteit ${day(outcomeOn)}`);
	const source = sourceLine(c.source);
	if (source) said.push(of ? `${of} ${source}` : source);
	return said.length ? capitalize(said.join(', ')) : null;
}

/**
 * What a search of a type reads: `Gezocht in titels en nummers, niet in de tekst`; of stukken
 * and stemmingen kept to the fracties the query names (`signed_for`), by whom: `Gezocht in
 * titels en de tekst, door VVD`.
 */
export function searchedLine(s: Searched | null | undefined): string | null {
	if (!s?.fields.length) return null;
	const by = s.signed_for?.length ? `, door ${joinAnd(s.signed_for.map((f) => f.name))}` : '';
	const unread = s.completeness.text?.state === 'none' ? ', niet in de tekst' : '';
	return `Gezocht in ${joinAnd(s.fields.map((f) => SEARCHED[f]))}${by}${unread}`;
}

/** Where an arcering's words are now, where they no longer stand where they were kept. */
export type AnchorState =
	| { state: 'moved'; place: string }
	| { state: 'changed' | 'lapsed'; since: string }
	| { state: 'lost' };

/**
 * The line of an arcering whose anchor no longer holds (besluit 23): `Nu in lid 3`, `Tekst
 * gewijzigd per 1 juli 2026`, `Vervallen per 1 juli 2026`, `Passage niet meer in de tekst`.
 */
export function anchorLine(a: AnchorState): string {
	switch (a.state) {
		case 'moved':
			return `Nu in ${a.place}`;
		case 'changed':
			return `Tekst gewijzigd ${asOfDate(a.since)}`;
		case 'lapsed':
			return `Vervallen ${asOfDate(a.since)}`;
		case 'lost':
			return 'Passage niet meer in de tekst';
	}
}

// How complete a part of a bron is in the dataset, in the one form the site says it: a quiet
// line where the reader would otherwise take silence for completeness (besluit 23). The words
// live here and only here; the shape is the API's `completeness` (docs/api.md "Completeness"):
// per part a state, a date and how many are missing.
import type { Schema } from '$lib/api/types';
import { langeDatum } from '$lib/text/datum';
import { formatCount } from '$lib/text/getal';
import { capitalize, joinAnd } from '$lib/text/words';

type Part = Schema<'Part'>;
/** How far a part is complete: its state, and where the API gives them a date and a count. */
type PartState = Pick<Schema<'PartStateDTO'>, 'state'> & Partial<Schema<'PartStateDTO'>>;

/** What the API says of a record or a source, per part; a part left out lacks nothing known. */
export type Completeness = Partial<Record<Part, PartState>>;

/** What a search reads of a type (`searched.<type>` of /api/search). */
export type Searched = Schema<'SearchedDTO'>;

/** A part as the reader names it, in a line that starts with it. */
const PART: Record<Part, string> = {
	text: 'tekst',
	paragraphs: "alinea's",
	tables: 'tabellen',
	references: 'verwijzingen',
	definitions: 'begrippen',
	versions: 'versies',
	succession: 'opvolging',
	source: 'bron'
};

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
	const until = s?.as_of ? `, bijgewerkt tot ${day(s.as_of)}` : '';
	if (s?.state === 'paused') return `gepauzeerd${until}`;
	if (s?.state === 'unavailable') return `onbereikbaar${until}`;
	if (s?.state === 'pending') return 'nog niet opgehaald';
	return null;
}

/**
 * The line, in words: `Tekst niet ingelezen`, `Verwijzingen naar andere wetten deels gelegd,
 * 12 niet herkend, begrippen nog niet verwerkt`. `of` names the source a line about a source
 * is of (`HUDOC gepauzeerd, …`). Null where nothing is known to lack.
 */
export function coverageLine(c: Completeness | null | undefined, of?: string): string | null {
	if (!c) return null;
	const said: string[] = [];
	if (c.text?.state === 'none') said.push('tekst niet ingelezen');
	if (c.versions?.state === 'not_in_source') {
		const on = c.versions.as_of ? ` op ${day(c.versions.as_of)}` : '';
		said.push(`tekst zoals vastgesteld${on}, latere wijzigingen niet verwerkt`);
	}
	if (c.references?.state === 'partial') {
		const missing = c.references.missing;
		const count = missing ? `, ${formatCount(missing)} niet herkend` : '';
		said.push(`verwijzingen naar andere wetten deels gelegd${count}`);
	}
	const pending = (Object.keys(PART) as Part[]).filter(
		(p) => p !== 'source' && c[p]?.state === 'pending'
	);
	if (pending.length) said.push(`${joinAnd(pending.map((p) => PART[p]))} nog niet verwerkt`);
	const source = sourceLine(c.source);
	if (source) said.push(of ? `${of} ${source}` : source);
	return said.length ? capitalize(said.join(', ')) : null;
}

/** What a search of a type reads: `Gezocht in titels en nummers, niet in de tekst`. */
export function searchedLine(s: Searched | null | undefined): string | null {
	if (!s?.fields.length) return null;
	const unread = s.completeness.text?.state === 'none' ? ', niet in de tekst' : '';
	return `Gezocht in ${joinAnd(s.fields.map((f) => SEARCHED[f]))}${unread}`;
}

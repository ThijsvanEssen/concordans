import { describe, expect, it } from 'vitest';
import {
	alignUnits,
	byYear,
	compareVersions,
	diffWords,
	lidHistory,
	plainDiff,
	unitsOf,
	wordingOf,
	wordingsOf
} from './version-diff';

const part = (id: string, number: string, start: number, text: string) => ({
	id,
	kind: 'lid',
	number,
	start,
	end: start + text.length,
	text,
	term: null
});

/** An article text with numbered leden, and its parts as the API delivers them. */
function version(leden: string[]) {
	let text = '';
	const parts = leden.map((lid, i) => {
		const prefix = `${i + 1}. `;
		if (text) text += '\n';
		const start = text.length + prefix.length;
		text += prefix + lid;
		return part(`lid-${i + 1}`, String(i + 1), start, lid);
	});
	return { text, parts };
}

describe('diffWords', () => {
	it('marks the words an amendment inserted, and treats a non-breaking space as a space', () => {
		const old = 'ras, geslacht of op welke grond dan ook';
		const now = 'ras, geslacht, handicap, seksuele gerichtheid of op welke grond dan ook';
		expect(diffWords(old, now)).toEqual([
			{ op: 'eq', text: 'ras, geslacht' },
			{ op: 'ins', text: ', handicap, seksuele gerichtheid' },
			{ op: 'eq', text: ' of op welke grond dan ook' }
		]);
	});

	it('reads a replacement of a few words as one change: the old wording, then the new', () => {
		const segments = diffWords('op last van de rechter', 'met machtiging van de rechter');
		expect(segments).toEqual([
			{ op: 'del', text: 'op last' },
			{ op: 'ins', text: 'met machtiging' },
			{ op: 'eq', text: ' van de rechter' }
		]);
	});
});

describe('compareVersions', () => {
	it('marks the words in the one lid that changed and leaves the rest', () => {
		const rows = compareVersions(
			version(['Het onderwijs is vrij.', 'Er zijn genoeg scholen.']),
			version(['Het onderwijs is vrij.', 'Er zijn genoeg openbare scholen.'])
		);
		expect(rows.map((r) => r.kind)).toEqual(['same', 'changed']);
		expect(rows[1].segments.find((s) => s.op === 'ins')?.text).toBe('openbare ');
	});

	it('shows a rewritten lid as old and new, without marks', () => {
		const rows = compareVersions(
			version(['Het briefgeheim is onschendbaar, behalve op last van de rechter.']),
			version(['Ieder heeft recht op eerbiediging van zijn brief- en telecommunicatiegeheim.'])
		);
		expect(rows[0].kind).toBe('rewritten');
		expect(rows[0].segments).toEqual([]);
	});

	it('pairs leden by content, so an inserted lid does not rewrite the ones after it', () => {
		const a = unitsOf(
			version(['Eerste regel over de wet.', 'Tweede regel over de rechter.']).text,
			null
		);
		const b = unitsOf(
			version([
				'Eerste regel over de wet.',
				'Een geheel nieuwe bepaling.',
				'Tweede regel over de rechter.'
			]).text,
			null
		);
		const pairs = alignUnits(a, b).map(([x, y]) => [x?.number ?? null, y?.number ?? null]);
		expect(pairs).toEqual([
			['1', '1'],
			[null, '2'],
			['2', '3']
		]);
		const rows = compareVersions(
			version(['Eerste regel over de wet.', 'Tweede regel over de rechter.']),
			version([
				'Eerste regel over de wet.',
				'Een geheel nieuwe bepaling.',
				'Tweede regel over de rechter.'
			])
		);
		expect(rows.map((r) => [r.kind, r.new?.number])).toEqual([
			['same', '1'],
			['added', '2'],
			['same', '3']
		]);
	});

	it('compares an article without leden as one text', () => {
		const rows = compareVersions(
			{ text: 'Allen worden gelijk behandeld.' },
			{ text: 'Niemand wordt gediscrimineerd, nooit en nergens.' }
		);
		expect(rows.map((r) => [r.kind, r.new?.number])).toEqual([['rewritten', null]]);
	});
});

type Change = { change: 'added' | 'removed' | 'changed'; kind: string; number: string | null };

const lidChange = (change: Change['change'], number: string): Change => ({
	change,
	kind: 'lid',
	number
});

/** A version as the history lists it: no text, whether it changed it, and which parts. */
const listed = (
	from: string,
	until: string | null,
	textChanged: boolean,
	changes: Change[] = []
) => ({
	key: `v-${from}`,
	valid_from: from,
	valid_until: until,
	text_changed: textChanged,
	changes: changes.map((c) => ({ ...c, term: null }))
});

describe('wordingsOf', () => {
	const versions = [
		listed('2002-03-21', '2006-04-06', true),
		listed('2006-04-06', '2006-10-11', true, [lidChange('changed', '2')]),
		listed('2006-10-11', '2017-11-17', false),
		listed('2017-11-17', null, true, [lidChange('changed', '2')])
	];

	it('joins BWB versions with one wording, by text_changed, dated from the one that introduced it', () => {
		const wordings = wordingsOf(versions);
		expect(wordings.map((w) => [w.from, w.until, w.versions.length])).toEqual([
			['2002-03-21', '2006-04-06', 1],
			['2006-04-06', '2017-11-17', 2],
			['2017-11-17', null, 1]
		]);
		expect(wordings.map((w) => w.summary)).toEqual([
			'oudste tekst in de gegevens',
			'lid 2 gewijzigd',
			'lid 2 gewijzigd'
		]);
		expect(wordingOf(wordings, '2006-10-11')?.index).toBe(1);
	});

	it('names what changed from the parts the API lists, the text where it lists none', () => {
		const wordings = wordingsOf([
			listed('2000-01-01', '2001-01-01', true),
			listed('2001-01-01', '2002-01-01', true, [
				lidChange('changed', '1'),
				lidChange('added', '3'),
				lidChange('removed', '4')
			]),
			listed('2002-01-01', '2003-01-01', true, [
				{ change: 'changed', kind: 'aanhef', number: null }
			]),
			listed('2003-01-01', null, true)
		]);
		expect(wordings.map((w) => w.summary)).toEqual([
			'oudste tekst in de gegevens',
			'lid 1 gewijzigd, lid 3 ingevoegd, lid 4 vervallen',
			'tekst gewijzigd',
			'tekst gewijzigd'
		]);
	});

	it('follows one lid through its formulations', () => {
		const h = lidHistory(wordingsOf(versions), '2')!;
		expect(h.formulations.map((f) => [f.since.from, f.through.until, f.kind])).toEqual([
			['2002-03-21', '2006-04-06', 'first'],
			['2006-04-06', '2017-11-17', 'changed'],
			['2017-11-17', null, 'changed']
		]);
		expect(h.removedIn).toBeNull();
		const one = lidHistory(wordingsOf(versions), '1')!;
		expect(one.formulations).toHaveLength(1);
	});

	it('starts a lid where it was inserted and ends it where it went', () => {
		const wordings = wordingsOf([
			listed('2000-01-01', '2001-01-01', true),
			listed('2001-01-01', '2002-01-01', true, [lidChange('added', '3')]),
			listed('2002-01-01', '2003-01-01', true, [lidChange('changed', '1')]),
			listed('2003-01-01', null, true, [lidChange('removed', '3')])
		]);
		const h = lidHistory(wordings, '3')!;
		expect(h.formulations.map((f) => [f.since.from, f.through.until, f.kind])).toEqual([
			['2001-01-01', '2003-01-01', 'added']
		]);
		expect(h.removedIn?.from).toBe('2003-01-01');
	});

	it('marks the version that repealed the article', () => {
		const repealed = [
			listed('1995-04-01', '2020-01-01', true),
			listed('2020-01-01', '2020-01-01', true)
		];
		const wordings = wordingsOf(repealed);
		expect(wordings.map((w) => [w.from, w.until, w.lapsed, w.summary])).toEqual([
			['1995-04-01', '2020-01-01', false, 'oudste tekst in de gegevens'],
			['2020-01-01', '2020-01-01', true, 'vervallen']
		]);
	});
});

describe('plainDiff', () => {
	it('writes insertions and deletions in brackets, one lid per line', () => {
		const rows = compareVersions(
			version(['Onderwijs is vrij.', 'Er zijn scholen.']),
			version(['Onderwijs is vrij.', 'Er zijn openbare scholen.'])
		);
		expect(plainDiff(rows)).toBe('1. Onderwijs is vrij.\n2. Er zijn [+openbare+] scholen.');
	});
});

describe('compareVersions on a bijlage', () => {
	// As the API gives Awb bijlage 2 artikel 4: parts for the aanhef and the onderdelen, and
	// the laws listed between them outside every part.
	const version = (law: string) => {
		const lines = [
			'Tegen een besluit kan beroep worden ingesteld:',
			'a. een besluit',
			law,
			'b. een ander'
		];
		const text = lines.join('\n');
		const part = (id: string, kind: string, number: string | null, line: number, skip = 0) => {
			const start = text.indexOf(lines[line]) + skip;
			return {
				id,
				kind,
				number,
				text: lines[line].slice(skip),
				start,
				end: start + lines[line].length - skip,
				term: null
			};
		};
		return {
			text,
			parts: [
				part('aanhef', 'aanhef', null, 0),
				part('onder-a', 'onderdeel', 'a', 1, 3),
				part('onder-b', 'onderdeel', 'b', 3, 3)
			]
		};
	};

	it('sees a change in the text between the onderdelen', () => {
		const rows = compareVersions(
			version('Elektriciteitswet 1998: artikel 36'),
			version('Energiewet: artikel 3.37')
		);
		expect(rows.filter((r) => r.kind !== 'same').map((r) => r.new?.number)).toEqual([null]);
	});
});

describe('byYear', () => {
	it('groups tekstversies by the year they took effect, in their order', () => {
		const w = (from: string | null) => ({ from });
		expect(
			byYear([w('2025-01-01'), w('2025-07-01'), w('2026-01-01'), w(null)]).map(([y, g]) => [
				y,
				g.length
			])
		).toEqual([
			['2025', 2],
			['2026', 1],
			['Zonder datum', 1]
		]);
	});
});

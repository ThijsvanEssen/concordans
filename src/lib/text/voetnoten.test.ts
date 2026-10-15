import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import {
	metVoetnoot,
	regelVan,
	stukNoten,
	stukPlaats,
	uitspraakNoten,
	type NootMarker
} from './voetnoten';
import { bodyItems } from '$lib/components/explore/readers/judgment-text';
import { legUit, overwegingVanNoot } from '$lib/bron/overweging';
import type { Row } from '$lib/verbonden/rows';
import { plaatsVanEdge } from '$lib/verbonden/edge-meta';
import { hoeVan, plaatsIn } from '$lib/verbonden/hoe';
import { aanhalingIn } from '$lib/verbonden/passage';
import { kantlijnBreedte, schuif } from '$lib/actions/kantlijn';

type Judgment = Schema<'JudgmentDetailResponse'>['judgment'];

const noot = (f: Partial<Schema<'JudgmentFootnote'>>): Schema<'JudgmentFootnote'> => ({
	label: '1',
	paragraph_id: null,
	at: null,
	text: 'Noot.',
	citations: [],
	...f
});

describe('the notes of a judgment', () => {
	it('anchors each by its label, a repeated label apart, and groups the markers per paragraph', () => {
		const { noten, perAlinea, los } = uitspraakNoten([
			noot({ label: '34', paragraph_id: 'rov-5.7.6', at: 10 }),
			noot({ label: '35', paragraph_id: 'rov-5.7.6' }),
			noot({ label: '35', paragraph_id: 'rov-6' }),
			noot({ label: '36' }),
			noot({ label: '37', text: '  ' })
		]);
		expect([...noten.keys()]).toEqual(['fn-34', 'fn-35', 'fn-35-2', 'fn-36']);
		expect(perAlinea.get('rov-5.7.6')).toEqual([
			{ id: 'fn-34', label: '34', at: 10 },
			{ id: 'fn-35', label: '35', at: null }
		]);
		expect(los).toEqual(['fn-36']);
	});

	it('sets a marker at its place in the overweging, one without a place at its end', () => {
		const text = '5.7.6\nDe staat is aansprakelijk.  Ook voor een deel.';
		const markers: NootMarker[] = [
			{ id: 'fn-34', label: '34', at: text.indexOf('  Ook') },
			{ id: 'fn-35', label: '35', at: null }
		];
		const [item] = bodyItems(
			[
				{
					number: null,
					continues: null,
					citations: [],
					paragraph_id: 'rov-5.7.6',
					kind: 'body',
					text
				}
			],
			new Map([['rov-5.7.6', markers]])
		);
		expect(item.kind).toBe('rov');
		if (item.kind !== 'rov') return;
		expect(item.body).toBe('De staat is aansprakelijk. Ook voor een deel.');
		expect(item.noten).toEqual([
			{ id: 'fn-34', label: '34', at: 'De staat is aansprakelijk.'.length },
			{ id: 'fn-35', label: '35', at: item.body.length }
		]);
	});

	it('finds the overweging a note stands in, also from a paragraph that continues it', () => {
		const j = {
			paragraphs: [
				{ paragraph_id: 'rov-5.7.6', number: '5.7.6', kind: 'body', text: 'De staat.' },
				{ paragraph_id: 'p-2', kind: 'body', text: 'Verder.', continues: 'rov-5.7.6' }
			],
			footnotes: [
				noot({ label: '35', paragraph_id: 'rov-5.7.6' }),
				noot({ label: '36', paragraph_id: 'p-2' })
			]
		} as unknown as Judgment;
		const u = legUit(j);
		expect(overwegingVanNoot(u, '35')).toEqual({ at: 'rov-5.7.6', num: '5.7.6', id: 'fn-35' });
		expect(overwegingVanNoot(u, 'fn-36')).toEqual({ at: 'rov-5.7.6', num: '5.7.6', id: 'fn-36' });
		expect(overwegingVanNoot(u, '99')).toBeNull();
		expect(bodyItems(j.paragraphs ?? []).every((i) => !('noten' in i))).toBe(true);
	});
});

describe('the notes of a Kamerstuk', () => {
	const regels = [
		{ start: 0, text: 'Eerste alinea.', i: 0 },
		{ start: 15, text: 'Tweede alinea.', i: 1 },
		{ start: 30, text: 'Derde alinea.', i: 2 }
	];
	const fn = (f: Partial<Schema<'DocumentFootnoteDTO'>>): Schema<'DocumentFootnoteDTO'> => ({
		id: 'fn-1',
		label: '1',
		text: 'Noot.',
		at: null,
		section_id: null,
		...f
	});

	it('marks a note in its paragraph, at the end of its section without a place, else at the end', () => {
		const { markers, naSectie, los } = stukNoten(
			[
				fn({ id: 'fn-1', label: '1', at: 29 }),
				fn({ id: 'fn-2', label: '2', section_id: 's-1' }),
				fn({ id: 'fn-3', label: '3' })
			],
			regels,
			[{ id: 's-1', char_end: 29 }]
		);
		expect(markers.get(1)).toEqual([{ id: 'fn-1', label: '1', at: 14 }]);
		expect(naSectie.get(1)).toEqual(['fn-2']);
		expect(los).toEqual(['fn-3']);
	});

	it('takes the paragraph before a place between two', () => {
		expect(regelVan(regels, 14)).toBe(0);
		expect(regelVan(regels, 29)).toBe(1);
	});

	it('reads where an edge stands: a note, the text, the title', () => {
		expect(
			stukPlaats({
				place: { part: 'footnote', start: 0, end: 9, footnote: '71', footnote_id: 'fn-71' }
			})
		).toEqual({ part: 'footnote', at: 'fn-71', label: '71', bereik: { start: 0, end: 9 } });
		expect(stukPlaats({ place: { part: 'text', start: 5, end: 9, section_id: 's-3' } })).toEqual({
			part: 'text',
			at: 's-3',
			bereik: { start: 5, end: 9 }
		});
		expect(stukPlaats({ place: { part: 'title', start: 0, end: 3 } })?.part).toBe('title');
		expect(stukPlaats({})).toBeNull();
	});
});

describe('a citation in a note, on a row', () => {
	it('names the note with its place', () => {
		expect(metVoetnoot('r.o. 5.7.6', '35')).toBe('r.o. 5.7.6 (voetnoot 35)');
		expect(metVoetnoot(null, '71')).toBe('voetnoot 71');
		expect(metVoetnoot('r.o. 2', null)).toBe('r.o. 2');
	});

	it('reads the passage an edge keeps, with its note (edge_meta=passages)', () => {
		const snippet = 'Zie HR 23 september 1988, ECLI:NL:HR:1988:AD5713 (Kalimijnen).';
		const words = 'ECLI:NL:HR:1988:AD5713';
		const p = plaatsVanEdge(
			{
				passages: [
					{
						paragraph_id: 'rov-5.7.6',
						paragraph_number: '5.7.6',
						footnote: '35',
						snippet,
						text: words,
						start: snippet.indexOf(words),
						end: snippet.indexOf(words) + words.length
					}
				]
			},
			'ECLI:NL:HR:2019:2006'
		);
		expect(p).toEqual({
			snippet,
			match: words,
			passageAt: 'rov-5.7.6',
			noot: { id: 'fn-35', label: '35' },
			position: 'r.o. 5.7.6 (voetnoot 35)'
		});
	});

	it('reads a Kamerstuk edge’s note and the words in it (meta.place)', () => {
		const p = plaatsVanEdge(
			{ place: { part: 'footnote', start: 0, end: 40, footnote: '77', footnote_id: 'fn-77' } },
			null
		);
		expect(p).toEqual({
			noot: { id: 'fn-77', label: '77' },
			bereik: { start: 0, end: 40 },
			position: 'voetnoot 77'
		});
	});

	it('links r.o. and note in the line: Haalt aan in r.o. 5.7.6 (voetnoot 35)', () => {
		const row: Row = {
			ref: { collection: 'judgments', key: 'ecli_nl_hr_2019_2006' },
			title: 'HR 20 december 2019',
			context: null,
			filterGroup: 'uitspraken',
			relation: 'REFERS_TO',
			direction: 'inbound',
			position: 'r.o. 5.7.6 (voetnoot 35)',
			snippet: 'Zie voor Nederland: HR 23 september 1988, ECLI:NL:HR:1988:AD5713.',
			match: 'ECLI:NL:HR:1988:AD5713',
			passageAt: 'rov-5.7.6',
			noot: { id: 'fn-35', label: '35' },
			confidence: 0.95,
			edge: { reason: 'ecli' }
		};
		const hoe = hoeVan(row, 'judgments');
		expect(`${hoe?.werkwoord} ${hoe?.rest}`).toBe('Haalt aan in r.o. 5.7.6 (voetnoot 35)');
		expect(hoe?.plaats).toEqual({
			text: 'r.o. 5.7.6 (voetnoot 35)',
			at: 'rov-5.7.6',
			noot: 'fn-35'
		});
		expect(plaatsIn('in voetnoot 71', null, { id: 'fn-71', label: '71' })).toEqual({
			text: 'voetnoot 71',
			at: 'fn-71',
			noot: 'fn-71'
		});
	});

	it('takes the strongest mention in a note with its label', () => {
		const snippet = 'Vgl. art. 6:162 BW en de toelichting.';
		const a = aanhalingIn(
			{
				article: { key: 'bwbr0005289_6_162' },
				paragraph_ids: ['rov-5.7.6'],
				snippet,
				snippet_paragraph_id: 'rov-5.7.6',
				start: 5,
				end: 15,
				text: 'art. 6:162',
				footnote: '35'
			},
			[{ paragraph_id: 'rov-5.7.6', text: 'De staat is aansprakelijk.', citations: [] }]
		);
		expect(a).toEqual({ snippet, match: 'art. 6:162', at: 'rov-5.7.6', noot: '35' });
	});
});

describe('notes in the margin', () => {
	it('takes the margin only where it leaves a note room', () => {
		expect(kantlijnBreedte(150)).toBeNull();
		expect(kantlijnBreedte(260)).toBe(228);
		expect(kantlijnBreedte(600)).toBe(280);
	});

	it('moves a note down below the one above it', () => {
		expect(
			schuif([
				{ top: 0, height: 100 },
				{ top: 50, height: 20 },
				{ top: 400, height: 10 }
			])
		).toEqual([0, 58, 0]);
	});
});

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	begrippenWithin,
	definitieKaart,
	definitieRegel,
	definitiesOp,
	gegevenDoor,
	plaatsVan,
	type Definitie
} from './begrippen';

const wet: Definitie = {
	ref: 'bwbr0018450_1#a',
	term: 'wet',
	text: 'de Zorgverzekeringswet',
	article_key: 'bwbr0018450_1',
	article_number: '1',
	place: 'a',
	refers_to: 'BWBR0018450',
	scope: { kind: 'wet', path: '', reach: 'own' },
	given_by: null
};

// Cbb art. 2 uses "CSIRT" as art. 1 Cyberbeveiligingswet defines it: the Cbb is issued under it.
const csirt: Definitie = {
	ref: 'bwbr0051234_1#csirt',
	term: 'CSIRT',
	text: 'computer security incident response team',
	article_key: 'bwbr0051234_1',
	article_number: '1',
	place: null,
	refers_to: null,
	scope: { kind: 'wet', path: '', reach: 'own_and_based' },
	given_by: {
		key: 'bwbr0051234',
		bwb_id: 'BWBR0051234',
		citation_title: 'Cyberbeveiligingswet',
		short_title: 'Cyberbeveiligingswet',
		abbreviation: null,
		path: '/wetten/BWBR0051234'
	}
};

const ROOT = join(process.cwd(), 'src');
function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return files(path);
		return /\.(svelte|ts)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
	});
}

describe('begrippen', () => {
	it('says a definition in one line, as the hover has it', () => {
		expect(definitieRegel(wet)).toBe('wet: de Zorgverzekeringswet (art. 1, onder a)');
		expect(plaatsVan({ article_number: '1', place: null })).toBe('art. 1');
		expect(plaatsVan({ article_number: null, place: 'a' })).toBeNull();
		// A dash or bullet of the list is no place: the article alone.
		for (const teken of ['–', '−', '•', '○', ' - '])
			expect(plaatsVan({ article_number: '1', place: teken })).toBe('art. 1');
		expect(plaatsVan({ article_number: '1', place: '2°' })).toBe('art. 1, onder 2°');
	});

	it('makes the card of a term: its place, the term, the definition', () => {
		expect(definitieKaart(wet)).toEqual({
			kicker: 'Begrip, art. 1, onder a',
			title: 'wet',
			date: null,
			lines: 'de Zorgverzekeringswet'
		});
	});

	it('names the law a definition is taken from, by its shortest name', () => {
		expect(gegevenDoor(wet)).toBeNull();
		expect(gegevenDoor(csirt)).toBe('Cyberbeveiligingswet');
		const g = csirt.given_by!;
		expect(gegevenDoor({ given_by: { ...g, abbreviation: 'Cbw' } })).toBe('Cbw');
		expect(gegevenDoor({ given_by: { ...g, short_title: null } })).toBe('Cyberbeveiligingswet');
		expect(gegevenDoor({ given_by: { key: g.key, path: null } })).toBeNull();

		expect(plaatsVan(csirt)).toBe('art. 1 Cyberbeveiligingswet');
		expect(plaatsVan({ ...csirt, place: 'b' })).toBe('art. 1, onder b, Cyberbeveiligingswet');
		// The guard holds for a taken definition too: a dash is no place.
		expect(plaatsVan({ ...csirt, place: '–' })).toBe('art. 1 Cyberbeveiligingswet');
		expect(plaatsVan({ ...csirt, article_number: null })).toBe('Cyberbeveiligingswet');
		expect(definitieKaart(csirt).kicker).toBe('Begrip, art. 1 Cyberbeveiligingswet');
		expect(definitieRegel(csirt)).toBe(
			'CSIRT: computer security incident response team (art. 1 Cyberbeveiligingswet)'
		);
	});

	it('shows a term one way wherever it is marked', () => {
		// Every marked term goes through CitedText, whose card and line come from here; no other
		// file makes a card of a definition itself.
		const eigen = files(ROOT).filter((f) =>
			/\bkicker:\s*[^,]*Begrip/.test(readFileSync(f, 'utf8'))
		);
		expect(eigen.map((f) => relative(ROOT, f))).toEqual(['lib/text/begrippen.ts']);
		const cited = readFileSync(join(ROOT, 'lib/components/articles/CitedText.svelte'), 'utf8');
		expect(cited).toMatch(/voorbeeld=\{definitieKaart\(/);
		expect(cited).toMatch(/definitieRegel\(/);
		const gebruikers = files(ROOT).filter((f) =>
			/import[^;]*\bdefinitieKaart\b[^;]*from '\$lib\/text\/begrippen'/.test(
				readFileSync(f, 'utf8')
			)
		);
		expect(gebruikers.map((f) => relative(ROOT, f))).toEqual([
			'lib/components/articles/CitedText.svelte'
		]);
	});

	it('takes the terms of one part, with offsets in it', () => {
		const spans = [
			{ start: 10, end: 13, term: 'wet', definition_ref: wet.ref },
			{ start: 60, end: 63, term: 'wet', definition_ref: wet.ref }
		];
		expect(begrippenWithin(spans, 5, 40)).toEqual([
			{ start: 5, end: 8, term: 'wet', definition_ref: wet.ref }
		]);
		expect(definitiesOp([wet]).get(wet.ref)?.term).toBe('wet');
		expect(definitiesOp(null).size).toBe(0);
	});
});

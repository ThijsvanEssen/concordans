import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/state', () => ({ page: { url: new URL('http://x/') } }));

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isCollection } from '$lib/vocabulary';
import {
	buildBronHref,
	buildOpenHref,
	exploreMode,
	focusOf,
	hasFocus,
	indexHref,
	modeOf,
	refOf
} from './href';

const at = (path: string) => new URL(`http://localhost${path}`);

describe('buildBronHref', () => {
	it('opens every bron in Tekst, at its bare address (besluit 32)', () => {
		expect(buildBronHref(at('/'), 'articles/bwbr0001854_287')).toBe(
			'/explore?focus=articles/bwbr0001854_287'
		);
		expect(buildBronHref(at('/'), 'dossiers/36327')).toBe('/dossiers/36327');
		expect(buildBronHref(at('/'), 'members/x')).toBe('/explore?focus=members/x');
	});

	it('names a dossier by its number, not its node key', () => {
		expect(
			buildBronHref(at('/'), { collection: 'dossiers', key: '37020_xv', number: '37020-XV' })
		).toBe('/dossiers/37020-XV');
		expect(buildBronHref(at('/'), refOf('dossiers', '37020_j', { label: '37020-J' }))).toBe(
			'/dossiers/37020-J'
		);
	});

	it('links nowhere for a dossier node without a label', () => {
		expect(buildBronHref(at('/'), refOf('dossiers', '37020_xv', {}))).toBe('/explore');
	});

	it('keeps the network and the overlay', () => {
		expect(
			buildBronHref(at('/explore?focus=articles/a&overlay=open&wet=x'), {
				collection: 'judgments',
				key: 'ecli_nl_hr_2024_1769'
			})
		).toBe('/uitspraken/ECLI:NL:HR:2024:1769?overlay=open');
	});

	it('keeps reading, and keeps the canvas of Samenhang', () => {
		expect(buildBronHref(at('/explore?focus=articles/a'), 'judgments/j')).toBe(
			'/explore?focus=judgments/j'
		);
		expect(buildBronHref(at('/explore?focus=articles/a&mode=netwerk'), 'judgments/j')).toBe(
			'/explore?focus=judgments/j&mode=netwerk'
		);
		expect(buildBronHref(at('/explore'), 'judgments/j')).toBe(
			'/explore?focus=judgments/j&mode=netwerk'
		);
		// A readable address names its bron before the lookup knows its key: it is read.
		expect(buildBronHref(at('/wetten/BWBR0099999/artikel/1'), 'judgments/j')).toBe(
			'/explore?focus=judgments/j'
		);
	});

	it('reads a bron that is opened from Bladeren', () => {
		expect(buildBronHref(at('/explore?mode=index&kind=judgments'), 'judgments/j')).toBe(
			'/explore?focus=judgments/j'
		);
	});

	it('leaves the filters of Bladeren behind', () => {
		const bladeren = '/explore?mode=index&kind=commitments&van=2020-01-01&tot=2020-12-31&status=x';
		expect(buildBronHref(at(bladeren), 'judgments/j')).toBe('/explore?focus=judgments/j');
	});

	it('carries the position as a fragment', () => {
		expect(buildBronHref(null, 'articles/bwbr0001903_27c', { at: 'lid-2' })).toBe(
			'/explore?focus=articles/bwbr0001903_27c#lid-2'
		);
	});

	it('keeps the view of a readable address, and gives one where the bron has it', () => {
		expect(
			buildBronHref(at('/uitspraken/ECLI:NL:HR:2019:2006?bronnen=artikelen'), 'dossiers/36799')
		).toBe('/dossiers/36799?bronnen=artikelen');
		expect(
			buildBronHref(at('/dossiers/36799'), 'judgments/ecli_nl_hr_2019_2006', { at: 'rov-5.3' })
		).toBe('/uitspraken/ECLI:NL:HR:2019:2006#rov-5.3');
	});

	it('can force the network, and tells a phone to open its Netwerk tab', () => {
		expect(
			buildBronHref(at('/explore?focus=articles/a'), 'articles/b', {
				keepMode: false,
				mode: 'graph'
			})
		).toBe('/explore?focus=articles/b&mode=netwerk&paneel=netwerk');
	});

	it('leaves the netwerk behind when asked, and in the werkplek keeps it', () => {
		const werkplek = at('/explore?focus=articles/a&mode=netwerk&netwerk=members/x');
		expect(buildBronHref(werkplek, 'articles/b', { keepNetwerk: false })).toBe(
			'/explore?focus=articles/b&mode=netwerk'
		);
		expect(buildBronHref(werkplek, 'articles/b')).toBe(
			'/explore?focus=articles/b&mode=netwerk&netwerk=members/x'
		);
	});

	it('reads a bron without the netwerk: Back brings the werkplek back (besluit 39)', () => {
		const werkplek = at('/explore?focus=articles/a&mode=netwerk&netwerk=members/x&uit=members/x');
		expect(buildOpenHref(werkplek, 'articles/b')).toBe('/explore?focus=articles/b');
	});

	it('carries extra params, such as the peildatum of the law it was opened from', () => {
		expect(
			buildBronHref(at('/'), 'articles/bwbr0001854_287', { params: { peildatum: '2015-01-01' } })
		).toBe('/explore?focus=articles/bwbr0001854_287&peildatum=2015-01-01');
	});
});

describe('buildOpenHref', () => {
	const netwerk = at('/explore?focus=documents/a&mode=netwerk');

	it('opens every bron in Tekst, also from the canvas', () => {
		expect(buildOpenHref(netwerk, 'documents/kst-36764-3')).toBe(
			'/explore?focus=documents/kst-36764-3'
		);
		expect(buildOpenHref(at('/'), 'documents/kst-36764-3', { at: 'p-2' })).toBe(
			'/explore?focus=documents/kst-36764-3#p-2'
		);
		expect(buildOpenHref(netwerk, 'articles/b')).toBe('/explore?focus=articles/b');
		expect(buildOpenHref(netwerk, 'decisions/d')).toBe('/stemmingen/d');
	});
});

describe('indexHref', () => {
	it('names a list in Bladeren with its filters', () => {
		expect(indexHref('dossiers')).toBe('/explore?mode=index&kind=dossiers');
		expect(indexHref('ministers', { kabinet: 'rutte_iv' })).toBe(
			'/explore?mode=index&kind=ministers&kabinet=rutte_iv'
		);
	});
});

describe('exploreMode', () => {
	it.each([
		['', 'graph'],
		['mode=index', 'index'],
		['mode=index&focus=articles/a_1', 'index'],
		// Every bron opens in Tekst (besluit 32); the werkplek is ?mode=netwerk (besluit 39).
		['focus=articles/a_1', 'read'],
		['focus=judgments/ecli_nl_hr_2019_1', 'read'],
		['focus=annexes/bwbr0052872_annex_1', 'read'],
		['focus=members/m1', 'read'],
		['focus=members/m1&mode=netwerk', 'graph'],
		['focus=members/m1&netwerk=articles/a_1', 'read'],
		['focus=members/m1&mode=netwerk&tabel=1', 'read'],
		['tabel=1', 'graph'],
		['mode=netwerk', 'graph']
	])('?%s is %s', (query, mode) => {
		expect(exploreMode(new URLSearchParams(query))).toBe(mode);
	});
});

describe('modeOf', () => {
	it.each([
		['/explore', 'graph'],
		['/explore?mode=index', 'index'],
		['/explore?mode=index&kind=judgments', 'index'],
		['/explore?focus=articles/a_1', 'read'],
		['/dossiers/36799', 'read'],
		['/dossiers/36799?mode=netwerk', 'graph'],
		['/uitspraken/ECLI:NL:HR:2019:1', 'read'],
		['/actueel', null],
		['/', null]
	])('%s is %s', (path, mode) => {
		expect(modeOf(new URL(path, 'https://concordans.nl'))).toBe(mode);
	});
});

describe('hasFocus', () => {
	// The page of a bron is one of the bronnen in the menu, not Samenhang (B27).
	it.each([
		['/dossiers/36799', true],
		['/leden/rob-jetten', true],
		['/explore?focus=articles/a_1', true],
		['/explore', false],
		['/explore?netwerk=a', false],
		['/actueel', false]
	])('%s is %s', (path, bron) => {
		expect(hasFocus(new URL(path, 'https://concordans.nl'))).toBe(bron);
	});
});

describe('the id a link names', () => {
	/** Every bron the fixtures' answers name with its id beside its collection and key. */
	function* bronnen(value: unknown): Generator<{ id: string; collection: string; key: string }> {
		if (!value || typeof value !== 'object') return;
		if (Array.isArray(value)) {
			for (const v of value) yield* bronnen(v);
			return;
		}
		const { id, collection, key } = value as Record<string, unknown>;
		if (typeof id === 'string' && typeof key === 'string' && typeof collection === 'string')
			yield { id, collection, key };
		for (const v of Object.values(value)) yield* bronnen(v);
	}
	const dir = fileURLToPath(new URL('../fixtures/', import.meta.url));
	const files = [
		...readdirSync(dir).filter((f) => f.endsWith('.json')),
		...readdirSync(`${dir}verbonden`).map((f) => `verbonden/${f}`)
	];
	const found = files.flatMap((f) => [...bronnen(JSON.parse(readFileSync(dir + f, 'utf8')))]);

	it('is the id the API gives, for every bron but a dossier', () => {
		expect(found.length).toBeGreaterThan(100);
		for (const b of found) {
			if (!isCollection(b.collection) || b.collection === 'dossiers') continue;
			expect(focusOf(refOf(b.collection, b.key)), b.id).toBe(b.id);
		}
	});
});

describe('the ref of a dossier', () => {
	it('keeps its suffix, from its label or from its number and suffix (F110)', () => {
		expect(refOf('dossiers', '36600_vii', { number: '36600', suffix: 'VII' })).toEqual({
			collection: 'dossiers',
			key: '36600_vii',
			number: '36600-VII'
		});
		expect(refOf('dossiers', '36600_vii', { label: '36600-VII' }).collection).toBe('dossiers');
	});
});

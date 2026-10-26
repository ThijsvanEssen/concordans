// The first paint of a Kamerstuk: the elements and words of DocumentReader, rendered here beside
// it on the same answers (an amendement with its indieners, headings and what it replaces); the
// band as the app's (behoort); what it leaves to the app.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeGraph } from '$lib/api/nodes';
import { fakeApi } from '$lib/test/fakeApi';
import { open } from '$lib/test/navigation.svelte';
import fixture from '$lib/test/paper-paint.json';
import voted from '$lib/test/paper-vote-paint.json';
import { zetOpen } from '$lib/components/ui/dicht.svelte';
import DocumentReader from '$lib/components/explore/readers/DocumentReader.svelte';
import { COMPONENTS, type Classes } from './classes';
import { frame } from './paint';
import { paperBandOf, PAPERS_SOURCE, paperPaint, type PaperPaint } from './paper';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

/** Each component's class as the build would give it, here its own name. */
const K = Object.fromEntries(Object.keys(COMPONENTS).map((n) => [n, `K-${n}`])) as Classes;

const light = fixture.light as unknown as NodeGraph;
const PAINT = {
	kind: 'paper',
	document: fixture.document,
	whole: true,
	section_count: fixture.document.sections.length,
	numbers: [],
	light
} as unknown as PaperPaint;

const parse = (v: PaperPaint) => {
	const col = paperPaint(v, K);
	return new DOMParser().parseFromString(col ? frame(col.html, K, col.contents) : '', 'text/html');
};

/** The words of an element, text by text: the white space between its elements is the
 *  template's. */
function words(el: Element): string {
	const texts: string[] = [];
	const walk = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	for (let n = walk.nextNode(); n; n = walk.nextNode()) {
		const t = n.textContent!.replace(/\s+/g, ' ').trim();
		if (t) texts.push(t);
	}
	return texts.join(' ');
}

/** An element as the reader sets it: its tag, its classes but the scoping ones, its words. */
const shape = (el: Element) => [
	el.tagName,
	[...el.classList].filter((c) => !c.startsWith('K-') && !c.startsWith('svelte-')).join(' '),
	words(el)
];

async function settle() {
	for (let i = 0; i < 20; i++) {
		await new Promise((r) => setTimeout(r, 0));
		await tick();
	}
}

beforeEach(() => {
	open(`/kamerstukken/36496/46`);
	fakeApi({
		'/api/documents/{key}': fixture.document,
		'/api/nodes/{collection}/{key}': { ...light, node: { ...light.node, id: 'documents/x' } }
	});
});
afterEach(() => vi.restoreAllMocks());

describe('the first paint of a Kamerstuk', () => {
	it('sets the title, the indieners and the text as DocumentReader does', async () => {
		const { container } = render(DocumentReader, { node: { key: fixture.light.node.key } });
		await settle();
		const painted = parse(PAINT).querySelector('.reader-frame__col')!;
		const parts = '.reader-title, .reader-onder, .r-document > .body > :not([aria-hidden])';
		const paint = [...painted.querySelectorAll(parts)].map(shape);
		const app = [...container.querySelectorAll(parts)].map(shape).slice(0, paint.length);
		expect(paint.length).toBeGreaterThan(4);
		expect(paint).toEqual(app);
		// The status: its citation and what it replaces, in the reader's words.
		const status = (root: Element) => words(root.querySelector('.reader-status__woorden')!);
		expect(status(painted)).toBe(status(container));
	});

	it('sets the vote that settled it in the head as VoteLine does', async () => {
		fakeApi({
			'/api/documents/{key}': voted.document,
			'/api/nodes/{collection}/{key}': {
				...voted.light,
				node: { ...voted.light.node, id: 'documents/x' }
			}
		});
		const { container } = render(DocumentReader, { node: { key: voted.light.node.key } });
		await settle();
		const painted = parse({
			...PAINT,
			document: voted.document,
			section_count: voted.document.sections.length,
			light: voted.light as unknown as NodeGraph
		} as unknown as PaperPaint).querySelector('.reader-frame__col')!;
		const parts =
			'.reader-rijen .vote-line > *, .reader-title, .r-document > .body > :not([aria-hidden])';
		const paint = [...painted.querySelectorAll(parts)].map(shape);
		const app = [...container.querySelectorAll(parts)].map(shape).slice(0, paint.length);
		expect(paint.some(([, c]) => c === 'side')).toBe(true);
		expect(paint).toEqual(app);
	});

	it('names the band as the app does', async () => {
		const { behoort } = await import('$lib/bron/behoort');
		const props = fixture.light.node.props as Record<string, unknown>;
		const band = behoort('documents', props, light);
		const [lines] = paperBandOf(PAINT, String(props.kind ?? ''));
		expect(lines).toEqual(
			band.regels.map((r) => ({
				term: r.label,
				layers: r.lagen.map((l) => ({ name: l.naam, short: l.kort, link: !!l.ref }))
			}))
		);
		const { sourceOfCollection } = await import('$lib/nav/sources');
		expect(PAPERS_SOURCE).toBe(sourceOfCollection('documents').label);
	});

	it('sets a second vote on it and what a memorie explains as the headings of sections, as the reader does', async () => {
		const [vote] = voted.document.decisions;
		const document = {
			...voted.document,
			decisions: [{ ...vote, key: 'earlier' }, vote],
			explains: [
				{
					collection: 'articles',
					key: 'bwbr0005537_1_1',
					bwb_id: 'BWBR0005537',
					article_number: '1:1'
				}
			]
		};
		fakeApi({
			'/api/documents/{key}': document,
			'/api/nodes/{collection}/{key}': {
				...voted.light,
				node: { ...voted.light.node, id: 'documents/x' }
			},
			'/api/instruments/{identifier}': { bwb_id: 'BWBR0005537', citation_title: 'Awb' },
			'/api/instruments': { items: [] }
		});
		const paperPaint = {
			...PAINT,
			document,
			light: voted.light as unknown as NodeGraph
		} as unknown as PaperPaint;
		const sections = '.r-document > section';
		const heads = '.r-document > section > .kop, .r-document > .body > :not([aria-hidden])';
		// Open until the reader closes it: the heading stands where the app draws it, its rows
		// are the app's.
		const open = render(DocumentReader, { node: { key: voted.light.node.key } });
		await settle();
		const painted = parse(paperPaint).querySelector('.reader-frame__col')!;
		const paint = [...painted.querySelectorAll(heads)].map(shape);
		expect(paint.filter(([tag]) => tag === 'H2').map(([, , w]) => w)).toEqual([
			'Licht toe 1',
			'Stemming'
		]);
		expect(paint).toEqual(
			[...open.container.querySelectorAll(heads)].map(shape).slice(0, paint.length)
		);
		expect(painted.querySelectorAll(`${sections} .caret.is-side`)).toHaveLength(0);
		open.unmount();
		// Closed in this browser: the whole section is the paint's, as the app draws it.
		zetOpen('Licht toe', false);
		zetOpen('Stemming', false);
		vi.stubGlobal('localStorage', {
			getItem: (key: string) =>
				key === 'concordans:kopjes' ? JSON.stringify({ 'Licht toe': false, Stemming: false }) : null
		});
		const closed = render(DocumentReader, { node: { key: voted.light.node.key } });
		await settle();
		const dicht = parse(paperPaint).querySelector('.reader-frame__col')!;
		const parts = '.r-document > section, .r-document > .body > :not([aria-hidden])';
		const shut = [...dicht.querySelectorAll(parts)].map(shape);
		expect(shut.filter(([tag]) => tag === 'SECTION').map(([, , w]) => w)).toEqual([
			'Licht toe 1',
			'Stemming'
		]);
		expect(shut).toEqual(
			[...closed.container.querySelectorAll(parts)].map(shape).slice(0, shut.length)
		);
		vi.unstubAllGlobals();
		zetOpen('Licht toe', true);
		zetOpen('Stemming', true);
	});

	it('leaves to the app a text without its alineas', () => {
		expect(paperPaint({ ...PAINT, document: { ...PAINT.document, text: null } }, K)).toBeNull();
		expect(paperPaint(PAINT, K)?.contents).toBe(PAINT.section_count >= 2);
	});
});

describe('the classes of the paint of a Kamerstuk', () => {
	// The amendement with the vote that settled it, an earlier vote and what it explains: its
	// head, its vote, its closed sections, its text.
	const doc = parse({
		...PAINT,
		document: {
			...voted.document,
			decisions: [{ ...voted.document.decisions[0], key: 'earlier' }, ...voted.document.decisions],
			explains: [{ collection: 'articles', key: 'a', bwb_id: 'B', article_number: '1' }]
		},
		light: voted.light as unknown as NodeGraph
	} as unknown as PaperPaint);
	it.each(Object.keys(COMPONENTS) as (keyof typeof COMPONENTS)[])('%s', (name) => {
		const own = readFileSync(join(process.cwd(), COMPONENTS[name]), 'utf8');
		const classes = new Set(
			[...doc.querySelectorAll(`.K-${name}`)].flatMap((el) =>
				[...el.classList].filter((c) => !c.startsWith('K-') && !c.startsWith('ev-'))
			)
		);
		for (const c of classes) {
			const base = c.replace(/--[a-z-]+$/, '--');
			const numbered = c.replace(/\d+$/, '{');
			expect(
				own.includes(c) || own.includes(`${base}{`) || own.includes(numbered),
				`${c} in ${COMPONENTS[name]}`
			).toBe(true);
		}
	});
});

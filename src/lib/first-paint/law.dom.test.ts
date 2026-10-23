// The first paint of a law: the elements and words of WholeLawReader, rendered here beside it
// on the same answers (the Awb, its first articles); the band as the app's; what it leaves to
// the app.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeGraph } from '$lib/api/nodes';
import { fakeApi } from '$lib/test/fakeApi';
import { open } from '$lib/test/navigation.svelte';
import fixture from '$lib/test/law-paint.json';
import WholeLawReader from '$lib/components/explore/WholeLawReader.svelte';
import { COMPONENTS, type Classes } from './classes';
import { lawPaint, type LawPaint } from './law';
import { frame } from './paint';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

/** Each component's class as the build would give it, here its own name. */
const K = Object.fromEntries(Object.keys(COMPONENTS).map((n) => [n, `K-${n}`])) as Classes;

const PAINT = {
	kind: 'law',
	bwb_id: 'BWBR0005537',
	instrument: fixture.instrument,
	total: fixture.articles.total,
	annexes: 0,
	articles: fixture.articles.items,
	texts: fixture.at.items,
	basis: fixture.basis.items,
	light: fixture.light as unknown as NodeGraph
} as unknown as LawPaint;

const parse = (v: LawPaint) => {
	const col = lawPaint(v, K);
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
	[...el.classList]
		.filter((c) => !c.startsWith('K-') && !c.startsWith('svelte-') && c !== 'is-landed')
		.join(' '),
	words(el)
];

async function settle() {
	for (let i = 0; i < 20; i++) {
		await new Promise((r) => setTimeout(r, 0));
		await tick();
	}
}

beforeEach(() => {
	// An article asks its references once it comes near the viewport: here none does.
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			observe() {}
			disconnect() {}
		}
	);
	open('/wetten/BWBR0005537');
	fakeApi({
		'/api/instruments/{identifier}': fixture.instrument,
		'/api/instruments/{bwb_id}/articles': fixture.articles,
		'/api/instruments/{bwb_id}/articles/at/{at_date}': fixture.at,
		'/api/instruments/{bwb_id}/versions': { items: [] },
		'/api/instruments/{bwb_id}/basis': fixture.basis,
		'/api/instruments': { items: [] }
	});
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('the first paint of a law', () => {
	it('sets the title, the official title, the divisions and the articles as WholeLawReader does', async () => {
		const { container } = render(WholeLawReader, { bwbId: 'BWBR0005537' });
		await settle();
		const painted = parse(PAINT).querySelector('.reader-frame__col')!;
		const parts = '.reader-title, .reader-onder, .whole-section, .whole-article';
		const paint = [...painted.querySelectorAll(parts)].map(shape);
		const app = [...container.querySelectorAll(parts)].map(shape).slice(0, paint.length);
		expect(paint.length).toBeGreaterThan(4);
		expect(paint).toEqual(app);
		// The text of an article as ArticleText sets it.
		const lid = (root: Element) => [...root.querySelectorAll('.whole-article .lid')].map(shape);
		expect(lid(painted)).toEqual(lid(container).slice(0, lid(painted).length));
	});

	it('leaves to the app an article whose text it does not set: one asked alone, a table', () => {
		const all = parse(PAINT).querySelectorAll('.whole-article').length;
		const [first, second] = PAINT.texts;
		const without = { ...PAINT, texts: [first] } as LawPaint;
		expect(parse(without).querySelectorAll('.whole-article').length).toBe(1);
		const table = {
			...PAINT,
			texts: [first, { ...second, tables: [{ start: 0, end: 1, rows: [] }] }]
		} as unknown as LawPaint;
		expect(parse(table).querySelectorAll('.whole-article').length).toBe(1);
		expect(all).toBe(PAINT.articles.length);
		expect(lawPaint({ ...PAINT, texts: [] }, K)).toBeNull();
	});

	it('stands beside its contents where the law has more than one article', () => {
		expect(lawPaint(PAINT, K)?.contents).toBe(true);
		expect(
			lawPaint({ ...PAINT, total: 1, articles: PAINT.articles.slice(0, 1) }, K)?.contents
		).toBe(false);
	});
});

describe('the classes of the paint of a law', () => {
	// Each class the paint sets on an element of a component stands in that component.
	const doc = parse(PAINT);
	it.each(Object.keys(COMPONENTS) as (keyof typeof COMPONENTS)[])('%s', (name) => {
		const own = readFileSync(join(process.cwd(), COMPONENTS[name]), 'utf8');
		const classes = new Set(
			[...doc.querySelectorAll(`.K-${name}`)].flatMap((el) =>
				[...el.classList].filter((c) => !c.startsWith('K-') && !c.startsWith('ev-'))
			)
		);
		for (const c of classes) {
			const base = c.replace(/--[a-z-]+$/, '--');
			// A modifier with a number from the template (`whole-section--depth-{…}`).
			const numbered = c.replace(/\d+$/, '{');
			expect(
				own.includes(c) || own.includes(`${base}{`) || own.includes(numbered),
				`${c} in ${COMPONENTS[name]}`
			).toBe(true);
		}
	});
});

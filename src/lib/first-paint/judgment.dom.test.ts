// The first paint of a judgment: the elements and words of JudgmentReader, rendered here beside
// it on the same answer; the band as the app's (behoort) with the instances it asks; what it
// leaves to the app.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GraphNode } from '$lib/graph/types';
import type { NodeGraph } from '$lib/api/nodes';
import { fakeApi } from '$lib/test/fakeApi';
import { open } from '$lib/test/navigation.svelte';
import fixture from '$lib/test/judgment.json';
import partiesFixture from '$lib/test/judgment-parties.json';
import JudgmentReader from '$lib/components/explore/readers/JudgmentReader.svelte';
import { COMPONENTS, type Classes } from './classes';
import { bandOf, judgmentColumn, JUDGMENTS_SOURCE, type JudgmentPaint } from './judgment';
import { frame } from './paint';

vi.mock('$app/state', async () => (await import('$lib/test/navigation.svelte')).appState);
vi.mock('$app/navigation', async () => (await import('$lib/test/navigation.svelte')).appNavigation);

/** The light nodes the band asks for the instances before an eerdere aanleg. */
const LIGHTS = new Map<string, NodeGraph>();
vi.mock('$lib/api/records', async (original) => ({
	...(await original<typeof import('$lib/api/records')>()),
	getNodeFirst: async (_: string, key: string) => LIGHTS.get(key) ?? null
}));

/** Each component's class as the build would give it, here its own name. */
const K = Object.fromEntries(Object.keys(COMPONENTS).map((n) => [n, `K-${n}`])) as Classes;

// Rb. Rotterdam, a herstelbeschikking: its connected case left out (the paint leaves those
// judgments to the app), its parties as the API reads them (HR:2025:1319).
const judgment = {
	...fixture.detail.judgment,
	parties: partiesFixture['ECLI:NL:HR:2025:1319']
} as unknown as JudgmentPaint['judgment'];
const detail = { ...fixture.detail, judgment, related_to: [] };
const EMPTY = { node: { props: {} }, neighbors: { buckets: [] } } as unknown as NodeGraph;
const PAINT: JudgmentPaint = {
	kind: 'judgment',
	judgment,
	whole: true,
	numbers: [],
	same_as: [],
	conclusions: [],
	completeness: null,
	light: EMPTY,
	chain: []
};

const parse = (v: JudgmentPaint) => {
	const col = judgmentColumn(v, K);
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
	for (let i = 0; i < 10; i++) {
		await new Promise((r) => setTimeout(r, 0));
		await tick();
	}
}

beforeEach(() => {
	open(`/uitspraken/${judgment.ecli}`);
	fakeApi({ '/api/judgments/{ecli}': detail, '/api/nodes/{collection}/{key}': EMPTY });
});
afterEach(() => {
	vi.restoreAllMocks();
	LIGHTS.clear();
});

describe('the first paint of a judgment', () => {
	it('sets the title, the summary, the parties and the text as JudgmentReader does', async () => {
		const { container } = render(JudgmentReader, {
			node: {
				id: judgment.id,
				collection: 'judgments',
				key: judgment.key,
				drawClass: 'judgment',
				label: judgment.display_name ?? '',
				raw: judgment as unknown as GraphNode['raw']
			}
		});
		await settle();
		const painted = parse(PAINT).querySelector('.reader-frame__col')!;
		const parts = '.reader-title, .reader-summary-para, .reader-parties tr, .reader-body > *';
		const paint = [...painted.querySelectorAll(parts)].map(shape);
		const app = [...container.querySelectorAll(parts)].map(shape).slice(0, paint.length);
		expect(paint.length).toBeGreaterThan(4);
		expect(paint).toEqual(app);
		// The number of an overweging is its menu, in the margin of the numbers.
		const number = painted.querySelector('.reader-para-num > button.plaats-nummer.K-placeNumber');
		expect(number?.textContent).toBe('2.1');
	});

	it('names the band as the app does, with the instances before its eerdere aanleg', async () => {
		const neighbor = (key: string, relation: string, direction: string, name: string) => ({
			id: `judgments/${key}`,
			key,
			collection: 'judgments',
			type: 'judgment',
			display_name: name,
			props: { court: name, date: '2024-01-01' },
			cite: { short: name, full: `${name}, ECLI` },
			relation,
			direction,
			meta: relation === 'APPEAL_OF' ? { procedure_type: 'Cassatie' } : {}
		});
		const bucket = (
			relation: string,
			direction: string,
			items: unknown[],
			total = items.length
		) => ({
			relation,
			direction,
			collection: 'judgments',
			total,
			items
		});
		const hof = neighbor('ecli_nl_ghdha_2018_1', 'APPEAL_OF', 'outbound', 'Hof Den Haag');
		const rb = neighbor('ecli_nl_rbdha_2015_1', 'APPEAL_OF', 'outbound', 'Rb. Den Haag');
		const arrest = neighbor('ecli_nl_hr_2019_1', 'ADVISES_ON', 'outbound', 'HR 2019');
		const later = neighbor('ecli_nl_hr_2020_1', 'APPEAL_OF', 'inbound', 'HR 2020');
		const light = {
			node: { props: { outcome: 'verworpen' } },
			neighbors: {
				buckets: [
					bucket('APPEAL_OF', 'outbound', [hof]),
					bucket('APPEAL_OF', 'inbound', [later], 2),
					bucket('ADVISES_ON', 'outbound', [arrest])
				]
			}
		} as unknown as NodeGraph;
		LIGHTS.set(hof.key, {
			...EMPTY,
			neighbors: { buckets: [bucket('APPEAL_OF', 'outbound', [rb])] }
		} as never);
		const v = { ...PAINT, light, chain: [rb] } as unknown as JudgmentPaint;

		const { behoort } = await import('$lib/bron/behoort');
		const band = behoort('judgments', light.node.props as Record<string, unknown>, light);
		const lines = await Promise.all(
			band.regels.map(async (r) => ({
				term: r.label,
				layers: (r.laad ? await r.laad() : r.lagen).map((l) => ({
					name: l.naam,
					short: l.kort,
					link: !!l.ref,
					outcome: l.uitkomst,
					current: l.huidig
				}))
			}))
		);
		const [painted, o] = bandOf(v);
		expect(painted).toEqual(lines);
		expect(painted.map((l) => l.layers.length)).toEqual([1, 4]);
		expect(o.groups).toEqual(band.onder.map((g) => ({ label: g.label, count: g.aantal })));
		expect(o.more).toBe('Meer');
	});

	it('leaves to the app what only it sets: notes, tables, a heading over what is cut', () => {
		const paragraphs = judgment.paragraphs!;
		const rovs = parse(PAINT).querySelectorAll('.reader-para-block').length;
		// A note in the second overweging: the paint stops before it.
		const second = paragraphs.findIndex((p) => p.number === '2.2');
		const noted = {
			...PAINT,
			judgment: {
				...judgment,
				footnotes: [
					{
						id: 'fn1',
						label: '1',
						paragraph_id: paragraphs[second].paragraph_id,
						at: 3,
						text: 'Noot.'
					}
				]
			}
		} as unknown as JudgmentPaint;
		expect(parse(noted).querySelectorAll('.reader-para-block').length).toBeLessThan(rovs);
		// The first part of a longer one: a heading at its end goes with what follows it.
		const cut = {
			...PAINT,
			whole: false,
			judgment: {
				...judgment,
				paragraphs: [...paragraphs, { paragraph_id: 'h', kind: 'heading', text: 'Beslissing' }]
			}
		} as unknown as JudgmentPaint;
		expect(parse(cut).body.textContent).not.toContain('Beslissing');
		// Without the parties the API reads, the app reads them from a text the paint has not.
		expect(judgmentColumn({ ...PAINT, judgment: { ...judgment, parties: null } }, K)).toBeNull();
	});

	it('stands beside its contents where the reader lists two or more', () => {
		expect(judgmentColumn(PAINT, K)?.contents).toBe(true);
		const one = {
			...PAINT,
			whole: false,
			judgment: {
				...judgment,
				summary: null,
				parties: [],
				paragraphs: judgment.paragraphs!.slice(0, 1)
			}
		} as unknown as JudgmentPaint;
		// Of a first part with fewer, the rest is unknown: no paint.
		expect(judgmentColumn(one, K)).toBeNull();
	});

	it('names the source of the band as the app does', async () => {
		const { sourceOfCollection } = await import('$lib/nav/sources');
		expect(JUDGMENTS_SOURCE).toBe(sourceOfCollection('judgments').label);
	});
});

/** The components that give a component classes of theirs. */
const GIVEN_BY: Partial<Record<keyof typeof COMPONENTS, (keyof typeof COMPONENTS)[]>> = {
	citeMenu: ['judgment']
};

describe('the classes of the paint of a judgment', () => {
	// Each class the paint sets on an element of a component stands in that component.
	const doc = parse({
		...PAINT,
		completeness: { references: { state: 'partial', missing: 2 } } as never
	});
	it.each(Object.keys(COMPONENTS) as (keyof typeof COMPONENTS)[])('%s', (name) => {
		// A class a component is given (CiteMenu's `buttonClass`) stands in the one that gives it.
		const own = [name, ...(GIVEN_BY[name] ?? [])]
			.map((n) => readFileSync(join(process.cwd(), COMPONENTS[n]), 'utf8'))
			.join('\n');
		const classes = new Set(
			[...doc.querySelectorAll(`.K-${name}`)].flatMap((el) =>
				[...el.classList].filter((c) => !c.startsWith('K-') && !c.startsWith('ev-'))
			)
		);
		for (const c of classes) {
			const base = c.replace(/--[a-z-]+$/, '--');
			expect(own.includes(c) || own.includes(`${base}{`), `${c} in ${COMPONENTS[name]}`).toBe(true);
		}
	});
});

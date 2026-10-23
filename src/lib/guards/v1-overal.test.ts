// The pattern of besluit 32 holds for every kind of bron with a page (A159): it opens in Tekst,
// its Verbonden is the summary per soort (the counts and the three to read), and the network
// is drawn on request. One shared frame, a core per kind; a kind that falls outside it fails
// here, not in the browser. The browser half is e2e/reizen/v1-alle-soorten.spec.ts.
import { describe, expect, it } from 'vitest';
import { isKernGroep, isInhoudGroep } from '$lib/bron/behoort';
import { buildBronHref, modeOf } from '$lib/bron/href';
import { GROUPS } from '$lib/verbonden/groups';
import { importanceOf } from '$lib/verbonden/importance';
import { NODE_TYPES, type Collection } from '$lib/vocabulary';

/** The kinds of bron that have a page of their own; a version is read through its article or law. */
// A ministry is a node since API 0.80.8, with no page of its own on the site yet.
const WITH_PAGE = (Object.keys(NODE_TYPES) as Collection[]).filter(
	(c) => c !== 'instrument_versions' && c !== 'article_versions' && c !== 'ministries'
);

/**
 * The groups whose order is not ranked here, and why: the API orders the rows it sends (a
 * loader asks for the newest, the most cited, the largest first), or the order itself says
 * something (a course of readings, the votes by their choice), or the group holds one bron.
 * Every group of GROUPS is in this table or in IMPORTANCE (importance.ts); a group the
 * API does not rank is a follow-up of the API (docs/readers.md), not a rule of the front end.
 */
const API_ORDER: Partial<Record<Collection, readonly string[]>> = {
	dossiers: [
		'laws',
		'same-number',
		'first-reading',
		'second-reading',
		'revises',
		'revised-by',
		'accompanies',
		'accompanied-by',
		'related',
		'committees',
		'decisions',
		'international'
	],
	instruments: [
		'dossiers',
		'basis',
		'international',
		'amended-by',
		'proposals',
		'aard',
		'judgments',
		'published-in',
		'publishes'
	],
	articles: ['judgments', 'explanatory', 'changes', 'international'],
	judgments: [
		'same-as',
		'answers',
		'answered',
		'continues',
		'continued',
		'referred-by',
		'referred-to',
		'related'
	],
	documents: [
		'same-case',
		'answers',
		'answered-by',
		'fulfils',
		'changes',
		'authors',
		'attachments'
	],
	committees: ['dossiers', 'activities'],
	members: ['dossiers', 'instruments'],
	factions: ['dossiers', 'instruments'],
	decisions: ['subject', 'votes'],
	activities: ['decisions', 'records', 'motions', 'commitments', 'cases'],
	commitments: ['fulfilled-by'],
	ministries: ['laws', 'dossiers', 'commitments'],
	cases: ['authors', 'related'],
	annexes: ['scoped-by']
};

describe('every kind of bron with a page follows the pattern of Verbonden (A159, besluit 32)', () => {
	it('has groups in Verbonden, so the page has a summary per soort', () => {
		expect(WITH_PAGE.filter((c) => !GROUPS[c]?.length)).toEqual([]);
	});

	it('opens in Tekst, whatever the kind: a link names no network', () => {
		for (const c of WITH_PAGE) {
			const key = c === 'dossiers' ? '36496' : 'x';
			const ref = c === 'dossiers' ? { collection: c, key, number: key } : { collection: c, key };
			const href = buildBronHref(null, ref as never);
			expect(href, c).not.toMatch(/mode=netwerk/);
			// A bron without a readable address stays under /explore?focus=, also in Tekst.
			expect(modeOf(new URL(href, 'https://concordans.nl')), c).toBe('read');
		}
	});

	it('orders the three a group shows by one rule or says that the API does', () => {
		const unclassified: string[] = [];
		const doubled: string[] = [];
		for (const [c, groups] of Object.entries(GROUPS) as [
			Collection,
			NonNullable<(typeof GROUPS)[Collection]>
		][]) {
			for (const g of groups) {
				if (isKernGroep(c, g) || isInhoudGroep(c, g)) continue;
				const ranked = !!importanceOf(c, g.id);
				const api = !!API_ORDER[c]?.includes(g.id);
				if (!ranked && !api) unclassified.push(`${c}/${g.id}`);
				if (ranked && api) doubled.push(`${c}/${g.id}`);
			}
		}
		expect(unclassified).toEqual([]);
		expect(doubled).toEqual([]);
	});

	it('names no group in API_ORDER that does not exist', () => {
		const exists = (c: Collection, id: string) => GROUPS[c]?.some((g) => g.id === id);
		const missing = Object.entries(API_ORDER).flatMap(([c, ids]) =>
			ids!.filter((id) => !exists(c as Collection, id)).map((id) => `${c}/${id}`)
		);
		expect(missing).toEqual([]);
	});
});

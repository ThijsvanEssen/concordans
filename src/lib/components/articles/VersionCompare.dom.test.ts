import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { fakeApi, type FakeRequest } from '$lib/test/fakeApi';
import type { Schema } from '$lib/api/types';
import VersionCompare from './VersionCompare.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));

type Listed = Schema<'ArticleVersionListedDTO'>;

/** An IntersectionObserver the test drives by hand: `fire(i)` brings element i into view. */
function observers() {
	const made: { el: Element | null; fire: () => void }[] = [];
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			disconnect = vi.fn();
			entry: { el: Element | null; fire: () => void };
			constructor(cb: IntersectionObserverCallback) {
				this.entry = {
					el: null,
					fire: () => cb([{ isIntersecting: true } as IntersectionObserverEntry], this as never)
				};
				made.push(this.entry);
			}
			observe(el: Element) {
				this.entry.el = el;
			}
		}
	);
	return made;
}

afterEach(() => vi.unstubAllGlobals());

const VERSIONS = 66;
const lidChange = { change: 'changed', kind: 'lid', number: '1', term: null } as const;

/** 66 versions, each a new wording of lid 1, as the history lists them: no text. */
const versions = Array.from(
	{ length: VERSIONS },
	(_, i): Listed =>
		({
			key: `v${i}`,
			valid_from: `${1950 + i}-01-01`,
			valid_until: i === VERSIONS - 1 ? null : `${1951 + i}-01-01`,
			current: i === VERSIONS - 1,
			text_changed: true,
			changes: i === 0 ? [] : [lidChange]
		}) as unknown as Listed
);

/** One version with its text: lid 1 names the year it took effect. */
const full = (r: FakeRequest) => {
	const key = String(r.params.path?.version_key);
	const text = `In ${1950 + Number(key.slice(1))} geldt dit.`;
	return {
		...versions.find((v) => v.key === key),
		text: `1. ${text}`,
		parts: [{ id: 'lid-1', kind: 'lid', number: '1', start: 3, end: 3 + text.length, text }],
		tables: []
	};
};

const ROUTE = '/api/articles/{bwb_id}/{article_number}/history/{version_key}';

const show = (param: string) =>
	render(VersionCompare, {
		props: {
			versions,
			bwbId: 'BWBR0001840',
			articleNumber: '23',
			param,
			link: () => '#',
			go: () => {}
		}
	});

describe('VersionCompare: the texts it asks', () => {
	it('asks the text of the two versions it compares, no other', async () => {
		observers();
		const { asked } = fakeApi({ [ROUTE]: full });
		const { container } = show('');
		await vi.waitFor(() =>
			expect(container.querySelector('.compare .text')?.textContent).toMatch(/2014.*2015 geldt/)
		);
		expect(asked(ROUTE).map((p) => p.path?.version_key)).toEqual(['v64', 'v65']);
		expect(asked(ROUTE).every((p) => p.path?.bwb_id === 'BWBR0001840')).toBe(true);
	});

	it('asks the formulations of a lid as they come into view, each once', async () => {
		const made = observers();
		const { asked } = fakeApi({ [ROUTE]: full });
		const { container } = show('lid-1');
		await tick();
		const keys = () => asked(ROUTE).map((p) => p.path?.version_key);
		// Before anything is in view, at most the two of the comparison behind it.
		expect(keys().filter((k) => !['v64', 'v65'].includes(String(k)))).toEqual([]);
		const items = made.filter((m) => m.el?.closest('.formulation'));
		expect(items).toHaveLength(VERSIONS);
		// The third formulation comes into view: its text and the one before it, to mark.
		items[2].fire();
		await vi.waitFor(() =>
			expect(
				container.querySelectorAll('.formulation')[2]?.querySelector('.text')?.textContent
			).toMatch(/1951.*1952 geldt/)
		);
		expect(keys()).toEqual(expect.arrayContaining(['v1', 'v2']));
		expect(new Set(keys()).size).toBe(keys().length);
		expect(keys().length).toBeLessThanOrEqual(4);
	});
});

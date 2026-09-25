import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/state', () => ({ page: { url: new URL('http://x/') } }));

import { buildBronHref, refOf } from './href';

const at = (path: string) => new URL(`http://localhost${path}`);

describe('buildBronHref', () => {
	it('opens a bron to read from outside the Verkenner', () => {
		expect(buildBronHref(at('/'), 'articles/bwbr0001854_287')).toBe(
			'/explore?focus=articles/bwbr0001854_287&lezen=1'
		);
	});

	it('opens a bron without a text of its own in the network', () => {
		expect(buildBronHref(at('/'), 'dossiers/36327')).toBe('/explore?focus=dossiers/36327');
		expect(buildBronHref(at('/'), 'members/x')).toBe('/explore?focus=members/x');
	});

	it('names a dossier by its number, not its node key', () => {
		expect(
			buildBronHref(at('/'), { collection: 'dossiers', key: '37020_xv', number: '37020-XV' })
		).toBe('/explore?focus=dossiers/37020-XV');
		expect(buildBronHref(at('/'), refOf('dossiers', '37020_j', { label: '37020-J' }))).toBe(
			'/explore?focus=dossiers/37020-J'
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
		).toBe('/explore?focus=judgments/ecli_nl_hr_2024_1769&overlay=open');
	});

	it('keeps reading, also under the old name mode=read', () => {
		expect(buildBronHref(at('/explore?focus=articles/a&lezen=1'), 'judgments/j')).toBe(
			'/explore?focus=judgments/j&lezen=1'
		);
		expect(buildBronHref(at('/explore?mode=read&focus=articles/a'), 'articles/b')).toBe(
			'/explore?focus=articles/b&lezen=1'
		);
	});

	it('reads a bron that is opened from Bladeren', () => {
		expect(buildBronHref(at('/explore?mode=index&kind=judgments'), 'judgments/j')).toBe(
			'/explore?focus=judgments/j&lezen=1'
		);
	});

	it('carries the position as a fragment', () => {
		expect(buildBronHref(null, 'articles/bwbr0001903_27c', { at: 'lid-2' })).toBe(
			'/explore?focus=articles/bwbr0001903_27c&lezen=1#lid-2'
		);
	});

	it('can force the network', () => {
		expect(
			buildBronHref(at('/explore?focus=articles/a&lezen=1'), 'articles/b', {
				keepMode: false,
				mode: 'graph'
			})
		).toBe('/explore?focus=articles/b');
	});

	it('leaves the netwerk behind when asked', () => {
		expect(
			buildBronHref(at('/explore?focus=articles/a&netwerk=members/x'), 'articles/b', {
				keepNetwerk: false
			})
		).toBe('/explore?focus=articles/b');
	});
});

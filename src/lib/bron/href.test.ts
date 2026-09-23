import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/state', () => ({ page: { url: new URL('http://x/') } }));

import { buildBronHref, refOf } from './href';

const at = (path: string) => new URL(`http://localhost${path}`);

describe('buildBronHref', () => {
	it('opens a bron in Lezen from outside the explorer', () => {
		expect(buildBronHref(at('/'), 'dossiers/36327')).toBe(
			'/explore?mode=read&focus=dossiers/36327'
		);
	});

	it('names a dossier by its number, not its node key', () => {
		expect(
			buildBronHref(at('/'), { collection: 'dossiers', key: '37020_xv', number: '37020-XV' })
		).toBe('/explore?mode=read&focus=dossiers/37020-XV');
		expect(buildBronHref(at('/'), refOf('dossiers', '37020_j', { label: '37020-J' }))).toBe(
			'/explore?mode=read&focus=dossiers/37020-J'
		);
	});

	it('links nowhere for a dossier node without a label', () => {
		expect(buildBronHref(at('/'), refOf('dossiers', '37020_xv', {}))).toBe('/explore');
	});

	it('keeps the network mode and the overlay', () => {
		expect(
			buildBronHref(at('/explore?mode=graph&focus=articles/a&overlay=open&wet=x'), {
				collection: 'judgments',
				key: 'ecli_nl_hr_2024_1769'
			})
		).toBe('/explore?mode=graph&focus=judgments/ecli_nl_hr_2024_1769&overlay=open');
	});

	it('reads a bron that is opened from Bladeren', () => {
		expect(buildBronHref(at('/explore?mode=index&kind=dossiers'), 'dossiers/36327')).toBe(
			'/explore?mode=read&focus=dossiers/36327'
		);
	});

	it('carries the position as a fragment', () => {
		expect(buildBronHref(null, 'articles/bwbr0001903_27c', { at: 'lid-2' })).toBe(
			'/explore?mode=read&focus=articles/bwbr0001903_27c#lid-2'
		);
	});

	it('can force a mode', () => {
		expect(
			buildBronHref(at('/explore?mode=read'), 'dossiers/37020-XV', {
				keepMode: false,
				mode: 'graph'
			})
		).toBe('/explore?mode=graph&focus=dossiers/37020-XV');
	});
});

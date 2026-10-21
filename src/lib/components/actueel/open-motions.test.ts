import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import { dossierOf, openMotions } from './open-motions';

type Paper = Schema<'DocumentListItemDTO'>;
const paper = (key: string, date: string, over: Partial<Paper> = {}): Paper =>
	({
		key,
		date,
		outcome: null,
		motion_kind: 'no_confidence',
		path: null,
		dossier_number: '37020',
		dossier_suffix: null,
		...over
	}) as Paper;

describe('openMotions', () => {
	it('keeps the motions not yet voted on, newest first', () => {
		const r = openMotions([
			paper('a', '2026-10-01'),
			paper('b', '2026-10-15', { motion_kind: 'censure' }),
			paper('c', '2026-10-10', { outcome: 'verworpen' }),
			paper('d', '2026-10-12', { motion_kind: null })
		]);
		expect(r.map((p) => p.key)).toEqual(['b', 'a']);
	});

	it('names the dossier with its suffix', () => {
		expect(dossierOf({ dossier_number: '37020', dossier_suffix: 'XVI' })).toBe('37020-XVI');
		expect(dossierOf({ dossier_number: '29628', dossier_suffix: null })).toBe('29628');
		expect(dossierOf({ dossier_number: null, dossier_suffix: null })).toBeNull();
	});
});

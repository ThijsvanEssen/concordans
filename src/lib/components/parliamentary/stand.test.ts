import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import { stand } from './stand';

const dossier = (phases: { name: string; done: boolean }[], over: object = {}) =>
	({
		number: '36799',
		current_phase: 'Stemmingen',
		phases,
		...over
	}) as unknown as Schema<'DossierSummaryDTO'>;

describe('stand', () => {
	it('takes a phase as done only where the source marks it (BE-27)', () => {
		const d = dossier([
			{ name: 'Advies Raad van State', done: false },
			{ name: 'Verslag', done: true },
			{ name: 'Stemmingen', done: true }
		]);
		expect(stand(d)?.bodies[0].state).toBe('unknown');
	});

	it('gives the Raad van State its advice where the source has it', () => {
		const d = dossier([
			{ name: 'Advies Raad van State', done: true },
			{ name: 'Verslag', done: false }
		]);
		expect(stand(d)?.bodies[0].state).toBe('done');
	});
});

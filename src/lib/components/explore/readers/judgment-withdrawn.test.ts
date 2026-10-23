import { describe, expect, it } from 'vitest';
import { withdrawal as of } from './judgment-withdrawn';
import { langeDatum } from '$lib/text/datum';

const withdrawal = (j: Parameters<typeof of>[0]) => of(j, langeDatum);

const published = { withdrawn: null, withdrawn_on: null, replaced_by: null, replaced_by_id: null };

describe('a withdrawn judgment', () => {
	it('says the source withdrew it, and when', () => {
		expect(withdrawal({ ...published, withdrawn: 'doc', withdrawn_on: '2026-10-03' })).toEqual({
			text: 'Ingetrokken door de bron op 3\u00a0oktober\u00a02026',
			replacement: null
		});
		expect(withdrawal({ ...published, withdrawn: 'doc' })?.text).toBe('Ingetrokken door de bron');
	});

	it('says an ECLI given in error lapsed, with the one the source names instead', () => {
		expect(
			withdrawal({
				...published,
				withdrawn: 'ecli',
				withdrawn_on: '2026-10-03',
				replaced_by: 'ECLI:NL:RBAMS:2026:1235'
			})
		).toEqual({
			text: 'ECLI vervallen',
			replacement: { ecli: 'ECLI:NL:RBAMS:2026:1235', ref: 'judgments/ecli_nl_rbams_2026_1235' }
		});
		expect(withdrawal({ ...published, withdrawn: 'ecli' })?.replacement).toBeNull();
	});

	it('is nothing for a published judgment', () => {
		expect(withdrawal(published)).toBeNull();
	});
});

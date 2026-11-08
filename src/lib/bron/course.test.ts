import { describe, expect, it } from 'vitest';
import { fakeApi } from '$lib/test/fakeApi';
import { courseIdsOf, courseLine, translationLines } from './course';

const step = (ecli: string, current = false) => ({
	ecli,
	key: ecli.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
	court_code: null,
	court_name: 'Hoge Raad',
	tier: null,
	court_kind: null,
	date: '2019-12-20',
	procedure: null,
	decision_kind: 'arrest',
	outcome: null,
	area: null,
	basis: null,
	loaded: true,
	current,
	links: []
});
const HOF = 'ECLI:NL:GHDHA:2018:2591';
const HR = 'ECLI:NL:HR:2019:2006';
const course = { steps: [step(HOF), step(HR, true)], unresolved: [], truncated: false };

describe('the line Verloop', () => {
	it('is asked by the ECLI, and left out of a translation and without one', () => {
		expect(courseLine({ ecli: HR }).map((r) => [r.id, r.course])).toEqual([['verloop', HR]]);
		expect(courseLine({ ecli: 'ECLI:NL:HR:2019:2007', translation_of: HR })).toEqual([]);
		expect(courseLine({})).toEqual([]);
	});

	it('gives a translation its original’s, the original a link in its place', async () => {
		fakeApi({ '/api/judgments/{ecli}/course': course });
		const [, line] = translationLines({ translation_of: HR });
		const layers = await line.laad!(new AbortController().signal);
		expect(layers.map((l) => [l.soort, l.ref?.key])).toEqual([
			['Eerdere aanleg', 'ecli_nl_ghdha_2018_2591'],
			['Het origineel', 'ecli_nl_hr_2019_2006']
		]);
	});
});

describe('what Verbonden leaves out', () => {
	it('leaves out the other judgments of the case', async () => {
		fakeApi({ '/api/judgments/{ecli}/course': course });
		expect(await courseIdsOf('ecli_nl_hr_2019_2006')).toEqual([
			'judgments/ecli_nl_ghdha_2018_2591'
		]);
	});
});

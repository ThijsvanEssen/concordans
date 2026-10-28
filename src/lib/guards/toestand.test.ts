// A state a component shows (open, chosen, dimmed) has one class name everywhere: `is-open`,
// `is-active`, `is-dim` and the few of the closed list below (code-eenvoud F105).
import { describe, expect, it } from 'vitest';
import { BRONNEN, overtreders } from '$lib/test/bronnen';

/** The state classes in use; a new state is added here, a synonym of one is not. */
const STATES = [
	'is-a',
	'is-active',
	'is-afgeleid',
	'is-b',
	'is-bottom',
	'is-chosen',
	'is-dicht',
	'is-dim',
	'is-docked',
	'is-hier',
	'is-hollow',
	'is-in',
	'is-klikbaar',
	'is-long',
	'is-old',
	'is-open',
	'is-proposed',
	'is-quiet',
	'is-resizing',
	'is-side',
	'is-tall',
	'is-whole'
];

describe('the states of a component', () => {
	it('names open, chosen and dimmed one way, not by a synonym', () => {
		const synonym = /class:(open|aan|is-on|gekozen|active|actief|dim|gedimd)(?![\w-])/;
		expect(overtreders((t) => synonym.test(t))).toEqual([]);
	});

	it('toggles only the state classes of the closed list', () => {
		const used = new Set(
			BRONNEN.flatMap(({ text }) => [...text.matchAll(/class:(is-[\w-]+)/g)].map((m) => m[1]))
		);
		expect([...used].sort()).toEqual(STATES);
	});
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The IndexRow of a list in Bladeren, from its bron to its close. */
const rowOf = (component: string, collection: string) => {
	const source = readFileSync(join(__dirname, `${component}.svelte`), 'utf8');
	const at = source.indexOf(`{@const bron = \`${collection}/`);
	return source.slice(at, source.indexOf('</IndexRow>', at));
};

// #85: a click on a row in Bladeren Stemmingen and Toezeggingen went to the bron. One click
// opens a row in place (rowClick, IndexRow's onToggle and detail); the bron is a step further.
describe('Bladeren: a row with something to show opens in place', () => {
	it.each([
		['DecisionRows', 'decisions'],
		['CommitmentRows', 'commitments'],
		['DocumentRows', 'documents']
	])('%s', (component, collection) => {
		const row = rowOf(component, collection);
		expect(row).toContain('onToggle=');
		expect(row).toContain('{#snippet detail()}');
		expect(row).not.toMatch(/^\s*acties\s*$/m);
	});
});

// The labels of the buttons and text links: each stands in the table Knoppen of docs/woorden.md,
// in the one form of the norm. An action on the bron of the page is said in the imperative
// (Bewaar, Volg, Citeer), a control of a panel, a list or a dialog in the infinitive (Wissen,
// Sluiten, Toevoegen); the rest is a name or a place.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRONNEN } from '$lib/test/bronnen';

const VORMEN = ['gebiedend', 'onbepaald', 'naam'];

/** The rows of the table Knoppen: label and form. */
function knoppen(): Map<string, string> {
	const tekst = readFileSync(join(process.cwd(), 'docs/woorden.md'), 'utf8');
	const tabel = tekst.split('## Knoppen')[1].split('\n## ')[0];
	return new Map(
		tabel
			.split('\n')
			.filter((regel) => regel.startsWith('| `'))
			.map((regel) => {
				const cellen = regel.split('|').map((c) => c.trim());
				return [cellen[1].replace(/`/g, ''), cellen[2]] as [string, string];
			})
	);
}

/** The labels written out in a button or a text link, comments and scripts left out. */
function labels(): Map<string, string[]> {
	const found = new Map<string, string[]>();
	for (const { path, text } of BRONNEN) {
		if (!path.endsWith('.svelte')) continue;
		const markup = text.replace(/<!--[\s\S]*?-->|<script[\s\S]*?<\/script>/g, '');
		for (const m of markup.matchAll(
			/<(button|TekstLink|TextLink)\b[^>]*>\s*([^<>{}\n]{1,40}?)\s*<\/\1>/g
		))
			found.set(m[2], [...(found.get(m[2]) ?? []), path]);
	}
	return found;
}

describe('the labels of the buttons (docs/woorden.md, Knoppen)', () => {
	const tabel = knoppen();

	it('reads the table Knoppen, each label in one form', () => {
		expect(tabel.size).toBeGreaterThan(10);
		for (const [label, vorm] of tabel) expect(VORMEN, label).toContain(vorm);
	});

	it('has each label of a button in the table', () => {
		const onbekend = [...labels()].filter(([label]) => !tabel.has(label));
		expect(onbekend.map(([label, paden]) => `${label} (${paden[0]})`)).toEqual([]);
	});

	it('has no imperative among the controls: Wissen, not Wis', () => {
		for (const [label, vorm] of tabel)
			if (vorm === 'onbepaald') expect(label, label).toMatch(/en$/);
	});
});

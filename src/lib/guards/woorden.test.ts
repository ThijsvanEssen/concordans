// The fixed words of the interface: no word of the table Verboden in docs/woorden.md in the code.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { escapeRegExp } from '$lib/text/words';
import { overtreders } from '$lib/test/bronnen';

/** The code without its comments: a comment may name the word it replaced. */
const code = (t: string) =>
	t.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|(^|[^:'"`])\/\/.*$/gm, '$1');

/** The words in the first column of the table Verboden, as written between backticks. */
function verboden(): string[] {
	const tekst = readFileSync(join(process.cwd(), 'docs/woorden.md'), 'utf8');
	const tabel = tekst.split('## Verboden')[1].split('\n## ')[0];
	return tabel
		.split('\n')
		.filter((regel) => regel.startsWith('| `'))
		.map((regel) => /^\| `([^`]+)`/.exec(regel)![1]);
}

/**
 * A single word as a whole label (`'Buren'`, `>Overlay<`); anything else as written, not inside
 * a longer word (`Kamerzaak in een dossier` is no `zaak in een dossier`).
 */
const patroon = (woord: string) =>
	/^[\p{L}-]+$/u.test(woord)
		? new RegExp(`['"\`>]\\s*${escapeRegExp(woord)}\\s*['"\`<]`)
		: new RegExp(`(?<!\\p{L})${escapeRegExp(woord)}`, 'u');

describe('the fixed words (docs/woorden.md)', () => {
	const woorden = verboden();

	it('reads the table Verboden', () => {
		expect(woorden.length).toBeGreaterThan(20);
	});

	it.each(woorden)('has no %s in the code', (woord) => {
		const p = patroon(woord);
		expect(overtreders((t) => p.test(code(t)))).toEqual([]);
	});
});

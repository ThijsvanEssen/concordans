// An effect whose cleanup writes what the effect reads runs again on its own cleanup: a loop
// that asked the API hundreds of times in seconds (Overzicht, 10 Oct 2026). A flag the
// cleanup resets is only written in the effect; the effect tests a local value.
import { describe, expect, it } from 'vitest';
import { BRONNEN, overtreders } from '$lib/test/bronnen';

describe('effects that end', () => {
	/** The block that opens at `start` (a `{`), by counting braces. */
	const blok = (text: string, start: number) => {
		let diep = 0;
		for (let i = start; i < text.length; i++) {
			if (text[i] === '{') diep++;
			else if (text[i] === '}' && --diep === 0) return text.slice(start, i + 1);
		}
		return text.slice(start);
	};
	/** Each effect's body and its cleanup, as written: `$effect(() => { … return () => { … } })`. */
	const effecten = (text: string) =>
		[...text.matchAll(/\$effect(?:\.pre)?\(\s*\(\)\s*=>\s*\{/g)].map((m) => {
			const body = blok(text, m.index! + m[0].length - 1);
			const r = body.search(/return\s*\(\)\s*=>\s*\{/);
			const cleanup = r >= 0 ? blok(body, body.indexOf('{', body.indexOf('=>', r))) : '';
			return { body: r >= 0 ? body.slice(0, r) : body, cleanup };
		});
	const schrijft = (code: string) =>
		new Set([...code.matchAll(/(?<![.\w])(\w+)\s*(?:[+-]?=)(?!=)/g)].map((m) => m[1]));
	const leest = (code: string, naam: string) =>
		new RegExp(`(?<![.\\w])${naam}\\b(?!\\s*[+-]?=(?!=))`).test(code);

	it('writes nothing in a cleanup that the effect reads', () => {
		const lussen = BRONNEN.filter(
			({ path }) => path.endsWith('.svelte') || path.endsWith('.svelte.ts')
		).flatMap(({ path, text }) => {
			// Only state reruns an effect: a plain `let` read in a callback cannot.
			const staat = new Set([...text.matchAll(/let\s+(\w+)\s*=\s*\$state/g)].map((m) => m[1]));
			return effecten(text).flatMap(({ body, cleanup }) =>
				[...schrijft(cleanup)]
					.filter((naam) => staat.has(naam) && leest(body, naam))
					.map((naam) => `${path}: ${naam}`)
			);
		});
		expect(lussen).toEqual([]);
	});

	it('finds the loop it guards against', () => {
		const fout = `$effect(() => {
			laden = !!woorden.length;
			if (!laden) return;
			return () => {
				ac.abort();
				laden = false;
			};
		});`;
		const [e] = effecten(fout);
		expect([...schrijft(e.cleanup)].filter((n) => leest(e.body, n))).toEqual(['laden']);
	});
});

describe('runes', () => {
	it('assigns state in a statement, never as the value of an arrow (assignment_value_stale, #71)', () => {
		// `.then((items) => (lists[list] = items))`: Svelte warns that the value is the right-hand
		// side, not the proxy the state now holds.
		const memberAsValue = /=>\s*\(\s*[\w$]+(?:\.[\w$]+|\[[^\]]+\])+\s*=[^=>]/;
		expect(
			overtreders((text) => memberAsValue.test(text)).filter((p) => /\.svelte(\.ts)?$/.test(p))
		).toEqual([]);
	});
});

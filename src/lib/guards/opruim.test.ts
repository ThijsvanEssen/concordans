// Nothing left that nothing uses: no orphan component, no prototype switch, no prop no caller
// gives, no export no other file names, and one address per name.
import { describe, expect, it } from 'vitest';
import { BRONNEN, TESTS, overtreders, vondsten, type Uitzondering } from '$lib/test/bronnen';

/** The text without its comments: a name in a comment is no use of it. */
const withoutComments = (text: string) =>
	text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[\s;{}()])\/\/.*$/gm, '$1');

/** Every identifier a text names, with how often. */
function identifiers(text: string): Map<string, number> {
	const counts = new Map<string, number>();
	for (const [word] of withoutComments(text).matchAll(/[A-Za-z_$][\w$]*/g))
		counts.set(word, (counts.get(word) ?? 0) + 1);
	return counts;
}

/** Skips the string that opens at `at`: the index of its closing quote. */
function skipString(text: string, at: number): number {
	let i = at + 1;
	for (; i < text.length && text[i] !== text[at]; i++) if (text[i] === '\\') i++;
	return i;
}

/** The index of the bracket that closes the one at `at`, past strings and nested pairs. */
function closing(text: string, at: number, open: string, close: string): number {
	let depth = 0;
	for (let i = at; i < text.length; i++) {
		const c = text[i];
		if (c === '"' || c === "'" || c === '`') i = skipString(text, i);
		else if (c === open) depth++;
		else if (c === close && --depth === 0) return i;
	}
	return -1;
}

/** The parts of a list, split on its commas outside brackets and strings. */
function parts(list: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < list.length; i++) {
		const c = list[i];
		if (c === '"' || c === "'" || c === '`') i = skipString(list, i);
		else if ('{[('.includes(c)) depth++;
		else if ('}])'.includes(c)) depth--;
		else if (c === ',' && depth === 0) {
			out.push(list.slice(start, i));
			start = i + 1;
		}
	}
	out.push(list.slice(start));
	return out.map((p) => p.trim()).filter(Boolean);
}

/** The props a component takes, by name; null where it passes the rest on (`...rest`). */
function propsOf(text: string): string[] | null {
	const at = text.indexOf('$props()');
	const start = at < 0 ? -1 : text.lastIndexOf('let {', at);
	if (start < 0) return [];
	const names = parts(text.slice(start + 5, closing(text, start + 4, '{', '}')));
	if (names.some((n) => n.startsWith('...'))) return null;
	// A part that is no name is the rest of a default split on a type argument's comma.
	return names.flatMap((n) => /^([A-Za-z_$][\w$]*)\s*(?:[=:]|$)/.exec(n)?.[1] ?? []);
}

/** What the calls `<Name …>` in a text give: attributes, shorthands, snippets, children. */
function given(text: string, name: string) {
	const names = new Set<string>();
	let calls = 0;
	let spread = false;
	for (const m of text.matchAll(new RegExp(`<${name}(?=[\\s/>])`, 'g'))) {
		calls++;
		let flat = '';
		let i = m.index + name.length + 1;
		for (; i < text.length && text[i] !== '>'; i++) {
			const c = text[i];
			if (c === '{') {
				const end = closing(text, i, '{', '}');
				const inner = text.slice(i + 1, end).trim();
				if (inner.startsWith('...')) spread = true;
				else if (/^[\w$]+$/.test(inner)) names.add(inner);
				flat += ' ';
				i = end;
			} else if (c === '"' || c === "'") {
				i = skipString(text, i);
				flat += ' ';
			} else flat += c;
		}
		for (const [, attr] of flat.matchAll(/(?:^|\s)(?:bind:)?([A-Za-z_$][\w$]*)(?==|\s|\/|$)/g))
			names.add(attr);
		if (text[i - 1] === '/') continue;
		const body = text.slice(i + 1, text.indexOf(`</${name}>`, i));
		for (const [, snippet] of body.matchAll(/\{#snippet\s+([\w$]+)/g)) names.add(snippet);
		if (body.replace(/\{#snippet[\s\S]*?\{\/snippet\}/g, '').trim()) names.add('children');
	}
	return { calls, spread, names };
}

/** A route's page or layout takes its props from SvelteKit, not from a caller. */
const ROUTE = /^routes\//;

/** A component no tag calls, rendered as a value: its props are typed where it is chosen. */
const AS_VALUE: Uitzondering[] = [
	{
		pad: 'lib/components/explore/IndexView.svelte',
		reden: 'loaded lazily by the explore page, rendered as <IndexViewC>'
	}
];

/** Not modules with users: the guards' reader, the tests' fixtures, SvelteKit's own files. */
const NOT_A_MODULE = /^lib\/test\/|^lib\/fixtures\/|^routes\/|^hooks\.|\.d\.ts$/;

/** An export only a test reads, which its module does not use: a hook for that test. */
const TEST_HOOKS: Uitzondering[] = [
	{
		pad: 'lib/api/records.ts',
		regel: /^RECORDS_KEPT$/,
		reden: 'a test hook: how many records the cache keeps, for the test that fills it'
	},
	{
		pad: 'lib/api/limit-maxima.ts',
		regel: /^limitMaxima$/,
		reden: 'read by vite.config.ts, which makes virtual:api-limits of it'
	}
];

/** Modules tested through what they give other files, so no export only a test reads (code-eenvoud F98). */
const NO_TEST_HOOKS = new Set(['lib/components/explore/readers/judgment-text.ts']);

const EXPORT =
	/^\s*export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|function\*?|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm;

describe('nothing left over', () => {
	it('keeps no component that nothing uses', () => {
		const componenten = BRONNEN.filter(
			({ path }) => path.startsWith('lib/') && path.endsWith('.svelte')
		);
		expect(
			componenten
				.filter(({ path }) => {
					const naam = `/${path.split('/').at(-1)}'`;
					return !BRONNEN.some((s) => s.path !== path && s.text.includes(naam));
				})
				.map((c) => c.path)
		).toEqual([]);
	});

	it('has no prototype switches or study folders left', () => {
		expect(
			overtreders((t) => /searchParams\.get\('(ontwerp|contrast)'\)|components\/r[0-9]\//.test(t))
		).toEqual([]);
	});

	it('reads props and calls as a component writes them', () => {
		const component = `let {
			a,
			b = 'x, y',
			c = new Map<string, number>(),
			d: own = 1
		}: Props = $props();`;
		expect(propsOf(component)).toEqual(['a', 'b', 'c', 'd']);
		expect(propsOf('let { a, ...rest }: Props = $props();')).toBeNull();
		const call = given(
			`<K a="1" {b} bind:c d={e > 1 ? '>' : 'f'} g>{#snippet h()}x{/snippet}y</K>`,
			'K'
		);
		expect([...call.names].sort()).toEqual(['a', 'b', 'c', 'children', 'd', 'g', 'h']);
		expect(given('<K {...p} />', 'K').spread).toBe(true);
	});

	it('gives every prop of a component from some caller (code-eenvoud F83)', () => {
		// A reader takes the node KindReader gives each one through its table.
		const kindReader = BRONNEN.find(
			(b) => b.path === 'lib/components/explore/KindReader.svelte'
		)!.text;
		// A list's views take their one prop, ctx, from IndexView through the register (F87).
		const register = BRONNEN.filter((b) => b.path.startsWith('lib/components/explore/index/lists/'))
			.map((b) => b.text)
			.join('\n');
		const found: { pad: string; wat: string }[] = [];
		for (const { path, text } of BRONNEN) {
			if (!path.endsWith('.svelte') || ROUTE.test(path)) continue;
			const props = propsOf(text);
			if (!props?.length) continue;
			const name = path.split('/').at(-1)!.replace('.svelte', '');
			const calls = BRONNEN.filter((b) => b.path !== path).map((b) => given(b.text, name));
			if (calls.some((c) => c.spread)) continue;
			const names = new Set(calls.flatMap((c) => [...c.names]));
			if (!calls.some((c) => c.calls)) {
				if (new RegExp(`\\b(Rows|Figure|Header): ${name}\\b`).test(register)) names.add('ctx');
				else if (new RegExp(`\\b${name}\\b`).test(kindReader)) names.add('node');
				else {
					found.push({ pad: path, wat: 'no caller by tag' });
					continue;
				}
			}
			for (const prop of props) if (!names.has(prop)) found.push({ pad: path, wat: prop });
		}
		expect(vondsten(found, AS_VALUE)).toEqual([]);
	});

	it('exports only what another file names, and nothing only a test uses (code-eenvoud F83)', () => {
		const index = (files: typeof BRONNEN) =>
			new Map(files.map(({ path, text }) => [path, identifiers(text)]));
		const sources = index(BRONNEN.filter(({ path }) => /\.(ts|svelte)$/.test(path)));
		const tests = index(TESTS);
		const elsewhere = (path: string, name: string, files: Map<string, Map<string, number>>) =>
			[...files].some(([p, names]) => p !== path && names.has(name));
		const found: { pad: string; wat: string }[] = [];
		for (const { path, text } of BRONNEN) {
			if (!/\.(ts|svelte)$/.test(path) || NOT_A_MODULE.test(path)) continue;
			for (const [, name] of text.matchAll(EXPORT)) {
				if (elsewhere(path, name, sources)) continue;
				const usedHere = (sources.get(path)!.get(name) ?? 0) > 1;
				if (usedHere && !NO_TEST_HOOKS.has(path) && elsewhere(path, name, tests)) continue;
				found.push({ pad: path, wat: name });
			}
		}
		expect(vondsten(found, TEST_HOOKS)).toEqual([]);
	});

	it('exports a name from one module only, fewer shared over time (code-eenvoud F104)', () => {
		// Two modules exporting one name let auto-import take the wrong one. These still do; a
		// name renamed to what it is comes off the list.
		const NOG = [
			'Box',
			'Bucket',
			'Deel',
			'End',
			'PAGE_SIZE',
			'PREVIEW_CHARS',
			'Regel',
			'Regeling',
			'Richting',
			'Rij',
			'Row',
			'Stuk',
			'Uitkomst',
			'Zin',
			'countLine',
			'feedQuery',
			'kolomVan',
			'matches',
			'metStrekking',
			'placeOf',
			'plekVan',
			'soortVan',
			'stemmingNaam',
			'uitkomstVan',
			'uitslagVan',
			'vullingVan',
			'wijzigingenVan'
		];
		const modules = new Map<string, Set<string>>();
		for (const { path, text } of BRONNEN) {
			if (!/\.(ts|svelte)$/.test(path) || NOT_A_MODULE.test(path)) continue;
			for (const [, name] of text.matchAll(EXPORT))
				modules.set(name, (modules.get(name) ?? new Set()).add(path));
		}
		const shared = [...modules].filter(([, paths]) => paths.size > 1).map(([name]) => name);
		expect(shared.sort()).toEqual(NOG.sort());
	});

	it('gives every name one address: no re-export (code-eenvoud F83)', () => {
		const reExport =
			/^\s*export\s*(?:type\s*)?(?:\{[^}]*\w[^}]*\}|\*)(?:\s*as\s+\w+)?\s*(?:from\b|;|$)/m;
		expect(overtreders((t) => reExport.test(t))).toEqual([]);
	});
});

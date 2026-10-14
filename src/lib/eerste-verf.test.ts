// The first paint and the first navigation: what a page shows before the app runs, and
// what lets the app take over its links.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(process.cwd(), 'src');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return files(path);
		return /\.(svelte|ts)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
	});
}

/** The custom properties a block of CSS declares, by name. */
const tokens = (css: string) =>
	new Map([...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

describe('the server HTML before the app', () => {
	const style = /<style>([\s\S]*?)<\/style>/.exec(read('app.html'))?.[1] ?? '';
	const vooraf = /:root:has\(#seo\)\s*\{([^}]*)\}/.exec(style)?.[1] ?? '';

	it('uses the values of the app tokens (app.html against tokens.css)', () => {
		const app = tokens(/:root\s*\{([\s\S]*?)\n\}/.exec(read('lib/styles/tokens.css'))?.[1] ?? '');
		expect(tokens(vooraf).size).toBeGreaterThan(0);
		for (const [name, value] of tokens(vooraf))
			expect([name, app.get(name)]).toEqual([name, value]);
	});

	it('takes the frame from the tokens: the top bar, the width of a page and of its text', () => {
		for (const name of ['--topbar-h', '--blad-max', '--blad-tekst'])
			expect(style.replace(vooraf, '')).toContain(`var(${name})`);
		expect(style.replace(vooraf, '')).not.toMatch(/\b(60|720|1440)px\b/);
	});

	it('declares its font as the app does (app.html against fonts.css)', () => {
		const face = (css: string) => /@font-face\s*\{[^}]*\}/.exec(css)?.[0].replace(/\s+/g, ' ');
		expect(face(style)).toBeTruthy();
		expect(face(style)).toEqual(face(read('lib/styles/fonts.css')));
	});

	it('stays hidden while the app comes, and shows when it does not', () => {
		const head = read('app.html').split('</head>')[0];
		const script = head.indexOf("classList.add('js')");
		expect(script).toBeGreaterThan(-1);
		// Before the first style, so nothing paints the text first.
		expect(script).toBeLessThan(head.indexOf('<style>'));
		expect(head).toMatch(/setTimeout\([\s\S]*?classList\.remove\('js'\)/);
		expect(head).toMatch(/\.js #seo \{\s*display: none;/);
		expect(read('routes/+layout.svelte')).toContain('clearTimeout(window.__seoTerug)');
	});

	it('loads its font from the head, before any script', () => {
		const head = read('app.html').split('</head>')[0];
		expect(head).toMatch(/rel="preload"[\s\S]*?Newsreader-Variable\.woff2/);
		expect(head).toContain("url('/fonts/Newsreader-Variable.woff2')");
	});
});

describe('the first navigation', () => {
	// On the first page SvelteKit can hand `from` without a url. A callback that reads it
	// throws, the first navigation never ends, and SvelteKit never takes over the links:
	// every click loads the whole page (production only, 10 Oct 2026; docs/bediening.md).
	it('reads the url of from and to in a navigation callback only when it is there', () => {
		const sources = files(ROOT).map((path) => ({
			path: relative(ROOT, path),
			text: readFileSync(path, 'utf8')
		}));
		const offenders = sources
			.filter(({ text }) => /\b(after|before)Navigate\(/.test(text))
			.filter(({ text }) => /\b(?:from|to)!?\.url\b/.test(text))
			.map((s) => s.path);
		expect(offenders).toEqual([]);
	});
});

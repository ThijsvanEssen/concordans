// The sources the guards in $lib/guards read, and the one form of their exceptions.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export type Bron = { path: string; text: string };

/**
 * A place that keeps a rule's older form or is the rule's own place, with why. `regel` limits it
 * to the lines it matches, so a second violation in the same file still fails. An exception that
 * excepts nothing fails its guard: it comes out with the step that made it unneeded.
 */
export type Uitzondering = { pad: string; reden: string; regel?: RegExp };

const ROOT = join(process.cwd(), 'src');

/** Not read: tests, the generated types, and this reader. */
const SKIP = /\.test\.ts$|^lib\/api\/generated\/|^lib\/test\/bronnen\.ts$/;

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return files(path);
		return /\.(svelte|ts|css)$/.test(name) ? [path] : [];
	});
}

// A stylesheet reads as a component's style block, so a rule on styles sees it too.
const read = (path: string) => {
	const text = readFileSync(path, 'utf8');
	return path.endsWith('.css') ? `<style>${text}</style>` : text;
};

/** Every .svelte, .ts and .css file under src, by its path from src. */
export const BRONNEN: Bron[] = files(ROOT)
	.map((path) => ({ path: relative(ROOT, path).split('\\').join('/'), absolute: path }))
	.filter(({ path }) => !SKIP.test(path))
	.map(({ path, absolute }) => ({ path, text: read(absolute) }));

const byPath = new Map(BRONNEN.map((b) => [b.path, b.text]));

/** The text of one source; a renamed or moved file says so instead of reading undefined. */
export function bron(path: string): string {
	const text = byPath.get(path);
	if (text === undefined) throw new Error(`bestand ${path} bestaat niet (of wordt niet gelezen)`);
	return text;
}

/** An exception for the one place a rule lives. */
export const plek = (pad: string, reden = 'the one place of the rule'): Uitzondering => ({
	pad,
	reden
});

const stale = (u: Uitzondering) => `uitzondering ${u.pad} (${u.reden}) is niet meer nodig`;

/**
 * The paths whose text breaks a rule, past its exceptions, and every exception that no longer
 * excepts anything (the file is gone, it keeps the rule, or its `regel` matches no line).
 */
export function overtreders(
	test: (text: string) => boolean,
	uitzonderingen: Uitzondering[] = [],
	bronnen: Bron[] = BRONNEN
): string[] {
	const used = new Set<Uitzondering>();
	const found = bronnen.flatMap(({ path, text }) => {
		if (!test(text)) return [];
		const own = uitzonderingen.filter((u) => u.pad === path);
		const whole = own.find((u) => !u.regel);
		if (whole) {
			used.add(whole);
			return [];
		}
		const lines = own.filter((u) => text.split('\n').some((l) => u.regel!.test(l)));
		if (!lines.length) return [path];
		const rest = text
			.split('\n')
			.filter((l) => !lines.some((u) => u.regel!.test(l)))
			.join('\n');
		if (test(rest)) return [path];
		for (const u of lines) used.add(u);
		return [];
	});
	return [...found, ...uitzonderingen.filter((u) => !used.has(u)).map(stale)];
}

/**
 * The findings of a rule (a line, a selector) as `path: what`, past its exceptions: an exception
 * covers a finding in its file, or only those its `regel` matches. One that covers none is named
 * as unneeded.
 */
export function vondsten(
	found: { pad: string; wat: string }[],
	uitzonderingen: Uitzondering[] = []
): string[] {
	const used = new Set<Uitzondering>();
	const rest = found.filter(({ pad, wat }) => {
		const u = uitzonderingen.find((u) => u.pad === pad && (!u.regel || u.regel.test(wat)));
		if (u) used.add(u);
		return !u;
	});
	return [
		...rest.map(({ pad, wat }) => `${pad}: ${wat}`),
		...uitzonderingen.filter((u) => !used.has(u)).map(stale)
	];
}

/** The lines that break a rule, as `path: line`, past its exceptions. */
export const regelOvertreders = (
	test: (line: string) => boolean,
	uitzonderingen: Uitzondering[] = []
) =>
	vondsten(
		BRONNEN.flatMap(({ path, text }) =>
			text
				.split('\n')
				.filter(test)
				.map((line) => ({ pad: path, wat: line.trim() }))
		),
		uitzonderingen
	);

/** The rules of a style block, comments left out. */
export const regels = (text: string) => {
	const css = /<style>([\s\S]*?)<\/style>/.exec(text)?.[1] ?? '';
	return [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
		selector: m[1].trim(),
		body: m[2]
	}));
};

// A control is a rule whose subject is a button, a field, a key, a choice row, a tab or a menu
// item.
const CTL_EL = /(^|[\s>+~(,])(button|input|select|textarea|kbd|option|summary)(?=$|[.:[\s#)])/;
const CTL_CLS =
	/\.(?:[\w-]*(?:btn|knop|keuze|toggle|switch|segment|trigger|veld|field|input|menu__item|menuitem|kbd|nav-link)[\w-]*|(?:[\w-]*-)?tabs?(?:[-_][\w-]*)?|act(?:--[\w-]+|__[\w-]+)?)(?=$|[.:[\s#)>+~,])/;
export const isControl = (selector: string) =>
	selector.split(',').every((part) => {
		const p = part.replace(/:global\(([^)]*)\)/g, '$1').trim();
		const subject = p.split(/\s*[>+~]\s*|\s+/).at(-1) ?? p;
		return CTL_EL.test(' ' + subject) || CTL_CLS.test(subject);
	});

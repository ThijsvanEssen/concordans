// The design tokens (lib/styles/tokens.css): each is read somewhere, and the canvas's own copy
// for a page without them (nodeSprites FALLBACK) has their values.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FALLBACK, TOKEN_NAMES } from '$lib/components/graph/nodeSprites';

const ROOT = join(process.cwd(), 'src');

function files(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return files(path);
		return /\.(svelte|ts|css|html)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
	});
}

const declared = new Map(
	[
		...(
			/:root\s*\{([\s\S]*?)\n\}/.exec(
				readFileSync(join(ROOT, 'lib/styles/tokens.css'), 'utf8')
			)?.[1] ?? ''
		)
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.matchAll(/(--[\w-]+):\s*([^;]+);/g)
	].map((m) => [m[1], m[2].trim().replace(/\s+/g, ' ')])
);

/** A token's value, through the tokens it names. */
function value(name: string): string | undefined {
	let v = declared.get(name);
	for (let m; v && (m = /^var\((--[\w-]+)\)$/.exec(v)); ) v = declared.get(m[1]);
	return v;
}

describe('the design tokens', () => {
	it('declares tokens', () => {
		expect(declared.size).toBeGreaterThan(50);
	});

	it('reads every token somewhere: in a var() or by its name for the canvas', () => {
		const text = files(ROOT)
			.map((path) => readFileSync(path, 'utf8'))
			.join('\n');
		const unread = [...declared.keys()].filter(
			(name) =>
				!text.includes(`var(${name})`) &&
				!text.includes(`var(${name},`) &&
				!text.includes(`'${name}'`)
		);
		expect(unread).toEqual([]);
	});

	it('gives the canvas the values of the tokens where it cannot read them', () => {
		for (const key of Object.keys(FALLBACK) as (keyof typeof FALLBACK)[])
			expect([key, FALLBACK[key]]).toEqual([key, value(TOKEN_NAMES[key])]);
	});
});

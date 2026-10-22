// A shared link's card (B44, X4): the tags that are the same on every page stand in
// app.html; the bar of a phone's browser has the paper's colour.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('the card of a shared link', () => {
	const app = read('src/app.html');

	it('is a large card in Dutch', () => {
		expect(app).toContain('<meta name="twitter:card" content="summary_large_image" />');
		expect(app).toContain('<meta property="og:locale" content="nl_NL" />');
	});

	it('gives the browser bar the paper of the tokens', () => {
		const paper = read('src/lib/styles/tokens.css').match(/--paper:\s*(#[0-9a-f]{6});/i)?.[1];
		expect(paper).toBeTruthy();
		expect(app).toContain(`<meta name="theme-color" content="${paper}" />`);
	});
});

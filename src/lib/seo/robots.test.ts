import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const robots = readFileSync('static/robots.txt', 'utf8');

describe('robots.txt', () => {
	it('names the sitemap on the site, absolute', () => {
		expect(robots).toMatch(/^Sitemap: https:\/\/concordans\.nl\/sitemap\.xml$/m);
	});

	it('keeps the API out and the pages in', () => {
		expect(robots).toMatch(/^Disallow: \/api\/$/m);
		expect(robots).not.toMatch(/^Disallow: \/\s*$/m);
	});
});

describe('sitemap', () => {
	// /sitemap.xml is the index the API serves (with sitemap-paginas.xml for the pages of
	// this app, from spa-routes.json). A file of the build with the same name would be served
	// by Caddy instead of the API's index and hide every bron from the crawler.
	it('is not a file of this build: the API serves the index', () => {
		expect(existsSync('static/sitemap.xml')).toBe(false);
		expect(existsSync('src/routes/sitemap.xml')).toBe(false);
	});
});

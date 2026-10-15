import { describe, expect, it } from 'vitest';
import HOME from './home.json';

// The fixed parts of the start page, which the server's page of / can show from the same file.
describe('home.json', () => {
	it('gives a few example queries, each once', () => {
		expect(HOME.examples.length).toBeGreaterThanOrEqual(3);
		expect(new Set(HOME.examples).size).toBe(HOME.examples.length);
	});

	it('links each law once, to its readable address', () => {
		for (const law of HOME.laws) expect(law.href).toMatch(/^\/wetten\/[A-Z0-9]+$/);
		expect(new Set(HOME.laws.map((l) => l.href)).size).toBe(HOME.laws.length);
		expect(new Set(HOME.laws.map((l) => l.label)).size).toBe(HOME.laws.length);
	});
});

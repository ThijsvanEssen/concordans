// The browser suite (e2e/) runs in CI in the Playwright image of the version package.json
// pins: the browsers of that image are the ones the tests drive and the visual baseline is
// made in (scripts/e2e-update.sh reads the same version), so the two move together.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

describe('the browser suite', () => {
	it('runs in CI in the Playwright image of the pinned version', () => {
		const pinned = JSON.parse(read('package.json')).devDependencies['@playwright/test'];
		expect(pinned, 'pinned exactly').toMatch(/^\d+\.\d+\.\d+$/);
		expect(read('.github/workflows/ci.yml')).toContain(
			`image: mcr.microsoft.com/playwright:v${pinned}-noble`
		);
	});
});

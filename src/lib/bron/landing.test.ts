import { describe, expect, it } from 'vitest';
import { linkTo, permalink, viewLink } from './landing';

describe('a link to share', () => {
	it('never carries the bundel a reader keeps in (UX-toets A21 #2)', () => {
		const url = new URL(
			'https://concordans.nl/wetten/BWBR0005289/artikel/6:162?bundel=k3j2&lezen=1'
		);
		expect(permalink(url, 'lid-2')).toBe(
			'https://concordans.nl/wetten/BWBR0005289/artikel/6:162?lezen=1#lid-2'
		);
		expect(linkTo(viewLink(url), 'lid-1')).not.toContain('bundel=');
	});
});

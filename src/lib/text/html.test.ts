import { describe, expect, it } from 'vitest';
import { esc } from './html';

describe('esc', () => {
	it('escapes the markup characters and both quotes', () => {
		expect(esc(`<a href="x">Tom & Jerry's</a>`)).toBe(
			'&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;'
		);
	});
});

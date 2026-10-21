import { describe, expect, it } from 'vitest';
import { documentSource } from './document-source';

describe('a paper at its source', () => {
	it('is one of the Tweede Kamer on tweedekamer.nl', () => {
		const href = 'https://www.tweedekamer.nl/kamerstukken/detail?id=2010Z05330';
		expect(documentSource({ tk_url: href, official_url: null })).toEqual({
			label: 'tweedekamer.nl',
			href
		});
	});

	it('is any other on officielebekendmakingen.nl, as the API places it', () => {
		const href = 'https://zoek.officielebekendmakingen.nl/kst-1274216';
		expect(documentSource({ tk_url: null, official_url: href })).toEqual({
			label: 'officielebekendmakingen.nl',
			href
		});
	});

	it('has no link where the API places none', () => {
		expect(documentSource({ tk_url: null, official_url: null })).toBeNull();
		expect(documentSource({})).toBeNull();
	});
});

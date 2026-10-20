import { describe, expect, it } from 'vitest';
import { documentSource } from './document-source';

describe('a paper at its source', () => {
	it('is one of the Tweede Kamer on tweedekamer.nl', () => {
		const href = 'https://www.tweedekamer.nl/kamerstukken/detail?id=2010Z05330';
		expect(documentSource({ source: 'tk', tk_url: href })).toEqual({
			label: 'tweedekamer.nl',
			href
		});
	});

	it('is one of the Eerste Kamer on officielebekendmakingen.nl, by its id', () => {
		expect(documentSource({ source: 'eerstekamer', external_id: 'kst-1274216' })).toEqual({
			label: 'officielebekendmakingen.nl',
			href: 'https://zoek.officielebekendmakingen.nl/kst-1274216'
		});
		expect(documentSource({ source: 'eerstekamer', external_id: 'iets anders' })).toBeNull();
		expect(documentSource({ source: 'tk', tk_url: null })).toBeNull();
	});
});

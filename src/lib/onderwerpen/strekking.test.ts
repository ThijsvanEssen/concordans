import { describe, expect, it } from 'vitest';
import { coderingNaarCsv, coderingUitCsv, dictumUit, metStrekking, withCoding } from './strekking';
import { topicKey } from './onderwerpen';

describe('strekking', () => {
	it('takes the dictum from the text of a motie, in its own words', () => {
		const tekst = `De Kamer,
		gehoord de beraadslaging,
		constaterende dat de regeling slecht werkt;
		verzoekt de regering om niet akkoord te gaan met de noodwetgeving,
		en gaat over tot de orde van de dag.`;
		expect(dictumUit(tekst)).toBe(
			'verzoekt de regering om niet akkoord te gaan met de noodwetgeving'
		);
		expect(dictumUit('spreekt uit dat de Kamer dit niet wil.')).toBe(
			'spreekt uit dat de Kamer dit niet wil.'
		);
		expect(dictumUit('')).toBeNull();
		expect(dictumUit('Een brief zonder verzoek.')).toBeNull();
	});

	it('keeps a coding per topic, and clears it', () => {
		const o = topicKey({ termen: ['Huur', ' huurtoeslag '] });
		expect(o).toBe('huur|huurtoeslag');
		let c = metStrekking({}, o, 'd1', 'bevorderend');
		c = metStrekking(c, o, 'd2', 'beperkend');
		expect(c).toEqual({ [o]: { d1: 'bevorderend', d2: 'beperkend' } });
		c = metStrekking(metStrekking(c, o, 'd1', null), o, 'd2', null);
		expect(c).toEqual({});
	});

	it('keys a topic and its coding by its words, in any order or case', () => {
		const a = topicKey({ termen: ['Huur', 'huurtoeslag'] });
		expect(topicKey({ termen: ['huurtoeslag', 'Huur'] })).toBe(a);
		const c = metStrekking({}, a, 'd1', 'bevorderend');
		expect(c[topicKey({ termen: [' huurtoeslag', 'HUUR'] })]).toEqual({ d1: 'bevorderend' });
	});

	it('writes a coding as a file and reads it back, with quotes and commas', () => {
		const csv = coderingNaarCsv(
			'huur',
			{ d1: 'bevorderend', d2: 'neutraal' },
			new Map([['d1', 'Motie over "huur", nr. 3']])
		);
		expect(coderingUitCsv(csv)).toEqual({ huur: { d1: 'bevorderend', d2: 'neutraal' } });
		expect(coderingUitCsv('kop\nhuur,d3,onzin,x')).toEqual({});
		const regels = coderingNaarCsv(
			'huur',
			{ d1: 'beperkend', d2: 'neutraal' },
			new Map([['d1', 'Motie "Jansen", over huur\nhuur,d9,neutraal']])
		);
		expect(coderingUitCsv(regels)).toEqual({ huur: { d1: 'beperkend', d2: 'neutraal' } });
		expect(
			withCoding({ huur: { d1: 'bevorderend' } }, { huur: { d1: 'beperkend', d2: 'neutraal' } })
		).toEqual({ huur: { d1: 'beperkend', d2: 'neutraal' } });
	});
});

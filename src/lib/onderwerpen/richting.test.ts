import { describe, expect, it } from 'vitest';
import {
	coderingNaarCsv,
	coderingUitCsv,
	dictumUit,
	metRichting,
	onderwerpSleutel,
	samen,
	telRichting
} from './richting';

describe('richting', () => {
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
		const o = onderwerpSleutel(['Huur', ' huurtoeslag ']);
		expect(o).toBe('huur|huurtoeslag');
		let c = metRichting({}, o, 'd1', 'positief');
		c = metRichting(c, o, 'd2', 'negatief');
		expect(c).toEqual({ [o]: { d1: 'positief', d2: 'negatief' } });
		c = metRichting(metRichting(c, o, 'd1', null), o, 'd2', null);
		expect(c).toEqual({});
	});

	it('counts all, per outcome and per vote of the chosen fractie', () => {
		const t = telRichting([
			{ richting: 'positief', uitkomst: 'aangenomen', stem: 'voor' },
			{ richting: 'negatief', uitkomst: 'verworpen', stem: 'tegen' },
			{ richting: 'positief', uitkomst: 'verworpen', stem: null }
		]);
		expect(t.alles).toEqual({ positief: 2, negatief: 1, neutraal: 0, totaal: 3 });
		expect(t.perUitkomst.verworpen.totaal).toBe(2);
		expect(t.perStem.voor.positief).toBe(1);
	});

	it('writes a coding as a file and reads it back, with quotes and commas', () => {
		const csv = coderingNaarCsv(
			'huur',
			{ d1: 'positief', d2: 'neutraal' },
			new Map([['d1', 'Motie over "huur", nr. 3']])
		);
		expect(coderingUitCsv(csv)).toEqual({ huur: { d1: 'positief', d2: 'neutraal' } });
		expect(coderingUitCsv('kop\nhuur,d3,onzin,x')).toEqual({});
		expect(
			samen({ huur: { d1: 'positief' } }, { huur: { d1: 'negatief', d2: 'neutraal' } })
		).toEqual({ huur: { d1: 'negatief', d2: 'neutraal' } });
	});
});

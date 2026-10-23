import { describe, expect, it } from 'vitest';
import { markeer, rondTreffer, type Deel } from './treffer';

/** Whether the text holds the word: one place marked. */
const woordIn = (term: string, tekst: string | null) => markeer([term], tekst) !== null;

const gemarkeerd = (d: Deel[] | null) => d?.filter((x) => x.mark).map((x) => x.tekst) ?? [];
const geheel = (d: Deel[] | null) => d?.map((x) => x.tekst).join('') ?? null;

describe('the words a reader follows, found by the API’s rule', () => {
	it('finds a word from the start of a word, a short one whole', () => {
		expect(woordIn('AI', 'De inzet van AI bij de IND')).toBe(true);
		expect(woordIn('AI', 'AI-verordening')).toBe(true);
		expect(woordIn('AI', 'universitaire aanstelling')).toBe(false);
		expect(woordIn('AI', 'onderzoekers zonder universitaire aanstelling')).toBe(false);
		expect(woordIn('AI', 'Kabinetsreactie AIV-advies EU-uitbreiding')).toBe(false);
		expect(woordIn('AI', 'Groningen Airport Eelde')).toBe(false);
		expect(woordIn('AI', null)).toBe(false);
		expect(woordIn('algoritme', 'Algoritmeregister')).toBe(true);
		expect(woordIn('cyberbeveiliging', 'horizontale cyberbeveiligingsvereisten')).toBe(true);
		expect(woordIn('beveiliging', 'cyberbeveiligingsvereisten')).toBe(false);
		expect(woordIn('', 'tekst')).toBe(false);
	});

	it('marks every place of every word, the rest of the text as it was', () => {
		const d = markeer(['woning', 'AI'], 'Woningbouw en AI; de woningcorporatie');
		expect(gemarkeerd(d)).toEqual(['Woning', 'AI', 'woning']);
		expect(geheel(d)).toBe('Woningbouw en AI; de woningcorporatie');
		// A word of four characters stands whole, as the API finds it: `huur` not in `huurprijzen`.
		expect(gemarkeerd(markeer(['huur'], 'Huurprijzen, huur en huur-')).length).toBe(2);
		expect(markeer(['vreemdeling'], 'Asielbeleid')).toBeNull();
		expect(markeer(['x'], null)).toBeNull();
	});

	it('marks overlapping words once', () => {
		const d = markeer(['cyber', 'cyberbeveiliging'], 'Cyberbeveiligingswet');
		expect(gemarkeerd(d)).toEqual(['Cyberbeveiliging']);
		expect(geheel(d)).toBe('Cyberbeveiligingswet');
	});

	it('cuts a long text around the first word found, at a word, with an ellipsis', () => {
		const titel =
			'Uitvoering van Verordening (EU) 2024/2847 van het Europees Parlement en de Raad van 23\u00a0oktober\u00a02024 inzake horizontale cyberbeveiligingsvereisten voor producten met digitale elementen en tot wijziging van de Verordeningen (EU) nr. 168/2013 en (EU) 2019/1020 en Richtlijn (EU) 2020/1828 (cyberweerbaarheidsverordening)';
		const d = rondTreffer(['cyberbeveiliging'], titel)!;
		expect(gemarkeerd(d)).toEqual(['cyberbeveiliging']);
		const t = geheel(d)!;
		expect(t.startsWith('… ')).toBe(true);
		expect(t.endsWith(' …')).toBe(true);
		expect(t).toContain('horizontale cyberbeveiligingsvereisten voor producten');
		expect(t.length).toBeLessThan(titel.length / 2);
		// Each cut at a word.
		expect(t).toMatch(/^… [A-Za-z0-9(]/);
	});

	it('keeps a short text whole', () => {
		expect(geheel(rondTreffer(['woonruimte'], 'Huurprijzen woonruimte'))).toBe(
			'Huurprijzen woonruimte'
		);
		expect(rondTreffer(['woonruimte'], 'Asiel')).toBeNull();
	});
});

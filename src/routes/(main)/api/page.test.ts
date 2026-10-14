import { describe, expect, it } from 'vitest';
import { load } from './+page';

describe('/api', () => {
	it('names the tags of the API as it did', async () => {
		const data = (await load({} as never)) as { tags: { tag: string; label: string }[] };
		expect(Object.fromEntries(data.tags.map((t) => [t.tag, t.label]))).toMatchObject({
			instruments: 'Instrumenten',
			articles: 'Artikelen',
			annexes: 'Bijlagen',
			judgments: 'Uitspraken',
			dossiers: 'Dossiers',
			documents: 'Stukken',
			decisions: 'Stemmingen',
			members: 'Personen',
			factions: 'Fracties',
			committees: 'Commissies',
			cabinets: 'Kabinetten',
			commitments: 'Toezeggingen'
		});
	});
});

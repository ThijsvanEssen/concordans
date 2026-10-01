// De tekens van Concordans. De vorm zegt wat een bron
// is; alle tekens staan in inkt, er is geen kleur te onthouden. Eén tabel voor de tekens
// in de tekst (KindGlyph) en op het canvas (nodeSprites), getekend in een vak van 16.
import type { Collection } from '$lib/vocabulary';
import { BILL_KIND, type BronKind } from '$lib/verbonden/filter';

export type Vorm =
	| 'regel'
	| 'regel-o'
	| 'uitspraak'
	| 'stuk'
	| 'voorstel'
	| 'dossier'
	| 'besluit'
	| 'activiteit'
	| 'toezegging'
	| 'persoon'
	| 'orgaan'
	| 'orgaan-o'
	| 'kabinet'
	| 'overig';

/** Hoe een vorm getekend wordt: gevuld, gevuld met een gat, of als lijn. */
export type Wijze = 'vul' | 'gat' | 'lijn';

const HEX = 'M8 1 14.5 4.75v7.5L8 16 1.5 12.25v-7.5z';
const HEX_O = 'M8 2.4 13.3 5.45v6.1L8 14.6 2.7 11.55v-6.1z';
const CIRKEL = (cx: number, cy: number, r: number) =>
	`M${cx + r} ${cy}a${r} ${r} 0 1 1-${2 * r} 0a${r} ${r} 0 1 1 ${2 * r} 0z`;

export const VORMEN: Record<Vorm, { d: string; wijze: Wijze; naam: string }> = {
	regel: { d: 'M2 2h12v12H2z', wijze: 'vul', naam: 'regel' },
	'regel-o': { d: 'M3 3h10v10H3z', wijze: 'lijn', naam: 'artikel' },
	uitspraak: { d: CIRKEL(8, 8, 6.5), wijze: 'vul', naam: 'uitspraak' },
	stuk: { d: 'M3.5 1h6.5l3 3v11H3.5z', wijze: 'vul', naam: 'stuk' },
	// Een wetsvoorstel is een blad met een open vak, los van de toelichting.
	voorstel: {
		d: 'M3.5 1h6.5l3 3v11H3.5zM5.6 7.2h5.3v5.3H5.6z',
		wijze: 'gat',
		naam: 'wetsvoorstel'
	},
	dossier: { d: 'M1 3.5h5l1.5 1.5H15V14H1z', wijze: 'vul', naam: 'dossier' },
	besluit: { d: 'M8 1.5 15 14.5H1z', wijze: 'vul', naam: 'besluit' },
	activiteit: { d: 'M8 3.2 13.6 13.5H2.4z', wijze: 'lijn', naam: 'activiteit' },
	toezegging: { d: 'M3 1h1.6v14H3zM4.6 2H14l-3 3.5L14 9H4.6z', wijze: 'vul', naam: 'toezegging' },
	persoon: {
		d: `${CIRKEL(8, 4.6, 3.2)}M1.5 15c0-4.2 2.9-6.4 6.5-6.4s6.5 2.2 6.5 6.4z`,
		wijze: 'vul',
		naam: 'persoon'
	},
	orgaan: { d: HEX, wijze: 'vul', naam: 'fractie' },
	'orgaan-o': { d: HEX_O, wijze: 'lijn', naam: 'commissie' },
	kabinet: { d: `${HEX}${CIRKEL(8, 8.5, 2.6)}`, wijze: 'gat', naam: 'kabinet' },
	overig: { d: CIRKEL(8, 8, 4), wijze: 'lijn', naam: 'overig' }
};

export const VORM_VAN: Record<Collection, Vorm> = {
	instruments: 'regel',
	instrument_versions: 'regel',
	articles: 'regel-o',
	article_versions: 'regel-o',
	annexes: 'regel-o',
	judgments: 'uitspraak',
	dossiers: 'dossier',
	cases: 'dossier',
	documents: 'stuk',
	activities: 'activiteit',
	decisions: 'besluit',
	commitments: 'toezegging',
	members: 'persoon',
	factions: 'orgaan',
	committees: 'orgaan-o',
	cabinets: 'kabinet'
};

/** De vorm van een bron uit zijn id (`decisions/…`) of collectie. */
export const vormVan = (idOfCollectie: string): Vorm =>
	VORM_VAN[idOfCollectie.split('/')[0] as Collection] ?? 'overig';

/** Het teken van een soort in het bronfilter. */
export const BRON_KIND_VORM: Record<BronKind, Vorm> = {
	artikelen: 'regel-o',
	wetten: 'regel',
	uitspraken: 'uitspraak',
	toelichtingen: 'stuk',
	wetsvoorstellen: 'voorstel',
	dossiers: 'dossier',
	leden: 'persoon',
	internationaal: 'regel'
};

/** De vorm van één bron: een stuk dat een wetsvoorstel is, krijgt het eigen teken. */
export function vormVanBron(collection: string, props?: Record<string, unknown> | null): Vorm {
	const vorm = VORM_VAN[collection as Collection] ?? 'overig';
	if (collection === 'documents' && typeof props?.kind === 'string' && BILL_KIND.test(props.kind))
		return 'voorstel';
	return vorm;
}

/** The order of the shapes in a legend: law, the parliament, people and bodies, the rest. */
export const VORM_VOLGORDE: Vorm[] = [
	'regel',
	'regel-o',
	'uitspraak',
	'dossier',
	'stuk',
	'voorstel',
	'besluit',
	'activiteit',
	'toezegging',
	'persoon',
	'orgaan',
	'orgaan-o',
	'kabinet',
	'overig'
];

/** What a shape stands for, as a legend names it. */
export const VORM_LABEL: Record<Vorm, string> = {
	regel: 'Wet of verdrag',
	'regel-o': 'Artikel',
	uitspraak: 'Uitspraak',
	dossier: 'Dossier',
	stuk: 'Stuk',
	voorstel: 'Wetsvoorstel',
	besluit: 'Stemming',
	activiteit: 'Activiteit',
	toezegging: 'Toezegging',
	persoon: 'Persoon',
	orgaan: 'Fractie',
	'orgaan-o': 'Commissie',
	kabinet: 'Kabinet',
	overig: 'Overig'
};

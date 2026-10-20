// Where the data comes from: each publisher once, with what it gives, its licence and the
// names of its sources in `data_as_of`. Bronnen en hergebruik reads it.
import { BRON_LABEL, type Collection } from '$lib/vocabulary';
import { CHAMBER_NAME } from '$lib/components/parliamentary/chamber';

const PUBLISHER_TERMS = 'Voorwaarden van de uitgever';
const CC0 = 'CC0 1.0';

type Publisher = {
	name: string;
	/** What it gives and from whom, as it starts the line (a site keeps its own case). */
	gives: string;
	/** The licence or terms as the publisher states them, with their page. */
	licence: { name: string; url: string };
	/** Its sources as the API names them in `data_as_of`, and as a reader knows them. */
	sources: Record<string, string>;
};

// The licence as the publisher states it on its own page (read 8 October 2026,
// ~/Development/bronnen-licenties.md). Where that is not clear: the publisher's terms.
export const PUBLISHERS: readonly Publisher[] = [
	{
		name: 'Wetgeving',
		gives: 'wetten.overheid.nl (Basiswettenbestand), op BWB-id',
		licence: { name: CC0, url: 'https://data.overheid.nl/dataset/basis-wetten-bestand' },
		sources: { bwb: 'wetten.overheid.nl' }
	},
	{
		name: 'Rechtspraak',
		gives: 'rechtspraak.nl, op ECLI',
		licence: { name: PUBLISHER_TERMS, url: 'https://www.rechtspraak.nl/colofon' },
		sources: { rechtspraak: 'rechtspraak.nl' }
	},
	{
		name: 'EHRM',
		gives: 'HUDOC, op ECLI of zaaknummer',
		licence: { name: PUBLISHER_TERMS, url: 'https://www.echr.coe.int/copyright-and-disclaimer' },
		sources: { echr: 'HUDOC' }
	},
	{
		name: CHAMBER_NAME.TK,
		gives: 'De open data van de Tweede Kamer; Kamerstukken op dossier- en ondernummer',
		licence: { name: CC0, url: 'https://opendata.tweedekamer.nl/disclaimer' },
		sources: { tk: CHAMBER_NAME.TK }
	},
	{
		name: CHAMBER_NAME.EK,
		gives: 'eerstekamer.nl; Kamerstukken op dossiernummer en letter',
		licence: { name: PUBLISHER_TERMS, url: 'https://www.eerstekamer.nl/begrip/colofon' },
		sources: { eerstekamer: CHAMBER_NAME.EK }
	},
	{
		name: 'Publicaties',
		gives: 'Staatsblad, Staatscourant en Tractatenblad, van officielebekendmakingen.nl',
		licence: { name: CC0, url: 'https://data.overheid.nl/dataset/officiele-bekendmakingen' },
		sources: { staatsblad: 'Staatsblad', staatscourant: 'Staatscourant' }
	},
	{
		name: 'Regering',
		gives: 'Kabinetten, hun periodes en bewindspersonen van rijksoverheid.nl',
		licence: { name: CC0, url: 'https://www.rijksoverheid.nl/copyright' },
		sources: { rijksoverheid: 'rijksoverheid.nl' }
	},
	{
		name: 'Europees recht',
		gives: 'EUR-Lex: handelingen op CELEX-nummer, uitspraken van het Hof en het Gerecht op ECLI',
		licence: {
			name: PUBLISHER_TERMS,
			url: 'https://eur-lex.europa.eu/content/legal-notice/legal-notice.html'
		},
		sources: { eurlex: 'EUR-Lex' }
	},
	{
		name: 'Verdragen',
		gives: 'De Verdragenbank van de Rijksoverheid',
		licence: { name: PUBLISHER_TERMS, url: 'https://verdragenbank.overheid.nl' },
		sources: { verdragenbank: 'Verdragenbank' }
	},
	{
		name: 'Organisaties',
		gives: 'Ministeries en rechtsgebieden uit de waardelijsten van de overheid (TOOI)',
		licence: { name: PUBLISHER_TERMS, url: 'https://standaarden.overheid.nl/tooi' },
		sources: { tooi: 'TOOI' }
	}
];

/** The sources the API names in `data_as_of`, as a reader knows them. */
export const SOURCE_LABEL: Readonly<Record<string, string>> = Object.fromEntries(
	PUBLISHERS.flatMap((p) => Object.entries(p.sources))
);

/** Where the coverage names a collection more widely than its plural in BRON_LABEL. */
const COVERAGE_WIDER: Partial<Record<Collection, string>> = {
	instruments: 'Wetten en regelingen',
	documents: 'Kamerstukken en andere documenten',
	members: 'Personen'
};

/** The collections the dekking lists, by their plural. */
export const COVERAGE: readonly { collection: Collection; label: string }[] = (
	[
		'instruments',
		'articles',
		'judgments',
		'dossiers',
		'documents',
		'members',
		'committees',
		'cabinets',
		'commitments'
	] as const
).map((collection) => ({
	collection,
	label: COVERAGE_WIDER[collection] ?? BRON_LABEL[collection][1]
}));

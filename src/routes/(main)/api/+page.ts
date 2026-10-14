import type { PageLoad } from './$types';
import apiDocs from 'virtual:api-docs';
import type { EndpointDoc } from '$lib/api/docs';
import { bronPlural } from '$lib/vocabulary';

// Tag order and Dutch text, a collection by its plural. A tag missing here still renders, after
// these, under its own name.
const TAGS: Record<string, { label: string; description: string }> = {
	instruments: {
		label: 'Instrumenten',
		description:
			'Regelingen, verdragen en Europese instrumenten, met artikelen, tekst op een datum en wijzigingen.'
	},
	articles: {
		label: bronPlural('articles'),
		description:
			'Een artikel met tekst, versies, wetsgeschiedenis, verwijzingen en aanhangige wijzigingen.'
	},
	annexes: {
		label: bronPlural('annexes'),
		description: 'Een bijlage bij een instrument en de artikelen waarvan zij de reikwijdte bepaalt.'
	},
	judgments: {
		label: bronPlural('judgments'),
		description: 'Uitspraken per ECLI, met de artikelen waarnaar ze verwijzen.'
	},
	dossiers: {
		label: bronPlural('dossiers'),
		description: 'Kamerdossiers: stand, tijdlijn, stukken en voorgestelde wijzigingen.'
	},
	documents: {
		label: bronPlural('documents'),
		description:
			'Kamerstukken van beide Kamers en publicaties in Staatsblad en Staatscourant, met tekst.'
	},
	decisions: {
		label: bronPlural('decisions'),
		description: 'Besluiten van beide Kamers, met de stemmen.'
	},
	members: {
		label: 'Personen',
		description: 'Kamerleden en bewindspersonen van beide Kamers, met stemmen en dossiers.'
	},
	factions: {
		label: bronPlural('factions'),
		description: 'Fracties van beide Kamers, met zetels, stemmen en dossiers.'
	},
	committees: {
		label: bronPlural('committees'),
		description: 'Commissies van beide Kamers, met leden, dossiers en activiteiten.'
	},
	parliament: { label: 'Parlement', description: 'Zetelverdeling per Kamer.' },
	parties: { label: 'Partijen', description: 'Kleur per partij.' },
	cabinets: {
		label: bronPlural('cabinets'),
		description: 'Kabinetten met periode, coalitie en bewindspersonen per ministerie.'
	},
	ministries: {
		label: 'Ministeries',
		description:
			'De ministeries in protocolvolgorde; een voormalig ministerie staat bij zijn opvolger.'
	},
	commitments: {
		label: bronPlural('commitments'),
		description: 'Toezeggingen van bewindspersonen, met hun stand.'
	},
	feed: {
		label: 'Actueel',
		description: 'Wat er per dag bijkwam, als lijst, als samenvatting en als Atom-feed.'
	},
	nodes: {
		label: 'Bronnen',
		description:
			'Een bron met al haar verbindingen, haar omgeving binnen enkele stappen, en de lagen voor aanhangige wijzigingen en recente activiteit.'
	},
	paths: { label: 'Paden', description: 'De kortste paden tussen twee tot vijf gekozen bronnen.' },
	relationships: {
		label: 'Verwijzingen tussen artikelen',
		description: 'Verwijzingen tussen artikelen naar hun aard: de soorten, en erop zoeken.'
	},
	search: { label: 'Zoeken', description: 'Zoeken over elf soorten bronnen, best passende eerst.' },
	resolve: {
		label: 'Citaat herleiden',
		description: 'De bron die een citaat, nummer of wetsnaam aanwijst.'
	},
	lookup: {
		label: 'Adres opzoeken',
		description: 'De bron achter een leesbaar adres; precies, of niets.'
	},
	stats: {
		label: 'Statistieken',
		description:
			'Aantallen per soort bron en verbinding, dekking van de rechtspraak, en de datum per bron.'
	},
	root: { label: 'Service', description: 'Naam, versie en bereikbaarheid.' }
};
const TAG_ORDER = Object.keys(TAGS);

export const load: PageLoad = () => {
	const byTag = new Map<string, EndpointDoc[]>();
	for (const doc of apiDocs.endpoints) byTag.set(doc.tag, [...(byTag.get(doc.tag) ?? []), doc]);

	const rank = (tag: string) => {
		const i = TAG_ORDER.indexOf(tag);
		return i < 0 ? TAG_ORDER.length : i;
	};
	const tags = [...byTag.entries()]
		.sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
		.map(([tag, endpoints]) => ({
			tag,
			label: TAGS[tag]?.label ?? tag,
			description: TAGS[tag]?.description ?? '',
			endpoints
		}));

	return {
		version: apiDocs.version,
		tags,
		totalEndpoints: apiDocs.endpoints.length
	};
};

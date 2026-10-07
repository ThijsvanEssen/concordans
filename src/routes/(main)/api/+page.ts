import type { PageLoad } from './$types';
import openapi from '$lib/api/openapi.json';

interface SchemaNode {
	$ref?: string;
	type?: string;
	items?: SchemaNode;
}

interface OpenApiParam {
	name: string;
	in: string;
	required?: boolean;
	description?: string;
	schema?: {
		type?: string;
		items?: { type?: string };
		description?: string;
		default?: unknown;
		enum?: unknown[];
		minimum?: number;
		maximum?: number;
		anyOf?: Array<{ type?: string }>;
	};
}

interface OpenApiOperation {
	tags?: string[];
	summary?: string;
	description?: string;
	operationId?: string;
	parameters?: OpenApiParam[];
	responses?: Record<
		string,
		{ description?: string; content?: Record<string, { schema?: SchemaNode }> }
	>;
}

export interface EndpointDoc {
	method: string;
	path: string;
	summary: string;
	description: string;
	parameters: OpenApiParam[];
	responses: Array<{ status: string; description: string; schema: string | null }>;
	operationId: string;
}

// Tag order and Dutch text. A tag missing here still renders, after these, under its own name.
const TAGS: Record<string, { label: string; description: string }> = {
	instruments: {
		label: 'Instrumenten',
		description:
			'Regelingen, verdragen en Europese instrumenten, met artikelen, tekst op een datum en wijzigingen.'
	},
	articles: {
		label: 'Artikelen',
		description:
			'Een artikel met tekst, versies, wetsgeschiedenis, verwijzingen en aanhangige wijzigingen.'
	},
	annexes: {
		label: 'Bijlagen',
		description: 'Een bijlage bij een instrument en de artikelen waarvan zij de reikwijdte bepaalt.'
	},
	judgments: {
		label: 'Uitspraken',
		description: 'Uitspraken per ECLI, met de artikelen waarnaar ze verwijzen.'
	},
	dossiers: {
		label: 'Dossiers',
		description: 'Kamerdossiers: stand, tijdlijn, stukken en voorgestelde wijzigingen.'
	},
	documents: {
		label: 'Stukken',
		description:
			'Kamerstukken van beide Kamers en publicaties in Staatsblad en Staatscourant, met tekst.'
	},
	decisions: {
		label: 'Stemmingen',
		description: 'Besluiten van beide Kamers, met de stemmen.'
	},
	members: {
		label: 'Personen',
		description: 'Kamerleden en bewindspersonen van beide Kamers, met stemmen en dossiers.'
	},
	factions: {
		label: 'Fracties',
		description: 'Fracties van beide Kamers, met zetels, stemmen en dossiers.'
	},
	committees: {
		label: 'Commissies',
		description: 'Commissies van beide Kamers, met leden, dossiers en activiteiten.'
	},
	parliament: { label: 'Parlement', description: 'Zetelverdeling per Kamer.' },
	parties: { label: 'Partijen', description: 'Kleur per partij.' },
	cabinets: {
		label: 'Kabinetten',
		description: 'Kabinetten met periode, coalitie en bewindspersonen per ministerie.'
	},
	ministries: {
		label: 'Ministeries',
		description:
			'De ministeries in protocolvolgorde; een voormalig ministerie staat bij zijn opvolger.'
	},
	commitments: {
		label: 'Toezeggingen',
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

function schemaName(s?: SchemaNode): string | null {
	if (!s) return null;
	if (s.$ref) return s.$ref.split('/').pop() ?? null;
	if (s.type === 'array') return `${schemaName(s.items) ?? 'any'}[]`;
	return s.type ?? null;
}

export const load: PageLoad = () => {
	const spec = openapi as unknown as {
		info: { version: string };
		paths: Record<string, Record<string, OpenApiOperation>>;
	};
	const byTag = new Map<string, EndpointDoc[]>();

	for (const [path, ops] of Object.entries(spec.paths)) {
		for (const [method, op] of Object.entries(ops)) {
			if (method !== 'get') continue;
			const tag = op.tags?.[0] ?? 'root';
			const doc: EndpointDoc = {
				method: method.toUpperCase(),
				path,
				summary: op.summary ?? '',
				description: op.description ?? '',
				parameters: op.parameters ?? [],
				responses: Object.entries(op.responses ?? {}).map(([status, r]) => ({
					status,
					description: r.description ?? '',
					schema: schemaName(r.content?.['application/json']?.schema)
				})),
				operationId: op.operationId ?? `${method}-${path}`
			};
			byTag.set(tag, [...(byTag.get(tag) ?? []), doc]);
		}
	}

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
			endpoints: endpoints.sort(
				(a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)
			)
		}));

	return {
		version: spec.info.version,
		tags,
		totalEndpoints: tags.reduce((sum, t) => sum + t.endpoints.length, 0)
	};
};

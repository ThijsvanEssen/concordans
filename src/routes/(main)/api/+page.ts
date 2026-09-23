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
	requestBody?: { content?: Record<string, { schema?: SchemaNode }> };
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
	requestSchema: string | null;
	responses: Array<{ status: string; description: string; schema: string | null }>;
	operationId: string;
}

// Tag order and Dutch text. A tag missing here still renders, after these, under its own name.
const TAGS: Record<string, { label: string; description: string }> = {
	instruments: {
		label: 'Instrumenten',
		description:
			'Wetten, AMvB’s, ministeriële regelingen, verdragen en Europese instrumenten, met artikelen, toestanden en wijzigingen.'
	},
	articles: {
		label: 'Artikelen',
		description:
			'Artikel met tekst, versiegeschiedenis, wetgevingsgeschiedenis, verwijzingen en aanhangige wijzigingen.'
	},
	annexes: {
		label: 'Bijlagen',
		description:
			'Bijlagen bij instrumenten en de artikelen waarvan de reikwijdte erdoor wordt bepaald.'
	},
	judgments: {
		label: 'Uitspraken',
		description: 'Uitspraken per ECLI, met de artikelen waarnaar ze verwijzen.'
	},
	dossiers: {
		label: 'Dossiers',
		description:
			'Wetgevingsdossiers van de Tweede Kamer: stand, tijdlijn, documenten en voorgestelde wijzigingen.'
	},
	decisions: {
		label: 'Stemmingen',
		description: 'Besluiten van de Kamer met de uitgebrachte stemmen en het besluit zelf.'
	},
	committees: {
		label: 'Commissies',
		description: 'Commissies met hun leden en de dossiers waarvoor ze de voortouwcommissie zijn.'
	},
	members: {
		label: 'Kamerleden',
		description: 'Kamerleden, hun stemmen en de instrumenten waarvoor ze wijzigingen voorstelden.'
	},
	factions: {
		label: 'Fracties',
		description: 'Fracties met zetels en de instrumenten waarvoor ze wijzigingen voorstelden.'
	},
	parties: { label: 'Partijen', description: 'Kleurcode per partij.' },
	parliament: { label: 'Parlement', description: 'Zetelverdeling van de Tweede Kamer.' },
	documents: {
		label: 'Documenten',
		description:
			'Kamerstukken en publicaties (Staatsblad, Staatscourant, Eerste Kamer), als metadata of met tekst.'
	},
	relationships: {
		label: 'Semantische verbindingen',
		description: 'Geclassificeerde verwijzingen tussen artikelen: de typen, en erop zoeken.'
	},
	nodes: {
		label: 'Bronnen',
		description:
			'Een bron met al zijn verbindingen, de omgeving binnen enkele stappen en de overlays voor aanhangige wijzigingen en recente activiteit.'
	},
	graph: {
		label: 'Netwerk',
		description: 'Delen van het netwerk als bronnen en verbindingen.'
	},
	search: { label: 'Zoeken', description: 'Tekstzoekopdracht over acht typen bronnen.' },
	stats: {
		label: 'Statistieken',
		description: 'Aantal bronnen per collectie en aantal verbindingen per type.'
	},
	root: { label: 'Service', description: 'Naam, versie en bereikbaarheid van de database.' }
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
				requestSchema: schemaName(op.requestBody?.content?.['application/json']?.schema),
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

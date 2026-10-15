// The routes of the API as /api shows them, taken from the OpenAPI schema at build time
// (virtual:api-docs in vite.config.ts): the page carries these, not the whole schema.

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

interface OpenApiSpec {
	info: { version: string };
	paths: Record<string, Record<string, OpenApiOperation>>;
}

interface ParamDoc {
	name: string;
	in: string;
	type: string;
	required: boolean;
	description: string;
	/** The default as text, null without one. */
	default: string | null;
}

export interface EndpointDoc {
	tag: string;
	method: string;
	path: string;
	summary: string;
	description: string;
	parameters: ParamDoc[];
	responses: Array<{ status: string; description: string; schema: string | null }>;
	operationId: string;
}

export interface ApiDocs {
	version: string;
	endpoints: EndpointDoc[];
}

function schemaName(s?: SchemaNode): string | null {
	if (!s) return null;
	if (s.$ref) return s.$ref.split('/').pop() ?? null;
	if (s.type === 'array') return `${schemaName(s.items) ?? 'any'}[]`;
	return s.type ?? null;
}

function paramType(schema: OpenApiParam['schema']): string {
	if (schema?.type === 'array') return `${schema.items?.type ?? 'any'}[]`;
	if (schema?.type) return schema.type;
	const types = schema?.anyOf?.map((a) => a.type).filter((t) => t && t !== 'null') ?? [];
	return types.join(' | ') || 'any';
}

function paramDoc(p: OpenApiParam): ParamDoc {
	return {
		name: p.name,
		in: p.in,
		type: paramType(p.schema),
		required: p.required ?? false,
		description: p.description ?? p.schema?.description ?? '',
		default: p.schema?.default === undefined ? null : String(p.schema.default)
	};
}

/** The GET routes of `spec`, sorted by path; a route without a tag under 'root'. */
export function apiDocs(spec: OpenApiSpec): ApiDocs {
	const endpoints = Object.entries(spec.paths).flatMap(([path, ops]) => {
		const op = ops.get;
		if (!op) return [];
		return [
			{
				tag: op.tags?.[0] ?? 'root',
				method: 'GET',
				path,
				summary: op.summary ?? '',
				description: op.description ?? '',
				parameters: (op.parameters ?? []).map(paramDoc),
				responses: Object.entries(op.responses ?? {}).map(([status, r]) => ({
					status,
					description: r.description ?? '',
					schema: schemaName(r.content?.['application/json']?.schema)
				})),
				operationId: op.operationId ?? `get-${path}`
			}
		];
	});
	return {
		version: spec.info.version,
		endpoints: endpoints.sort((a, b) => a.path.localeCompare(b.path))
	};
}

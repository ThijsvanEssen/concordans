import type { PageLoad } from './$types';
import openapi from '$lib/api/openapi.json';

interface OpenApiParam {
	name: string;
	in: string;
	required?: boolean;
	description?: string;
	schema?: {
		type?: string;
		title?: string;
		description?: string;
		default?: unknown;
		enum?: unknown[];
		minimum?: number;
		maximum?: number;
		anyOf?: Array<{ type?: string }>;
	};
}

interface OpenApiResponse {
	description?: string;
	content?: Record<
		string,
		{ schema?: { $ref?: string; type?: string; items?: { $ref?: string } } }
	>;
}

export interface EndpointDoc {
	method: string;
	path: string;
	tag: string;
	summary: string;
	description: string;
	parameters: OpenApiParam[];
	responses: Array<{ status: string; description: string; schemaRef: string | null }>;
	operationId: string;
}

export const load: PageLoad = () => {
	const spec = openapi as unknown as {
		info: { title: string; description: string; version: string };
		paths: Record<
			string,
			Record<
				string,
				{
					tags?: string[];
					summary?: string;
					description?: string;
					operationId?: string;
					parameters?: OpenApiParam[];
					responses?: Record<string, OpenApiResponse>;
				}
			>
		>;
	};

	const byTag = new Map<string, EndpointDoc[]>();
	const httpMethods = new Set(['get', 'post', 'put', 'delete', 'patch']);

	for (const [path, ops] of Object.entries(spec.paths)) {
		for (const [method, op] of Object.entries(ops)) {
			if (!httpMethods.has(method)) continue;
			const tag = op.tags?.[0] ?? 'overig';
			const responses = Object.entries(op.responses ?? {}).map(([status, r]) => {
				const jsonContent = r.content?.['application/json'];
				const refSource = jsonContent?.schema?.$ref ?? jsonContent?.schema?.items?.$ref ?? null;
				const schemaRef = refSource ? (refSource.split('/').pop() ?? null) : null;
				return { status, description: r.description ?? '', schemaRef };
			});
			const doc: EndpointDoc = {
				method: method.toUpperCase(),
				path,
				tag,
				summary: op.summary ?? '',
				description: op.description ?? '',
				parameters: op.parameters ?? [],
				responses,
				operationId: op.operationId ?? `${method}-${path}`
			};
			if (!byTag.has(tag)) byTag.set(tag, []);
			byTag.get(tag)!.push(doc);
		}
	}

	// Stable sort: tags alphabetical, paths alphabetical inside each tag
	const tags = [...byTag.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([tag, endpoints]) => ({
			tag,
			endpoints: endpoints.sort(
				(a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)
			)
		}));

	return {
		title: spec.info.title,
		description: spec.info.description,
		version: spec.info.version,
		tags,
		totalEndpoints: tags.reduce((sum, t) => sum + t.endpoints.length, 0)
	};
};

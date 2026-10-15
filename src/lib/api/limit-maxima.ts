// The largest `limit` of each GET route that has one, read from the OpenAPI schema at build
// time (virtual:api-limits in vite.config.ts; the page carries these, not the schema).

type Schema = { type?: string; maximum?: number; anyOf?: Schema[] };
type Spec = {
	paths: Record<string, { get?: { parameters?: { name: string; schema?: Schema }[] } }>;
};

const maximumOf = (s: Schema | undefined): number | undefined =>
	s?.maximum ?? s?.anyOf?.map(maximumOf).find((m) => m !== undefined);

export function limitMaxima(spec: Spec): Record<string, number> {
	const out: Record<string, number> = {};
	for (const [path, item] of Object.entries(spec.paths)) {
		const limit = item.get?.parameters?.find((p) => p.name === 'limit');
		const max = maximumOf(limit?.schema);
		if (max !== undefined) out[path] = max;
	}
	return out;
}

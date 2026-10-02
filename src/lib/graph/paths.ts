// What a path between chosen bronnen draws (API 0.74, /api/paths, BE-49). A version of an
// article is no bron on the canvas: a stuk that EXPLAINS a version of art. 3:7 explains
// art. 3:7, and the hop through the version (VERSION_OF) folds onto the article.

type PathNode = { collection: string; key: string };
type PathEdge = { id: string; source: string; target: string; relation: string | null };

const idOf = (n: PathNode) => `${n.collection}/${n.key}`;

/** The nodes and edges of a path set with every article version folded onto its article. */
export function foldVersions<N extends PathNode, E extends PathEdge>(
	nodes: N[],
	edges: E[]
): { nodes: N[]; edges: E[] } {
	const isVersion = (id: string) => id.startsWith('article_versions/');
	// Each version to the article it is a version of, as the path's VERSION_OF says.
	const articleOf = new Map<string, string>();
	for (const e of edges) {
		if (e.relation !== 'VERSION_OF') continue;
		if (isVersion(e.source) && !isVersion(e.target)) articleOf.set(e.source, e.target);
		else if (isVersion(e.target) && !isVersion(e.source)) articleOf.set(e.target, e.source);
	}
	const to = (id: string) => (isVersion(id) ? (articleOf.get(id) ?? null) : id);
	const folded: E[] = [];
	for (const e of edges) {
		if (e.relation === 'VERSION_OF') continue;
		const source = to(e.source);
		const target = to(e.target);
		if (!source || !target || source === target) continue;
		folded.push({ ...e, source, target });
	}
	return { nodes: nodes.filter((n) => !isVersion(idOf(n))), edges: folded };
}

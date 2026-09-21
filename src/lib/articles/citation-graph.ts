import type { ArticleCitationSpan, ArticleDetailResponse } from '$lib/api/types';

export type ArticleKey = string;

export function keyOf(bwb_id: string, article_number: string): ArticleKey {
	return `${bwb_id}::${article_number}`;
}

export function extractArticleTargets(
	citations: ArticleCitationSpan[] = []
): { bwb_id: string; article_number: string; display_name?: string | null }[] {
	const seen = new Set<ArticleKey>();
	const results: { bwb_id: string; article_number: string; display_name?: string | null }[] = [];

	for (const citation of citations) {
		const target = citation.target;
		if (!target.bwb_id || !target.article_number) continue;
		const key = keyOf(target.bwb_id, target.article_number);
		if (seen.has(key)) continue;
		seen.add(key);
		results.push({
			bwb_id: target.bwb_id,
			article_number: target.article_number,
			display_name: target.display_name
		});
	}

	return results;
}

export type BuildCitationGraphOptions = {
	root: ArticleDetailResponse;
	depth: number;
	maxFetch: number;
	fetchArticle: (bwb_id: string, article_number: string) => Promise<ArticleDetailResponse>;
	existingNodes?: Map<ArticleKey, ArticleDetailResponse>;
};

export type BuildCitationGraphResult = {
	rootKey: ArticleKey;
	nodes: Map<ArticleKey, ArticleDetailResponse>;
	edges: Map<ArticleKey, ArticleKey[]>;
	errors: Map<ArticleKey, string>;
	targetMeta: Map<
		ArticleKey,
		{ bwb_id: string; article_number: string; display_name?: string | null }
	>;
	fetches: number;
};

type QueueEntry = {
	key: ArticleKey;
	bwb_id: string;
	article_number: string;
	level: number;
	needsFetch: boolean;
};

export async function buildCitationGraph(
	opts: BuildCitationGraphOptions
): Promise<BuildCitationGraphResult> {
	const { root, depth, maxFetch, fetchArticle, existingNodes } = opts;

	const normalizedDepth = Math.min(Math.max(depth, 1), 3);
	const rootBwb = root.article.bwb_id;
	const rootNumber = root.article.article_number;

	if (!rootBwb || !rootNumber) throw new Error('root article missing identifiers');

	const rootKey = keyOf(rootBwb, rootNumber);
	const nodes = new Map<ArticleKey, ArticleDetailResponse>(existingNodes ?? []);
	nodes.set(rootKey, root);
	const edges = new Map<ArticleKey, ArticleKey[]>();
	const errors = new Map<ArticleKey, string>();
	const targets = new Map<
		ArticleKey,
		{ bwb_id: string; article_number: string; display_name?: string | null }
	>();

	const visited = new Set<ArticleKey>();
	const queue: QueueEntry[] = [];

	const registerTargets = (
		citations: { bwb_id: string; article_number: string; display_name?: string | null }[] = []
	) => {
		for (const c of citations) {
			const key = keyOf(c.bwb_id, c.article_number);
			if (!targets.has(key)) targets.set(key, c);
		}
	};

	const rootTargets = extractArticleTargets(root.citations ?? []);
	edges.set(
		rootKey,
		rootTargets.map((t) => keyOf(t.bwb_id, t.article_number))
	);
	registerTargets(rootTargets);

	const enqueueTarget = (target: { bwb_id: string; article_number: string }, level: number) => {
		const key = keyOf(target.bwb_id, target.article_number);
		if (visited.has(key) || level > normalizedDepth) return;
		visited.add(key);
		queue.push({
			key,
			bwb_id: target.bwb_id,
			article_number: target.article_number,
			level,
			needsFetch: !nodes.has(key)
		});
	};

	for (const target of rootTargets) enqueueTarget(target, 1);

	let fetches = 0;

	while (queue.length > 0) {
		const entry = queue.shift()!;
		if (entry.level > normalizedDepth) continue;
		if (entry.needsFetch && fetches >= maxFetch) continue;

		let detail: ArticleDetailResponse | undefined = nodes.get(entry.key);

		if (entry.needsFetch) {
			try {
				fetches += 1;
				detail = await fetchArticle(entry.bwb_id, entry.article_number);
				nodes.set(entry.key, detail);
			} catch (error) {
				errors.set(entry.key, error instanceof Error ? error.message : 'Onbekende fout');
				continue;
			}
		}

		if (!detail) continue;

		const citations = extractArticleTargets(detail.citations ?? []);
		registerTargets(citations);
		edges.set(
			entry.key,
			citations.map((t) => keyOf(t.bwb_id, t.article_number))
		);

		if (entry.level === normalizedDepth) continue;
		for (const target of citations) enqueueTarget(target, entry.level + 1);
	}

	return { rootKey, nodes, edges, errors, targetMeta: targets, fetches };
}

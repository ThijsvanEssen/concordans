// Every reference the text of an article makes, as a link (K2). The API resolves one
// citation per target (`citations`); the text names a target again, or names only a law or a
// division of it, in `references`. Each such mention becomes a span to the same target: the
// article a citation already resolved, the law by its BWB id, a division of the law where its
// list of articles names it. A mention whose target is unknown stays text: no dead link.
import type { Schema } from '$lib/api/types';
import type { Span } from './segments';

export type Reference = Schema<'ArticleReferenceDTO'>;

/** A division of a law as its list of articles gives it in `breadcrumb`. */
export type Crumb = { type?: string | null; label?: string | null; anchor: string };

/** The parameters of a JCI link that name a place in an article, not a division. */
const NOT_A_DIVISION = new Set(['artikel', 'lid', 'onderdeel', 'z', 'g', 'sub', 'aanhef']);

/** The parameters of a JCI link (`jci1.3:c:BWBR0007119&hoofdstuk=IV`), in order. */
function jciParams(doc: string): [string, string][] {
	const [head, ...rest] = doc.split('&');
	if (!/^jci[\d.]*:c:/i.test(head)) return [];
	return rest.flatMap((p) => {
		const [k, v] = p.split('=');
		return k && v ? [[k.toLowerCase(), decodeURIComponent(v)] as [string, string]] : [];
	});
}

/** Whether the link names the law alone: `jci1.3:c:BWBR0016637`. */
const namesLawOnly = (doc: string) => /^jci[\d.]*:c:[^&]+$/i.test(doc.trim());

const lastWord = (s: string | null | undefined) =>
	(s ?? '').trim().split(/\s+/).at(-1)?.toLowerCase() ?? '';

/**
 * The anchor of the division a JCI link names (`hoofdstuk=IV` → `deel-hoofdstuk-iv`), from
 * the divisions of the law: the innermost layer the link names, by its kind and number.
 * Null where the link names no division, or the law has none like it.
 */
export function divisionAnchor(doc: string, crumbs: readonly Crumb[]): string | null {
	const layers = jciParams(doc).filter(([k]) => !NOT_A_DIVISION.has(k));
	const inner = layers.at(-1);
	if (!inner || jciParams(doc).some(([k]) => k === 'artikel')) return null;
	const [kind, number] = inner;
	const value = number.toLowerCase();
	return (
		crumbs.find((c) => c.type?.toLowerCase() === kind && lastWord(c.label) === value)?.anchor ??
		null
	);
}

const normalKey = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');

/** The article target a citation resolved for this reference's law and article, if any. */
function resolvedArticle(ref: Reference, citations: readonly Span[]) {
	if (!ref.bwb_id || !ref.article) return null;
	const key = `${normalKey(ref.bwb_id)}_${normalKey(ref.article)}`;
	return (
		citations.find(
			({ target: t }) =>
				t.collection === 'articles' &&
				(t.key === key ||
					(t.bwb_id?.toUpperCase() === ref.bwb_id!.toUpperCase() &&
						t.article_number === ref.article))
		)?.target ?? null
	);
}

const lawTarget = (bwb: string): Span['target'] => ({
	id: `instruments/${bwb.toLowerCase()}`,
	key: bwb.toLowerCase(),
	collection: 'instruments',
	bwb_id: bwb,
	article_number: null,
	display_name: null
});

/** Whether a reference names a division of the law `law` (its list is needed to place it). */
export const namesOwnDivision = (references: readonly Reference[], law: string | null) =>
	!!law &&
	references.some(
		(r) =>
			!r.article &&
			r.bwb_id?.toUpperCase() === law.toUpperCase() &&
			!namesLawOnly(r.doc) &&
			jciParams(r.doc).length > 0
	);

const overlaps = (a: { start: number; end: number }, spans: readonly Span[]) =>
	spans.some((s) => s.start != null && s.end != null && a.start < s.end && a.end > s.start);

/**
 * The citations with a span for every other reference whose target is known, in text
 * order. `crumbs` are the divisions of the article's own law (its list), for a reference to
 * a division of it; a division of another law opens that law. A reference that overlaps a
 * citation is that citation.
 */
export function referenceSpans(
	citations: readonly Span[],
	references: readonly Reference[],
	{ ownLaw = null, crumbs = [] }: { ownLaw?: string | null; crumbs?: readonly Crumb[] } = {}
): Span[] {
	const added: Span[] = [];
	for (const ref of references) {
		if (ref.end <= ref.start || overlaps(ref, citations) || overlaps(ref, added)) continue;
		// The place it names (its leden and onderdelen) and its words, as a citation has them.
		const base = {
			...ref,
			kind: 'article',
			reference_kind: ref.kind,
			confidence: null,
			definition_ref: null
		};
		const article = resolvedArticle(ref, citations);
		if (article) {
			added.push({ ...base, target: article });
			continue;
		}
		if (!ref.bwb_id || ref.article) continue;
		if (namesLawOnly(ref.doc)) {
			added.push({ ...base, kind: 'instrument', target: lawTarget(ref.bwb_id) });
			continue;
		}
		// A division: of the own law at its heading, of another the law itself.
		const own = !!ownLaw && ownLaw.toUpperCase() === ref.bwb_id.toUpperCase();
		const at = own ? divisionAnchor(ref.doc, crumbs) : null;
		if (own && !at) continue;
		if (jciParams(ref.doc).length === 0) continue;
		added.push({ ...base, kind: 'instrument', target: lawTarget(ref.bwb_id), at });
	}
	if (added.length === 0) return [...citations];
	return [...citations, ...added].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
}

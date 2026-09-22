<script lang="ts">
	// Inline text in which the spans the API found are links to the cited bron, at the
	// lid or onderdeel the source names.
	import { page } from '$app/state';
	import { getArticleDetail } from '$lib/api/articles';
	import type { Schema } from '$lib/api/types';
	import { bronHref } from '$lib/bron/href';
	import { parseArticleParts, partText } from '$lib/text/article-parts';
	import { anchorOf, parseQualifier } from '$lib/text/qualifier';
	import { isCollection } from '$lib/vocabulary';

	type Span = Schema<'ArticleCitationSpan'>;

	let {
		text,
		citations = []
	}: {
		text: string;
		/** Offsets are relative to `text`. */
		citations?: Span[];
	} = $props();

	type Segment = { content: string; span?: Span; at?: string | null };

	/** How much of what follows a span is read for a qualifier ("…, tweede lid,"). */
	const FOLLOWING = 80;

	const segments = $derived.by<Segment[]>(() => {
		const out: Segment[] = [];
		let cursor = 0;
		const sorted = citations
			.filter((c) => c.start != null && c.end != null)
			.sort((a, b) => a.start! - b.start!);
		for (const span of sorted) {
			if (span.start! < cursor) continue;
			if (span.start! > cursor) out.push({ content: text.slice(cursor, span.start!) });
			const content = text.slice(span.start!, span.end!);
			const at =
				span.target.collection === 'articles'
					? anchorOf(parseQualifier(content, text.slice(span.end!, span.end! + FOLLOWING)))
					: null;
			out.push({ content, span, at });
			cursor = span.end!;
		}
		if (cursor < text.length) out.push({ content: text.slice(cursor) });
		return out;
	});

	const href = (seg: Segment) => {
		const { collection, key } = seg.span!.target;
		return isCollection(collection) ? bronHref({ collection, key }, { at: seg.at }) : undefined;
	};

	// ── The cited text, on hover ──────────────────────────────────────────────
	const HOVER_MS = 350;
	const PREVIEW_CHARS = 600;
	let preview = $state<{ index: number; text: string } | null>(null);
	let timer: ReturnType<typeof setTimeout> | null = null;

	function showPreview(index: number, seg: Segment) {
		const target = seg.span!.target;
		if (target.collection !== 'articles' || !target.bwb_id || !target.article_number) return;
		const { bwb_id, article_number } = target;
		timer = setTimeout(async () => {
			try {
				const { article } = await getArticleDetail(bwb_id, article_number);
				const parts = parseArticleParts(article.text);
				const cited = (seg.at && partText(article.text ?? '', parts, seg.at)) || article.text;
				if (timer && cited) preview = { index, text: cited.slice(0, PREVIEW_CHARS) };
			} catch {
				// Without the text the link still works.
			}
		}, HOVER_MS);
	}

	function hidePreview() {
		if (timer) clearTimeout(timer);
		timer = null;
		preview = null;
	}

	// A reference into the article on screen is a jump within the page.
	const samePage = (seg: Segment) =>
		page.url.searchParams.get('focus') === `${seg.span!.target.collection}/${seg.span!.target.key}`;
</script>

{#each segments as seg, i (i)}{#if seg.span}<a
			class="cite"
			href={samePage(seg) && seg.at ? `#${seg.at}` : href(seg)}
			data-sveltekit-noscroll
			onmouseenter={() => showPreview(i, seg)}
			onmouseleave={hidePreview}
			onfocus={() => showPreview(i, seg)}
			onblur={hidePreview}
			>{seg.content}{#if preview?.index === i}<span class="cite__preview" role="tooltip"
					>{preview.text}</span
				>{/if}</a
		>{:else}{seg.content}{/if}{/each}

<style>
	.cite {
		position: relative;
		color: var(--accent);
		text-decoration: underline;
		text-decoration-style: dotted;
		text-underline-offset: 3px;
		cursor: pointer;
		padding: 0 1px;
		border-radius: 2px;
		transition: background var(--dur-1) var(--ease);
	}

	.cite:hover,
	.cite:focus {
		background: var(--accent-soft);
		text-decoration-style: solid;
		outline: none;
	}

	.cite__preview {
		position: absolute;
		left: 0;
		top: 100%;
		z-index: 20;
		width: min(44ch, 80vw);
		margin-top: 4px;
		padding: var(--s-3);
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		box-shadow: 0 6px 24px rgb(0 0 0 / 0.12);
		font-family: var(--font-serif);
		font-size: 14px;
		line-height: 1.45;
		color: var(--ink-2);
		white-space: pre-line;
		text-decoration: none;
	}
</style>

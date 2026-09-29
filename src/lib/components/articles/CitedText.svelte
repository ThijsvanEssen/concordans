<script lang="ts">
	// Inline text in which the spans the API found are links to the cited bron, at the
	// lid or onderdeel the source names.
	import type { Schema } from '$lib/api/types';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { refOf } from '$lib/bron/href';
	import { anchorOf, parseQualifier, qualifierOfSpan } from '$lib/text/qualifier';
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
			// The API names the lid on the span (0.5); before that it is read from the text.
			const at =
				span.target.collection === 'articles'
					? anchorOf(
							qualifierOfSpan(span) ??
								parseQualifier(content, text.slice(span.end!, span.end! + FOLLOWING))
						)
					: null;
			out.push({ content, span, at });
			cursor = span.end!;
		}
		if (cursor < text.length) out.push({ content: text.slice(cursor) });
		return out;
	});

	/** The bron a span cites, or null for a target the front end has no page for. */
	const refOfSpan = (seg: Segment) => {
		const { collection, key } = seg.span!.target;
		return isCollection(collection) ? refOf(collection, key) : null;
	};
</script>

{#each segments as seg, i (i)}{#if seg.span && refOfSpan(seg)}<BronLink
			ref={refOfSpan(seg)!}
			at={seg.at}
			class="cited">{seg.content}</BronLink
		>{:else}{seg.content}{/if}{/each}

<style>
	/* The link lives in BronLink; its look is the text's own. */
	:global(a.cited) {
		color: var(--accent);
		text-decoration: underline;
		text-decoration-style: dotted;
		text-underline-offset: 3px;
		padding: 0 1px;
		border-radius: var(--r-1);
		transition: background var(--dur-1) var(--ease);
	}
	:global(a.cited:hover),
	:global(a.cited:focus-visible) {
		background: var(--accent-soft);
		text-decoration-style: solid;
		outline: none;
	}
</style>

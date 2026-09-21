<script lang="ts">
	// Inline text in which the spans the API found are links to the cited source.
	import type { Schema } from '$lib/api/types';

	type Span = Schema<'ArticleCitationSpan'>;

	let {
		text,
		citations = [],
		onNavigate
	}: {
		text: string;
		/** Offsets are relative to `text`. */
		citations?: Span[];
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	type Segment = { content: string; span?: Span };

	const segments = $derived.by<Segment[]>(() => {
		const out: Segment[] = [];
		let cursor = 0;
		const sorted = citations
			.filter((c) => c.start != null && c.end != null)
			.sort((a, b) => a.start! - b.start!);
		for (const span of sorted) {
			if (span.start! < cursor) continue;
			if (span.start! > cursor) out.push({ content: text.slice(cursor, span.start!) });
			out.push({ content: text.slice(span.start!, span.end!), span });
			cursor = span.end!;
		}
		if (cursor < text.length) out.push({ content: text.slice(cursor) });
		return out;
	});

	function open(target: Span['target'], event: MouseEvent) {
		if (!onNavigate) return;
		event.preventDefault();
		onNavigate(target.collection, target.key);
	}
</script>

{#each segments as seg, i (i)}{#if seg.span}{@const target = seg.span.target}<a
			class="cite"
			href="/explore?focus={encodeURIComponent(`${target.collection}/${target.key}`)}"
			title={target.display_name}
			onclick={(e) => open(target, e)}>{seg.content}</a
		>{:else}{seg.content}{/if}{/each}

<style>
	.cite {
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
</style>

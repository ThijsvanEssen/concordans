<script lang="ts">
	import { setFocusedCitation } from '$lib/stores/reader';
	import type { ArticleCitationSpan } from '$lib/api/types';

	let {
		text,
		citations = [],
		onNavigate
	}: {
		text: string | null | undefined;
		citations?: ArticleCitationSpan[];
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	type Segment =
		| { kind: 'text'; content: string }
		| { kind: 'citation'; content: string; span: ArticleCitationSpan };

	function buildSegments(raw: string, spans: ArticleCitationSpan[]): Segment[] {
		if (!spans.length) return [{ kind: 'text', content: raw }];

		const sorted = [...spans]
			.filter((s) => s.start != null && s.end != null)
			.sort((a, b) => (a.start ?? 0) - (b.start ?? 0));

		const result: Segment[] = [];
		let cursor = 0;

		for (const span of sorted) {
			const start = span.start ?? 0;
			const end = span.end ?? start;
			if (start < cursor) continue;
			if (start > cursor) result.push({ kind: 'text', content: raw.slice(cursor, start) });
			result.push({ kind: 'citation', content: raw.slice(start, end), span });
			cursor = end;
		}

		if (cursor < raw.length) result.push({ kind: 'text', content: raw.slice(cursor) });
		return result;
	}

	const paragraphs = $derived(() => {
		const raw = text ?? '';
		if (!raw) return [];
		return raw
			.split(/\r?\n\s*\r?\n+/)
			.map((p) => p.trim())
			.filter(Boolean)
			.map((p) => buildSegments(p, citations));
	});

	function citationLabel(span: ArticleCitationSpan): string {
		return span.target.display_name ?? span.target.article_number ?? 'Verwijzing';
	}

	function citationHref(span: ArticleCitationSpan): string | null {
		const { collection, key } = span.target;
		if (!collection || !key) return null;
		return `/explore?focus=${encodeURIComponent(`${collection}/${key}`)}`;
	}

	function citationClass(span: ArticleCitationSpan): string {
		const collection = span.target.collection;
		if (collection === 'judgments' || collection === 'instrument_judgments') {
			return 'citation-link citation-link--judgment';
		}
		if (collection && collection !== 'instrument_articles') {
			return 'citation-link citation-link--external';
		}
		return 'citation-link';
	}

	function handleCitationClick(span: ArticleCitationSpan, ev: MouseEvent) {
		setFocusedCitation(span.target.key);
		if (onNavigate) {
			ev.preventDefault();
			onNavigate(span.target.collection, span.target.key);
		}
	}

	function handleCitationFocus(span: ArticleCitationSpan) {
		setFocusedCitation(span.target.key);
	}

	function handleCitationBlur() {
		setFocusedCitation(null);
	}
</script>

{#if paragraphs().length === 0}
	<p class="article-text__empty">Geen tekst beschikbaar voor dit artikel.</p>
{:else}
	<div class="article-text">
		{#each paragraphs() as segments, i (i)}
			<p>
				{#each segments as seg, i (i)}
					{#if seg.kind === 'text'}
						{seg.content}
					{:else}
						{@const href = citationHref(seg.span)}
						{@const label = citationLabel(seg.span)}
						{#if href}
							<a
								class={citationClass(seg.span)}
								{href}
								title={label}
								onclick={(e) => handleCitationClick(seg.span, e)}
								onfocus={() => handleCitationFocus(seg.span)}
								onblur={handleCitationBlur}
								onmouseenter={() => handleCitationFocus(seg.span)}
								onmouseleave={handleCitationBlur}>{seg.content}</a
							>
						{:else}
							<span
								class="citation-ref citation-ref--unresolved"
								title="Verwijzing niet beschikbaar">{seg.content}</span
							>
						{/if}
					{/if}
				{/each}
			</p>
		{/each}
	</div>
{/if}

<style>
	.article-text {
		font-family: var(--font-serif);
		font-size: 18px;
		line-height: 1.62;
		color: var(--ink);
		max-width: 60ch;
	}

	.article-text p {
		margin: 0 0 1.25em;
	}

	.article-text p:last-child {
		margin-bottom: 0;
	}

	.article-text__empty {
		font-style: italic;
		color: var(--muted);
		font-family: var(--font-serif);
		font-size: var(--text-lg);
	}

	.citation-link {
		color: var(--citation-fg);
		text-decoration: underline;
		text-decoration-style: dotted;
		text-underline-offset: 3px;
		cursor: pointer;
		border-radius: 2px;
		transition: background 100ms;
		padding: 0 1px;
	}

	.citation-link:hover,
	.citation-link:focus {
		background: var(--citation-bg);
		text-decoration-style: solid;
		outline: none;
	}

	.citation-link--no-route {
		cursor: help;
	}

	.citation-link--external::after {
		content: ' ↗';
		font-size: 0.75em;
	}

	.citation-link--judgment {
		border-bottom-style: dashed;
	}

	.citation-ref--unresolved {
		color: var(--ink-2);
		border-bottom: 1px dotted var(--rule-strong);
		cursor: help;
	}
</style>

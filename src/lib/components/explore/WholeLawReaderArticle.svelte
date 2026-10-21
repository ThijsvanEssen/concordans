<script lang="ts">
	// One article of the whole law: its number and opschrift as the link to the article, and its one text
	// (articleText), else its preview. The article of today is asked alone once it comes near
	// the viewport: its references link (K2), and its text stands where its page lacked it.
	import Coverage from '$lib/components/ui/Coverage.svelte';
	import { naamVanId } from '$lib/bron/menselijk';
	import { bronHref } from '$lib/bron/href';
	import { onderdeelMark } from '$lib/text/article-parts';
	import { articleName } from '$lib/text/bw';
	import type { ArticleCitation } from '$lib/text/cite';
	import type { Schema } from '$lib/api/types';
	import ArticleText from '$lib/components/articles/ArticleText.svelte';
	import { PREVIEW_CHARS, articleText, asksAlone, type Row } from './law-list';

	let {
		row,
		bwbId,
		peildatum,
		detail,
		citationOf,
		onNear
	}: {
		row: Row;
		bwbId: string;
		peildatum: string | null;
		/** The article asked alone, of today: its text where the page lacks it, and the
		 *  references in it. */
		detail: Schema<'ArticleDetailResponse'> | undefined;
		citationOf: (articleNumber: string | null, heading: string | null) => ArticleCitation | null;
		/** Asks the article of today alone: its references, and its text where its page
		 *  did not bring it. */
		onNear: (articleNumber: string) => void;
	} = $props();

	const shown = $derived(articleText(row, peildatum ? undefined : detail?.article));
	// The references are those of today's text: on its own offsets only (not a peildatum).
	const linked = $derived(
		!peildatum && shown?.cited && detail?.article.text === shown.text ? detail : null
	);
	const name = $derived(articleName(bwbId, row.article_number, row.label) ?? naamVanId(row.id));

	/** How far below the viewport an article's full text is asked already. */
	const PRELOAD_MARGIN = '600px 0px';

	function near(el: HTMLElement, articleNumber: string | null) {
		if (!articleNumber) return {};
		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((e) => e.isIntersecting)) return;
				observer.disconnect();
				onNear(articleNumber);
			},
			{ rootMargin: PRELOAD_MARGIN }
		);
		observer.observe(el);
		return { destroy: () => observer.disconnect() };
	}
</script>

<section class="whole-article" data-artikel={row.address} use:near={asksAlone(row, peildatum)}>
	<div class="whole-article-head">
		<!-- The anchor of reading: Artikel 3:4, a BW article with its book (6:162). -->
		{#if row.key}
			<a
				class="whole-article-jump"
				href={bronHref(
					{ collection: 'articles', key: row.key },
					{ params: peildatum ? { peildatum } : {} }
				)}
				data-sveltekit-noscroll
				><span class="whole-art-num">{name}</span>{#if row.heading}<span class="whole-art-heading"
						>{` ${row.heading}`}</span
					>{/if}</a
			>
		{:else}
			<span class="whole-art-num">{name}</span>
			{#if row.heading}<span class="whole-art-heading">{row.heading}</span>{/if}
			<span class="whole-art-note">niet meer in de geldende tekst</span>
		{/if}
	</div>

	{#if shown}
		<ArticleText
			text={shown.text}
			parts={shown.parts}
			tables={shown.tables}
			headings={shown.headings}
			citations={linked?.citations ?? []}
			references={linked?.references ?? []}
			law={bwbId}
			citation={shown.cited
				? citationOf(row.address, row.article_number ? null : (row.label ?? null))
				: null}
			mark={onderdeelMark(bwbId)}
		/>
	{:else if row.text_preview}
		<p class="whole-text">
			{row.text_preview}{row.text_preview.length >= PREVIEW_CHARS ? '…' : ''}
		</p>
	{:else}
		<p class="whole-text">
			<span class="whole-empty-text stil"><Coverage noText /></span>
		</p>
	{/if}
</section>

<style>
	.whole-article {
		margin: var(--s-6) 0 0;
	}

	.whole-article-head {
		margin-bottom: var(--s-1);
	}
	/* The article a link landed on (#artikel-658): its number washed until the next click. */
	.whole-article:global(.is-landed) .whole-art-num {
		background: var(--wassing);
		box-shadow: 0 0 0 var(--s-1) var(--wassing);
	}

	.whole-article-jump {
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
		text-align: left;
	}

	.whole-art-num {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		font-weight: 600;
		color: var(--ink);
	}

	/* The opschrift beside the number, as the article's own title has it. */
	/* After the number a space and 4 px, as two words for a screen reader too. */
	.whole-art-heading {
		margin-left: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-body);
		color: var(--ink-2);
	}

	.whole-article-jump:hover .whole-art-num {
		color: var(--ink);
		text-decoration: underline;
	}

	.whole-art-note {
		margin-left: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	.whole-text {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		white-space: pre-line;
	}

	.whole-empty-text {
		margin: 0;
	}
</style>

<script lang="ts">
	import { createCopier } from '$lib/components/ui/copy.svelte';
	// The text of an article as its aanhef, leden and onderdelen. Every part has an
	// anchor, so a reference can point at it and the address can be shared. A lid is a
	// row of a grid: the number, the text, and a column at the right with the number of
	// verbindingen of that lid and, on hover, Citeer and Kopieer tekst. An onderdeel, at
	// any depth, shows the same two actions in that column, level with its own text.
	import CiteMenu from '$lib/components/ui/CiteMenu.svelte';
	import { citeItems } from '$lib/components/ui/cite';
	import { page } from '$app/state';
	import { permalink } from '$lib/bron/anchor';
	import type { Schema } from '$lib/api/types';
	import { parseArticleParts, partsFromApi, type ArticlePart } from '$lib/text/article-parts';
	import { citeArticle, partOfAnchor, type Citation } from '$lib/text/cite';
	import { formatCount } from '$lib/verbonden/filter';
	import type { ProposedText } from '$lib/verbonden/proposed-text';
	import CitedText from './CitedText.svelte';
	import { citationsWithin } from './citations';

	let {
		text,
		parts: apiParts = null,
		citations = [],
		counts = new Map(),
		lidHref,
		citation = null,
		proposed = null,
		onCloseProposed,
		lidNotes = new Map(),
		mark = '.'
	}: {
		text: string | null | undefined;
		/** The parts the API delivers (0.5); without them they are read from the text. */
		parts?: Schema<'ArticlePartDTO'>[] | null;
		citations?: Schema<'ArticleCitationSpan'>[];
		/** Verbindingen per lid; a lid without an entry shows no count. */
		counts?: Map<string, number>;
		/** The address that filters the panel Verbonden to a lid. */
		lidHref?: (lid: string) => string;
		/** What is needed to cite the article; without it Citeer is not offered. */
		citation?: Omit<Citation, 'lid' | 'onderdelen' | 'aanhef' | 'date'> | null;
		/** The wording a wetsvoorstel proposes for one lid, shown next to the current one. */
		proposed?: ProposedText | null;
		onCloseProposed?: () => void;
		/** Per lid, when it got its present wording, and the link to its history. */
		lidNotes?: Map<string, { label: string; href: string }>;
		/** The mark after an onderdeel's letter or number: `a.` in Dutch law, `a)` in EU law. */
		mark?: '.' | ')';
	} = $props();

	const source = $derived(text ?? '');
	const parts = $derived(apiParts?.length ? partsFromApi(apiParts) : parseArticleParts(source));

	const own = (part: ArticlePart) => {
		const raw = source.slice(part.textStart, part.textEnd);
		const lead = raw.length - raw.trimStart().length;
		const body = raw.trim();
		return {
			body,
			citations: citationsWithin(citations, part.textStart + lead, body.length)
		};
	};

	/** The part's text with its onderdelen, as Kopieer tekst puts it on the clipboard. */
	const fullText = (part: ArticlePart) => source.slice(part.textStart, part.end).trim();

	/** A part without an anchor (an article without leden) is keyed by its offset. */
	const keyOf = (part: ArticlePart) => part.id ?? `tekst-${part.start}`;

	let menuFor = $state<string | null>(null);
	const copier = createCopier();
	function copy(what: string, key: string) {
		void copier.copy(what, key);
		menuFor = null;
	}
	const copyLabel = (key: string, idle: string) => copier.label(key, idle);

	const formsOf = (part: ArticlePart) => {
		if (!citation || !part.id) return null;
		return citeArticle({ ...citation, ...partOfAnchor(part.id) });
	};
</script>

{#snippet actions(part: ArticlePart, className: string)}
	{@const key = keyOf(part)}
	{@const forms = formsOf(part)}
	<span class={className}>
		{#if forms}
			<CiteMenu
				items={citeItems(forms, permalink(page.url, part.id!))}
				name={forms.kort}
				buttonClass="btn act__btn"
				onToggle={(open) => (menuFor = open ? key : menuFor === key ? null : menuFor)}
			/>
		{/if}
		<button type="button" class="btn act__btn" onclick={() => copy(fullText(part), `text:${key}`)}
			>{copyLabel(`text:${key}`, 'Kopieer tekst')}</button
		>
	</span>
{/snippet}

{#snippet aside(part: ArticlePart)}
	{@const lid = part.kind === 'lid' ? part.number : null}
	{@const count = lid ? counts.get(lid) : undefined}
	{@const note = lid ? lidNotes.get(lid) : undefined}
	<div class="lid__side">
		{#if lid && count != null && lidHref}
			<a class="lid__count" href={lidHref(lid)} data-sveltekit-noscroll
				>{formatCount(count)} {count === 1 ? 'verbinding' : 'verbindingen'}</a
			>
		{/if}
		{#if note}
			<a
				class="lid__count"
				href={note.href}
				data-sveltekit-noscroll
				title="Geschiedenis van lid {lid}">{note.label}</a
			>
		{/if}
		{@render actions(part, 'lid__actions')}
	</div>
{/snippet}

{#snippet render(part: ArticlePart, top: boolean)}
	{@const { body, citations: spans } = own(part)}
	{@const showProposed = proposed && part.kind === 'lid' && proposed.lid === part.number}
	{#if top}
		<div class="lid lid--{part.kind}" id={part.id} class:is-open={menuFor === keyOf(part)}>
			<span class="lid__no"
				>{part.kind === 'lid'
					? `${part.number}.`
					: part.number
						? `${part.number}${mark}`
						: ''}</span
			>
			<div class="lid__body" class:lid__body--pair={showProposed}>
				<div class="lid__text">
					{#if body}<p><CitedText text={body} citations={spans} /></p>{/if}
					{#each part.children as child (child.start)}
						{@render render(child, false)}
					{/each}
				</div>
				{#if showProposed && proposed}
					<div class="lid__proposed">
						<div class="lid__proposed-head">
							<span class="proposed">voorgesteld</span>
							<span class="lid__proposed-source">{proposed.source}</span>
							{#if onCloseProposed}
								<button
									type="button"
									class="lid__proposed-close"
									aria-label="Sluiten"
									onclick={onCloseProposed}>×</button
								>
							{/if}
						</div>
						<p>{proposed.text}</p>
					</div>
				{/if}
			</div>
			{@render aside(part)}
		</div>
	{:else}
		<div class="part part--{part.kind}" id={part.id} class:is-open={menuFor === keyOf(part)}>
			{#if part.number && part.id}
				<a class="part__number" href="#{part.id}">{part.number}{mark}</a>
			{/if}
			<div class="part__body">
				{#if body}<p><CitedText text={body} citations={spans} /></p>{/if}
				{#each part.children as child (child.start)}
					{@render render(child, false)}
				{/each}
			</div>
			{#if part.id && part.kind !== 'aanhef'}{@render actions(part, 'part__actions')}{/if}
		</div>
	{/if}
{/snippet}

{#if parts.length === 0}
	<p class="article-text__empty">Geen tekst beschikbaar.</p>
{:else}
	<!-- The text measures its own width: in a narrow column (beside the network) the margin
	     folds under each lid, as it does on a phone. -->
	<div class="article-text-box">
		<div class="article-text">
			{#each parts as part (part.start)}
				{@render render(part, true)}
			{/each}
			{#if proposed && !parts.some((p) => p.kind === 'lid' && p.number === proposed!.lid)}
				<div class="lid lid--proposed-only">
					<span class="lid__no"></span>
					<div class="lid__body">
						<div class="lid__proposed">
							<div class="lid__proposed-head">
								<span class="proposed">voorgesteld</span>
								<span class="lid__proposed-source"
									>{proposed.source}{proposed.lid ? `, lid ${proposed.lid}` : ''}</span
								>
								{#if onCloseProposed}
									<button
										type="button"
										class="lid__proposed-close"
										aria-label="Sluiten"
										onclick={onCloseProposed}>×</button
									>
								{/if}
							</div>
							<p>{proposed.text}</p>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
<p class="visually-hidden" aria-live="polite">
	{copier.announcement}
</p>

<style>
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	.article-text-box {
		container-type: inline-size;
	}
	.article-text {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		margin-left: -46px;
	}

	/* A lid: 36px for the number, the text, 150px at the right. */
	.lid {
		position: relative;
		display: grid;
		grid-template-columns: 36px 1fr 150px;
		gap: 0 var(--s-3);
		align-items: start;
		padding: 6px 10px 6px 0;
		border-radius: var(--r-1);
		scroll-margin: 20vh;
		transition: background var(--dur-2) var(--ease);
	}
	.lid:hover,
	.lid:focus-within,
	.lid.is-open {
		background: var(--paper-2);
	}
	.lid:global(.is-landed) {
		background: var(--accent-soft);
	}
	/* The number as the law prints it (1.), in the letter and on the line of the text. */
	.lid__no {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink-3);
		text-align: right;
	}
	.lid__body {
		min-width: 0;
	}
	.lid__body--pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-4);
	}
	.lid__body p {
		margin: 0;
	}
	.lid__proposed {
		padding-left: var(--s-3);
		border-left: 2px solid var(--accent-soft);
	}
	.lid__proposed-head {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		margin-bottom: var(--s-1);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.proposed {
		color: var(--accent);
	}
	.lid__proposed-source {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.lid__proposed-close {
		padding: 0 var(--s-1);
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-body-2);
		color: var(--ink-3);
		cursor: pointer;
	}
	/* Above the onderdelen's hover area (`.part::before`), so the count stays a link. */
	.lid__side {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
		padding-top: 6px;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.lid__count {
		color: var(--ink-3);
		white-space: nowrap;
	}
	.lid__count:hover {
		color: var(--accent);
	}
	/* Hidden by opacity, not visibility: Tab still reaches the actions, and shows them. */
	.lid__actions {
		opacity: 0;
		display: flex;
		gap: var(--s-1);
	}
	/* The lid's actions, unless the pointer is on one of its onderdelen. A lid's aanhef
	   counts as the lid's own text: it is cited with the lid. */
	.lid:hover:not(:has(.part--onderdeel:hover)) .lid__actions,
	.lid__side:focus-within .lid__actions,
	.lid.is-open > .lid__side .lid__actions {
		opacity: 1;
	}
	.lid.is-open > .lid__side {
		z-index: var(--z-float);
	}
	:global(.act__btn) {
		padding: 2px var(--s-2);
		font-size: var(--t-label);
		white-space: nowrap;
	}
	/* Onderdelen inside a lid keep their number in the text. */
	.part {
		position: relative;
		display: flex;
		gap: 0.6em;
		margin: 0.4em 0 0;
		scroll-margin: 20vh;
		border-radius: var(--r-1);
	}
	.part:global(.is-landed) {
		background: var(--accent-soft);
	}
	/* The onderdeel the pointer is on, and not one inside it. */
	/* A tinted block with a bar at the left, a few pixels beyond the text on every side. */
	.part--onderdeel:hover:not(:has(.part--onderdeel:hover)),
	.part.is-open {
		background: var(--accent-soft);
		box-shadow:
			0 0 0 4px var(--accent-soft),
			-3px 0 0 3px var(--accent);
	}
	.part--onderdeel:hover:not(:has(.part--onderdeel:hover)) > .part__number,
	.part.is-open > .part__number {
		color: var(--accent);
	}
	/*
	 * The onderdeel's hover area runs on through the gap into the lid's right column, over
	 * the onderdeel's full height, so the pointer reaches its actions without leaving it.
	 * A deeper onderdeel's area comes later in the page and so lies on top.
	 */
	.part--onderdeel::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 100%;
		width: 162px;
	}
	/* In the lid's right column, level with the onderdeel's first line. */
	.part__actions {
		position: absolute;
		top: 0;
		left: calc(100% + 12px);
		z-index: 3;
		width: 150px;
		display: flex;
		opacity: 0;
		justify-content: flex-end;
		gap: var(--s-1);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
	}
	.part:hover:not(:has(.part--onderdeel:hover)) > .part__actions,
	.part__actions:focus-within,
	.part.is-open > .part__actions {
		opacity: 1;
	}
	/* Without hover, as on a touch screen, the actions are always there. */
	@media (hover: none) {
		.lid__actions,
		.part__actions {
			opacity: 1;
		}
	}
	.part.is-open > .part__actions {
		z-index: var(--z-float);
	}
	.part__number {
		flex: none;
		min-width: 1.6em;
		color: var(--ink-3);
	}
	.part__number:hover {
		color: var(--accent);
	}
	.part__body {
		flex: 1;
		min-width: 0;
	}
	.part__body p {
		margin: 0;
	}

	.article-text__empty {
		font-style: italic;
		color: var(--ink-3);
		font-family: var(--font-serif);
		font-size: var(--t-body);
	}

	@container (max-width: 600px) {
		.article-text {
			margin-left: 0;
		}
		.lid {
			grid-template-columns: 28px 1fr;
		}
		.lid__side {
			grid-column: 2;
			flex-direction: row;
			gap: 10px;
			padding-top: 2px;
		}
		.lid__body--pair {
			grid-template-columns: 1fr;
		}
		/* No right column: the actions follow the onderdeel's text while it is touched. */
		.part {
			flex-wrap: wrap;
		}
		.part--onderdeel::before {
			content: none;
		}
		.part__actions {
			position: static;
			display: none;
			width: 100%;
		}
		.part:hover:not(:has(.part--onderdeel:hover)) > .part__actions,
		.part__actions:focus-within,
		.part.is-open > .part__actions {
			display: flex;
		}
	}
</style>

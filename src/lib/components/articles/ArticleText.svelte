<script lang="ts">
	// The text of an article as its aanhef, leden and onderdelen. Every part has an
	// anchor, so a reference can point at it and the address can be shared. Nothing stands
	// beside the text: a place's own marker ("1.", "a.") is its menu (PlaatsMenu), and so is
	// a click on its text, the innermost place clicked (concept 21, variant B, Thijs 10 Oct).
	import PlaatsMenu from './PlaatsMenu.svelte';
	import { kaart } from '$lib/map/map.svelte';
	import { citeItems } from '$lib/components/ui/cite';
	import { page } from '$app/state';
	import { permalink } from '$lib/bron/anchor';
	import type { Schema } from '$lib/api/types';
	import { parseArticleParts, partsFromApi, type ArticlePart } from '$lib/text/article-parts';
	import { citeArticle, partOfAnchor, type Citation } from '$lib/text/cite';
	import type { ProposedText } from '$lib/verbonden/proposed-text';
	import CitedText from './CitedText.svelte';
	import { citationsWithin } from './citations';
	import { begrippenWithin, definitiesOp, type Begrip, type Definitie } from '$lib/text/begrippen';

	let {
		text,
		parts: apiParts = null,
		citations = [],
		begrippen = [],
		definities = [],
		counts = new Map(),
		tellend = false,
		lidHref,
		citation = null,
		proposed = null,
		onCloseProposed,
		lidNotes = new Map(),
		mark = '.',
		bewaar = null
	}: {
		text: string | null | undefined;
		/** The parts the API delivers (0.5); without them they are read from the text. */
		parts?: Schema<'ArticlePartDTO'>[] | null;
		citations?: Schema<'ArticleCitationSpan'>[];
		/** The terms the text uses that its regulation defines (`term_spans`). */
		begrippen?: Begrip[];
		/** The definitions they name (`definitions`). */
		definities?: Definitie[];
		/** Verbindingen per lid; a lid without an entry shows no count. */
		counts?: Map<string, number>;
		/** The counts are still on their way: a lid's menu says so. */
		tellend?: boolean;
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
		/** The article as Gemarkeerd keeps it: its id and its law; each lid then has Bewaar. */
		bewaar?: { id: string; groep: string } | null;
	} = $props();

	const source = $derived(text ?? '');
	const perRef = $derived(definitiesOp(definities));
	const parts = $derived(apiParts?.length ? partsFromApi(apiParts) : parseArticleParts(source));

	const own = (part: ArticlePart) => {
		const raw = source.slice(part.textStart, part.textEnd);
		const lead = raw.length - raw.trimStart().length;
		const body = raw.trim();
		return {
			body,
			citations: citationsWithin(citations, part.textStart + lead, body.length),
			begrippen: begrippenWithin(begrippen, part.textStart + lead, body.length)
		};
	};

	/** The part's text with its onderdelen, as Kopieer tekst puts it on the clipboard. */
	const fullText = (part: ArticlePart) => source.slice(part.textStart, part.end).trim();

	/** A part without an anchor (an article without leden) is keyed by its offset. */
	const keyOf = (part: ArticlePart) => part.id ?? `tekst-${part.start}`;

	/** The place whose menu is open, and the marker it hangs from. */
	let menu = $state<{ part: ArticlePart; anker: HTMLElement } | null>(null);
	const menuFor = $derived(menu ? keyOf(menu.part) : null);
	function openMenu(part: ArticlePart, anker: HTMLElement) {
		menu = menu && keyOf(menu.part) === keyOf(part) ? null : { part, anker };
	}
	/** A click on a place's text opens its menu, at its marker: not on a link or a control,
	 *  not when text is being selected, and only for the innermost place. */
	function opTekst(e: MouseEvent, part: ArticlePart) {
		const t = e.target as HTMLElement;
		if (t.closest('a, button, input, textarea, summary')) return;
		if (window.getSelection()?.toString()) return;
		e.stopPropagation();
		const plaats = (e.currentTarget as HTMLElement).closest('.lid, .part');
		const anker =
			plaats?.querySelector<HTMLElement>(':scope > .plaats-marker') ?? (plaats as HTMLElement);
		if (anker) openMenu(part, anker);
	}
	/** The place as the menu names it: its short citation, else `Lid 2`. */
	const naamVan = (part: ArticlePart) =>
		formsOf(part)?.kort ??
		(part.kind === 'lid' ? `Lid ${part.number}` : part.number ? `Onder ${part.number}` : 'Tekst');

	const formsOf = (part: ArticlePart) => {
		if (!citation || !part.id) return null;
		return citeArticle({ ...citation, ...partOfAnchor(part.id) });
	};
</script>

{#snippet render(part: ArticlePart, top: boolean)}
	{@const { body, citations: spans, begrippen: termen } = own(part)}
	{@const showProposed = proposed && part.kind === 'lid' && proposed.lid === part.number}
	{#if top}
		<div
			class="lid lid--{part.kind}"
			id={part.id}
			class:is-open={menuFor === keyOf(part)}
			class:plaats-bewaard={!!bewaar && !!part.id && kaart.heeft({ id: bewaar.id, at: part.id })}
		>
			<!-- The number is the lid's menu: citeren, bewaren, verbindingen. -->
			<button
				type="button"
				class="lid__no plaats-marker"
				aria-haspopup="menu"
				aria-expanded={menuFor === keyOf(part)}
				aria-label="{naamVan(part)}: citeren, bewaren"
				onclick={(e) => openMenu(part, e.currentTarget)}
				>{part.kind === 'lid'
					? `${part.number}.`
					: part.number
						? `${part.number}${mark}`
						: ''}</button
			>
			<div class="lid__body" class:lid__body--pair={showProposed}>
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<div class="lid__text" onclick={(e) => opTekst(e, part)}>
					{#if body}<p>
							<CitedText text={body} citations={spans} begrippen={termen} definities={perRef} />
						</p>{/if}
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
		</div>
	{:else}
		<div
			class="part part--{part.kind}"
			id={part.id}
			class:is-open={menuFor === keyOf(part)}
			class:plaats-bewaard={!!bewaar && !!part.id && kaart.heeft({ id: bewaar.id, at: part.id })}
		>
			{#if part.number && part.id}
				<button
					type="button"
					class="part__number plaats-marker"
					aria-haspopup="menu"
					aria-expanded={menuFor === keyOf(part)}
					aria-label="{naamVan(part)}: citeren, bewaren"
					onclick={(e) => openMenu(part, e.currentTarget)}>{part.number}{mark}</button
				>
			{/if}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<div class="part__body" onclick={(e) => opTekst(e, part)}>
				{#if body}<p>
						<CitedText text={body} citations={spans} begrippen={termen} definities={perRef} />
					</p>{/if}
				{#each part.children as child (child.start)}
					{@render render(child, false)}
				{/each}
			</div>
		</div>
	{/if}
{/snippet}

{#if parts.length === 0}
	<p class="article-text__empty">Tekst niet in de gegevens.</p>
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

{#if menu}
	{@const p = menu.part}
	{@const forms = formsOf(p)}
	{@const lid = p.kind === 'lid' ? p.number : null}
	{@const count = lid ? counts.get(lid) : undefined}
	<PlaatsMenu
		anker={menu.anker}
		titel={naamVan(p)}
		cite={forms ? citeItems(forms, permalink(page.url, p.id!)) : []}
		tekst={() => fullText(p)}
		bewaar={bewaar && forms && p.id
			? { id: bewaar.id, at: p.id, kort: forms.kort, voluit: forms.voluit, groep: bewaar.groep }
			: null}
		verbindingen={lid && count != null && lidHref
			? { n: count, href: lidHref(lid) }
			: lid && tellend
				? 'tellend'
				: null}
		geschiedenis={lid ? (lidNotes.get(lid) ?? null) : null}
		onClose={() => (menu = null)}
	/>
{/if}

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
		/* The number of a lid hangs in the frame's margin, its text at the column's edge
		   (ReaderFrame); a narrow column takes it in (below). */
		margin-left: -48px;
	}

	/* A lid: 36px for the number (in the frame's margin), the text to the column's right
	   edge, its count and actions under it (Thijs, 9 Oct: "de artikelen oprekken" to the
	   width of the reader). */
	/* Nothing beside the text: the number is the lid's menu (variant B, Thijs 10 Oct). */
	.lid {
		position: relative;
		display: grid;
		grid-template-columns: 36px minmax(0, 1fr);
		gap: 0 var(--s-3);
		align-items: start;
		padding: var(--s-1) var(--s-3) var(--s-1) 0;
		border-radius: var(--r-1);
		scroll-margin: 20vh;
		transition: background var(--dur-2) var(--ease);
	}
	.lid:hover:not(:has(.part--onderdeel:hover)),
	.lid:has(> .lid__no:focus-visible),
	.lid.is-open {
		background: var(--paper-2);
	}
	.lid:global(.is-landed) {
		background: var(--accent-soft);
	}
	/* The number as the law prints it (1.), in the letter and on the line of the text. */
	.lid__no {
		padding: 0;
		border: 0;
		background: none;
		cursor: default;
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
		font-family: var(--font-serif);
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
	/* Onderdelen inside a lid keep their number in the text. */
	.part {
		position: relative;
		display: flex;
		align-items: baseline;
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
	/* A place's marker is its menu: a quiet button, underlined with ▾ while the place is
	   pointed at or focused, so it is clear what the menu acts on. */
	.plaats-marker {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		text-align: inherit;
		cursor: pointer;
	}
	.lid:hover:not(:has(.part--onderdeel:hover)) > .lid__no,
	.lid.is-open > .lid__no,
	.part--onderdeel:hover:not(:has(.part--onderdeel:hover)) > .part__number,
	.part.is-open > .part__number,
	.plaats-marker:focus-visible {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.lid:hover:not(:has(.part--onderdeel:hover)) > .lid__no::after,
	.lid.is-open > .lid__no::after,
	.part--onderdeel:hover:not(:has(.part--onderdeel:hover)) > .part__number::after,
	.part.is-open > .part__number::after,
	.plaats-marker:focus-visible::after {
		content: ' ▾';
		font-size: 0.7em;
		color: var(--ink-3);
		text-decoration: none;
	}
	.plaats-marker:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	/* The text of a place opens its menu too. */
	.lid__text,
	.part__body {
		cursor: pointer;
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
		/* minmax(0, …): the text wraps, not widens the column past the screen. A tap on the
		   number (or the text) opens the place's menu, as a click does. */
		.lid {
			grid-template-columns: 28px minmax(0, 1fr);
		}
		.lid__body--pair {
			grid-template-columns: 1fr;
		}
	}
</style>

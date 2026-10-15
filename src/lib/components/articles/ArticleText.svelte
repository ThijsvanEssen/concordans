<script lang="ts">
	import { bewaarItem } from '$lib/map/map';
	// The text of an article as its aanhef, leden and onderdelen. Every part has an
	// anchor, so a reference can point at it and the address can be shared. Nothing stands
	// beside the text: a place's own marker ("1.", "a.") is its menu (PlaatsMenu), and so is
	// a click on its text, the innermost place clicked (concept 21, variant B, Thijs 10 Oct).
	import PlaatsMenu, { placeMarker } from './PlaatsMenu.svelte';
	import { blockClick } from '$lib/actions/klik';
	import { kaart } from '$lib/map/map.svelte';
	import { citeItems } from '$lib/components/ui/cite-items';
	import { page } from '$app/state';
	import { permalink } from '$lib/bron/landing';
	import type { Schema } from '$lib/api/types';
	import { markerOf, partsOf, placeOf, walkParts, type ArticlePart } from '$lib/text/article-parts';
	import { citeArticle, placeCitation, type ArticleCitation } from '$lib/text/cite';
	import type { ProposedText } from '$lib/verbonden/proposed-text';
	import CitedText from './CitedText.svelte';
	import { spansWithin } from '$lib/text/spans';
	import { definitiesOp, type Begrip, type Definitie } from '$lib/text/begrippen';
	import { delegatiesWithin, type Delegatie, type Gedelegeerd } from '$lib/text/delegaties';

	let {
		text,
		parts: apiParts = null,
		citations = [],
		begrippen = [],
		definities = [],
		delegaties = [],
		grondslag = null,
		counts = new Map(),
		tellend = false,
		lidHref,
		citation = null,
		proposed = null,
		onCloseProposed,
		lidNotes = new Map(),
		mark = '.',
		bewaar = null,
		gemarkeerd = null,
		alleen = null,
		ankers = true,
		adres = null
	}: {
		text: string | null | undefined;
		/** The parts the API delivers (0.5); without them they are read from the text. */
		parts?: Schema<'ArticlePartSpanDTO'>[] | null;
		citations?: Schema<'ArticleCitationSpan'>[];
		/** The terms the text uses that its regulation defines (`term_spans`). */
		begrippen?: Begrip[];
		/** The definitions they name (`definitions`). */
		definities?: Definitie[];
		/** The delegation formulas of the text (`delegations`). */
		delegaties?: Delegatie[];
		/** The regulations issued under the article, asked when a formula is first pointed at. */
		grondslag?: (() => Promise<Gedelegeerd | null>) | null;
		/** Verbindingen per lid; a lid without an entry shows no count. */
		counts?: Map<string, number>;
		/** The counts are still on their way: a lid's menu says so. */
		tellend?: boolean;
		/** The address that filters the panel Verbonden to a lid. */
		lidHref?: (lid: string) => string;
		/** What is needed to cite the article; without it Citeer is not offered. */
		citation?: ArticleCitation | null;
		/** The wording a wetsvoorstel proposes for one lid, shown next to the current one. */
		proposed?: ProposedText | null;
		onCloseProposed?: () => void;
		/** Per lid, when it got its present wording, and the link to its history. */
		lidNotes?: Map<string, { label: string; href: string }>;
		/** The mark after an onderdeel's letter or number: `a.` in Dutch law, `a)` in EU law. */
		mark?: '.' | ')';
		/** The article as Gemarkeerd keeps it: its id and its law; each lid then has Bewaar. */
		bewaar?: { id: string; groep: string; wet: string | null } | null;
		/** A place marked as kept, whatever the active map (Gemarkeerd shows its own items). */
		gemarkeerd?: string | null;
		/** Only the lid or onderdeel at this anchor, and what it holds; all where none matches. */
		alleen?: string | null;
		/** Anchors on the places; off where an article stands more than once on a page. */
		ankers?: boolean;
		/** The article's own address, where the page is not its reader (a map): the link Citeer
		 *  copies points there. */
		adres?: string | null;
	} = $props();

	const source = $derived(text ?? '');
	const perRef = $derived(definitiesOp(definities));
	const parts = $derived(partsOf(source, apiParts));
	const marker = (number: string) => markerOf(number, mark);
	/** Every part, for the place a citation names: a definition by its term. */
	const allParts = $derived([...walkParts(parts)]);
	/** The place `alleen` names: a lid with its onderdelen (`lid-2-onder-a` is in `lid-2`). */
	const bevat = (part: ArticlePart, at: string) =>
		!!part.id && (at === part.id || at.startsWith(`${part.id}-`));
	const getoond = $derived.by(() => {
		const at = alleen;
		const deel = at ? parts.filter((p) => bevat(p, at)) : [];
		return deel.length ? deel : parts;
	});
	const isBewaard = (part: ArticlePart) =>
		!!part.id &&
		(part.id === gemarkeerd || (!!bewaar && kaart.heeft({ id: bewaar.id, at: part.id })));

	const own = (part: ArticlePart) => {
		const raw = source.slice(part.textStart, part.textEnd);
		const lead = raw.length - raw.trimStart().length;
		const body = raw.trim();
		return {
			body,
			citations: spansWithin(citations, part.textStart + lead, body.length),
			begrippen: spansWithin(begrippen, part.textStart + lead, body.length),
			delegaties: delegatiesWithin(delegaties, part.textStart + lead, body.length)
		};
	};

	/** The place's text with its onderdelen, as Kopieer tekst puts it on the clipboard; the
	 *  article's whole text when the place is the article. */
	const fullText = (part: ArticlePart | null) =>
		part ? source.slice(part.textStart, part.end).trim() : source.trim();

	/** A part is keyed by the place it is cited as: text without an anchor of its own is its
	 *  lid's, or the article's (an article without leden). */
	const keyOf = (part: ArticlePart) => placeOf(parts, part)?.id ?? 'artikel';

	/** The place whose menu is open (null: the article), and the marker it hangs from. */
	let menu = $state<{ part: ArticlePart | null; anker: HTMLElement } | null>(null);
	const menuFor = $derived(menu ? (menu.part?.id ?? 'artikel') : null);
	function openMenu(part: ArticlePart, anker: HTMLElement) {
		menu = menuFor === keyOf(part) ? null : { part: placeOf(parts, part), anker };
	}
	/** A click on a place's text opens its menu, at its marker (blockClick: the innermost). */
	const opTekst = (part: ArticlePart) => (e: MouseEvent) => {
		const anker = placeMarker(e, '.lid, .part');
		if (anker) openMenu(part, anker);
	};
	/** The place as the menu names it: its short citation, else `Lid 2`. */
	const naamVan = (part: ArticlePart | null) =>
		formsOf(part)?.kort ??
		(part?.kind === 'lid'
			? `Lid ${part.number}`
			: part?.term
				? `Definitie van '${part.term}'`
				: part?.number
					? `Onder ${part.number}`
					: 'Artikel');

	/** The citation of a place; null is the article itself. A definition without a letter
	 *  (a dash item, a definition paragraph) is named by its term, and so is what it holds. */
	const formsOf = (part: ArticlePart | null) =>
		citation ? citeArticle({ ...citation, ...placeCitation(part?.id ?? null, allParts) }) : null;
</script>

{#snippet render(part: ArticlePart, top: boolean)}
	{@const { body, citations: spans, begrippen: termen, delegaties: formules } = own(part)}
	{@const showProposed = proposed && part.kind === 'lid' && proposed.lid === part.number}
	{#if top}
		<div
			class="lid lid--{part.kind}"
			id={ankers ? part.id : undefined}
			class:is-open={menuFor === keyOf(part)}
			class:plaats-bewaard={isBewaard(part)}
		>
			<!-- The number is the lid's menu: citeren, bewaren, verbindingen. -->
			<button
				type="button"
				class="lid__no plaats-marker"
				aria-haspopup="menu"
				aria-expanded={menuFor === keyOf(part)}
				aria-label="{naamVan(placeOf(parts, part))}: citeren, bewaren"
				onclick={(e) => openMenu(part, e.currentTarget)}
				>{part.kind === 'lid' ? `${part.number}.` : part.number ? marker(part.number) : ''}</button
			>
			<div class="lid__body" class:lid__body--pair={showProposed}>
				<div class="lid__text" use:blockClick={opTekst(part)}>
					{#if body}<p>
							<CitedText
								text={body}
								citations={spans}
								begrippen={termen}
								definities={perRef}
								delegaties={formules}
								{grondslag}
							/>
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
			id={ankers ? part.id : undefined}
			class:is-open={!!part.id && menuFor === part.id}
			class:plaats-bewaard={isBewaard(part)}
		>
			{#if part.number && part.id}
				<button
					type="button"
					class="part__number plaats-marker"
					aria-haspopup="menu"
					aria-expanded={menuFor === part.id}
					aria-label="{naamVan(part)}: citeren, bewaren"
					onclick={(e) => openMenu(part, e.currentTarget)}>{marker(part.number)}</button
				>
			{/if}
			<div class="part__body" use:blockClick={opTekst(part)}>
				{#if body}<p>
						<CitedText
							text={body}
							citations={spans}
							begrippen={termen}
							definities={perRef}
							delegaties={formules}
							{grondslag}
						/>
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
			{#each getoond as part (part.start)}
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
	{@const lid = p?.kind === 'lid' ? p.number : null}
	{@const count = lid ? counts.get(lid) : undefined}
	<PlaatsMenu
		anker={menu.anker}
		title={naamVan(p)}
		cite={forms
			? citeItems(forms, permalink(adres ? new URL(adres, page.url) : page.url, p?.id ?? ''))
			: []}
		tekst={() => fullText(p)}
		bewaar={bewaar && forms
			? bewaarItem(
					bewaar.id,
					{ at: p?.id, kort: forms.kort, voluit: forms.voluit },
					{ groep: bewaar.groep, wet: bewaar.wet }
				)
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
		/* No further than the frame's margin: beside the network it is 32, not 64 (the
		   numbers were cut off there), as the judgment's numbers do (--rov-hang). */
		margin-left: calc(-1 * min(var(--s-7), var(--reader-pad-left, var(--s-6))));
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
		background: var(--wassing);
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
		border-left: 2px solid var(--wassing);
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
		color: var(--ink);
		/* In ink, as everything at rest but "nee" (Thijs, 10 Oct); the weight keeps it seen. */
		font-weight: 600;
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
		background: var(--wassing);
	}
	/* The onderdeel the pointer is on, and not one inside it. */
	/* A tinted block with a bar at the left, a few pixels beyond the text on every side. */
	.part--onderdeel:hover:not(:has(.part--onderdeel:hover)),
	.part.is-open {
		background: var(--paper-2);
		box-shadow:
			0 0 0 4px var(--paper-2),
			-3px 0 0 3px var(--ink);
	}
	.part--onderdeel:hover:not(:has(.part--onderdeel:hover)) > .part__number,
	.part.is-open > .part__number {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
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
		outline: 2px solid var(--focus);
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
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
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

	/* Narrow: the numbers inside the text column. From 580 they hang in the reader's margin:
	   the article column is 590 at 1440 since the contents take the network's width (one
	   title column, 10 Oct), and its numbers hang there as at 1920. */
	@container (max-width: 579px) {
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

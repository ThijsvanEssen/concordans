<script lang="ts">
	// The Zijpaneel (Design System, Tekst en lezen): the article a reference names, read beside
	// the text it stands in. A Blad that is not modal: at the right under the top bar (from 1800 px
	// in the margin, in the page's flow), on a phone from below; the page beside it stays the page.
	// Its head names the article and its law and has Open artikel (the page, one step further);
	// under it, outside what scrolls, the article before and after; then its text per lid, the
	// cited lid or onderdeel marked and in view. A new reference replaces it (panel.svelte.ts).
	// Several articles (a label of the keten, a law's in the head) stand under each other, the
	// stapel: each with a head that stays in view and its cited lid only, a jump menu above them
	// (bare links, the one in view in ink: no chips, besluit bediening).
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { page } from '$app/state';
	import Blad from '$lib/components/ui/Blad.svelte';
	import CitedText from '$lib/components/articles/CitedText.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { plainClick } from '$lib/actions/klik';
	import { getArticleText } from '$lib/api/articles';
	import { ifExists } from '$lib/api/errors';
	import { openHref } from '$lib/bron/href';
	import { notHeld } from '$lib/text/coverage';
	import { answer } from '$lib/keys/dispatch.svelte';
	import { load } from '$lib/util/load.svelte';
	import { afterTick } from '$lib/util/after-tick';
	import { TOUCH_ONLY } from '$lib/util/touch';
	import { articleRoute, readValue, type ReadRef } from './param';
	import { PANEL_ID, closePanel, openInPanel, readHere } from './panel.svelte';
	import {
		announcement,
		chipName,
		citedBlocks,
		panelTitle,
		isCited,
		lawLine,
		neighborName,
		spansOf,
		stackLaw,
		stackTitle,
		type ArticleTextData,
		type TextBlock
	} from './blocks';

	let { reads }: { reads: ReadRef[] } = $props();

	// A reference in the panel's text opens its article here too.
	readHere();

	const touch = new MediaQuery(TOUCH_ONLY);
	let said = $state('');
	let body = $state<HTMLElement | null>(null);

	const read = $derived(reads[0]);
	const stacked = $derived(reads.length > 1);
	// The article of the stapel it opens at: the one clicked, else the first.
	const opensAt = $derived(
		Math.max(
			0,
			reads.findIndex((r) => r.key === page.state.readFocus)
		)
	);
	const fromRelated = $derived(page.state.readFrom === 'verbonden');

	/** The narrow form of an article; null where the data does not hold it. */
	const textOf = (key: string): Promise<ArticleTextData | null> => {
		const route = articleRoute(key);
		return route
			? ifExists(getArticleText(route.bwbId, route.articleNumber))
			: Promise.resolve(null);
	};
	// All of them at once, in the order of the address; null where the data holds none.
	const articles = load(
		() => readValue(reads),
		async () => {
			const texts = await Promise.all(reads.map((r) => textOf(r.key)));
			return texts.some(Boolean) ? texts : null;
		},
		'Zijpaneel'
	);
	const texts = $derived(articles.state.status === 'ready' ? (articles.state.data ?? []) : []);
	const loaded = $derived(stacked ? null : (texts[0] ?? null));

	const title = $derived(
		stacked
			? texts.length
				? stackTitle(reads, texts)
				: 'Artikelen'
			: loaded
				? panelTitle(loaded)
				: 'Artikel'
	);
	const lawOf = $derived(stacked ? stackLaw(texts) : loaded ? lawLine(loaded) : null);

	/** An article's page, at the cited part: by its readable address once known. */
	const pageOf = (r: ReadRef, a: ArticleTextData | null | undefined) =>
		a?.path ? `${a.path}${r.at ? `#${r.at}` : ''}` : openHref(`articles/${r.key}`, { at: r.at });

	// The stapel: which article is in view (its link in ink), which show whole. One taken to the
	// top that cannot reach it (the text ends before) stays the one in view until the reader
	// scrolls away from the end.
	let current = $state(0);
	let pinned = -1;
	let whole = $state<Record<string, boolean>>({});

	const panelEl = () => document.getElementById(PANEL_ID);
	const scroller = () => body?.closest<HTMLElement>('.inhoud') ?? null;
	const focusInside = () => !!panelEl()?.contains(document.activeElement);
	const titleEl = () => panelEl()?.querySelector<HTMLElement>('.lp-titel') ?? null;
	const pieceEl = (i: number) => body?.querySelector<HTMLElement>(`[data-stuk="${i}"]`) ?? null;
	/** The reference the panel opened from: it says so (aria-controls). */
	const reference = () => document.querySelector<HTMLElement>(`[aria-controls="${PANEL_ID}"]`);

	// New articles: the one it opens at and its cited part in view with room above, the focus
	// kept in the panel (on its title when what had it went with the old text), and said to a
	// screen reader.
	// The same articles beside another page (Alt L: a step without the place it opened at) are
	// left as they stand, the focus where it was (live-toets peek 5, C6).
	let shown: { value: string; focus?: string } | null = null;
	$effect(() => {
		if (!texts.length) return;
		const value = readValue(reads);
		const focus = page.state.readFocus;
		if (shown?.value === value && (!focus || focus === shown.focus)) return;
		shown = { value, focus };
		const at = stacked ? opensAt : 0;
		const r = reads[at];
		const a = texts[at];
		afterTick(() => {
			if (stacked) toPiece(at, false);
			showCited(stacked ? pieceEl(at) : body);
			showReference();
			const active = document.activeElement;
			if (!active || active === document.body || focusInside())
				(stacked ? pieceEl(at)?.querySelector<HTMLElement>('.lp-stuk-titel') : titleEl())?.focus({
					preventScroll: true
				});
			said = a ? announcement(a, r.at, !touch.current) : '';
		});
	});

	/** The scroller's top over this element: where it stands in the panel's text. */
	const topIn = (el: HTMLElement, s: HTMLElement) =>
		el.getBoundingClientRect().top - s.getBoundingClientRect().top + s.scrollTop;

	/**
	 * The cited part in view, 16 px above it (and under the head of its article in a stapel),
	 * where it is not: the text opens at its top.
	 */
	function showCited(within: HTMLElement | null) {
		const s = scroller();
		const cited = within?.querySelector<HTMLElement>('.is-geciteerd');
		if (!s || !cited) return;
		const head = within?.querySelector<HTMLElement>('.lp-stuk-kop')?.offsetHeight ?? 0;
		if (cited.getBoundingClientRect().bottom > s.getBoundingClientRect().bottom)
			// In a stapel never above its article's own top: that one stays the one in view.
			s.scrollTop = Math.max(topIn(cited, s) - head - 16, stacked && within ? topIn(within, s) : 0);
	}

	/** From below, the reference it opened from above it, still seen: the page moves the least. */
	function showReference() {
		const sheet = panelEl();
		const ref = reference();
		if (!sheet?.classList.contains('is-bottom') || !ref) return;
		const top = sheet.getBoundingClientRect().top;
		if (ref.getBoundingClientRect().bottom < top) return;
		ref.style.scrollMarginBottom = `${innerHeight - top + 16}px`;
		ref.scrollIntoView({ block: 'nearest' });
		ref.style.scrollMarginBottom = '';
	}

	/** An article of the stapel at the top of the panel's text; its head then holds the focus. */
	function toPiece(i: number, focus = true) {
		const s = scroller();
		const el = pieceEl(i);
		if (!s || !el) return;
		s.scrollTop = i === 0 ? 0 : topIn(el, s);
		current = pinned = i;
		if (focus) el.querySelector<HTMLElement>('.lp-stuk-titel')?.focus({ preventScroll: true });
	}

	/**
	 * Which article of the stapel is in view: the last whose head has reached the top; at the
	 * end of the text the one taken there, else the last (live-toets peek 5, C2).
	 */
	function track() {
		const s = scroller();
		if (!s) return;
		const top = s.getBoundingClientRect().top + 8;
		let at = 0;
		reads.forEach((_, i) => {
			const el = pieceEl(i);
			if (el && el.getBoundingClientRect().top <= top) at = i;
		});
		const end = s.scrollTop > 0 && s.scrollTop + s.clientHeight >= s.scrollHeight - 2;
		if (end) at = pinned >= 0 ? pinned : reads.length - 1;
		else pinned = -1;
		current = at;
	}
	$effect(() => {
		const s = stacked && texts.length ? scroller() : null;
		if (!s) return;
		s.addEventListener('scroll', track, { passive: true });
		return () => s.removeEventListener('scroll', track);
	});

	/** An article whole or its cited part only; what is in view then follows the text. */
	function wholeOf(key: string) {
		whole = { ...whole, [key]: !whole[key] };
		pinned = -1;
		afterTick(track);
	}

	/** A link of the jump menu: its article at the top; ⌘-click keeps the link's own way. */
	function toChip(e: MouseEvent, i: number) {
		if (!plainClick(e)) return;
		e.preventDefault();
		toPiece(i);
	}

	/** A neighbour in the panel; ⌘-click and the middle button open its page. */
	function toNeighbor(e: MouseEvent, key: string) {
		if (!plainClick(e)) return;
		e.preventDefault();
		openInPanel({ key, at: null });
	}

	/**
	 * Back to the reader: where the focus was there (held from before the panel opened), else
	 * the reference, else the first link it shows; never the page itself, which shows no ring.
	 */
	const had = typeof document === 'undefined' ? null : document.activeElement;
	let lastOutside: Element | null = had === document.body ? null : had;
	const shows = (el: Element | null): el is HTMLElement | SVGElement =>
		(el instanceof HTMLElement || el instanceof SVGElement) &&
		el.isConnected &&
		el.id !== 'main-content' &&
		el.checkVisibility();
	function toReader() {
		const links = document.querySelectorAll('#main-content a[href], #main-content button');
		ringed([lastOutside, reference(), ...links].find(shows));
	}

	/** A step of Alt W: the focus there with its ring, after a click too (live-toets peek 5, B1). */
	function ringed(el: HTMLElement | SVGElement | null | undefined) {
		if (!el) return;
		el.dataset.ring = '';
		el.addEventListener('blur', () => delete el.dataset.ring, { once: true });
		el.focus();
	}

	/** In the panel the article before or after: of the stapel, or the neighbour of the one. */
	function step(by: -1 | 1): boolean {
		if (!focusInside()) return false;
		if (stacked) {
			const to = current + by;
			if (to < 0 || to >= reads.length) return false;
			toPiece(to);
			return true;
		}
		const to = by < 0 ? loaded?.previous : loaded?.next;
		if (!to) return false;
		openInPanel({ key: to.key, at: null });
		return true;
	}

	onMount(() => {
		// Where the focus was in the reader, for Alt W back to it.
		const remember = (e: FocusEvent) => {
			const t = e.target;
			if (t instanceof HTMLElement && t !== document.body && !panelEl()?.contains(t))
				lastOutside = t;
		};
		document.addEventListener('focusin', remember);
		const stop = [
			// Alt W: between the reader and the panel.
			answer('panel-toggle', () => (focusInside() ? toReader() : ringed(titleEl()))),
			// Alt [ and ]: in the panel its article before and after; elsewhere the reader's.
			answer('article-prev', () => step(-1)),
			answer('article-next', () => step(1))
		];
		return () => {
			document.removeEventListener('focusin', remember);
			stop.forEach((f) => f());
		};
	});
</script>

{#snippet blocks(list: readonly TextBlock[], at: string | null)}
	{@const first = list.findIndex((b) => isCited(b, at))}
	{#each list as b, i (i)}
		{#if b.kind === 'kop'}
			<svelte:element this={stacked ? 'h4' : 'h3'} class="lp-kop">{b.text}</svelte:element>
		{:else}
			<div
				class="lp-blok"
				class:is-geciteerd={isCited(b, at)}
				data-kind={b.kind}
				style:--depth={b.within.length}
				aria-current={i === first ? 'location' : undefined}
			>
				{#if b.marker}<span class="lp-nr">{b.marker}</span>{/if}
				<p class="lp-t">
					{#if i === first}<span class="sr-only">Geciteerd: </span>{/if}<CitedText
						text={b.text}
						citations={spansOf(b)}
					/>
				</p>
			</div>
		{/if}
	{:else}
		<p class="lp-leeg">Dit artikel heeft geen tekst.</p>
	{/each}
{/snippet}

<Blad
	{title}
	onClose={closePanel}
	modaal={false}
	place="rechts"
	aboveTabbar
	id={PANEL_ID}
	focus=".lp-titel"
>
	{#snippet head()}
		{#if fromRelated}<button type="button" class="lp-terug" onclick={closePanel}>‹ Verbonden</button
			>{/if}
		<p class="lp-soort">{stacked ? 'Artikelen' : 'Artikel'}</p>
		<h2 class="lp-titel" tabindex="-1">
			{#if stacked}{title}{:else}<a href={pageOf(read, loaded)} data-sveltekit-noscroll>{title}</a
				>{/if}
		</h2>
		{#if lawOf}<p class="lp-wet">{lawOf}</p>{/if}
	{/snippet}
	{#snippet actions()}
		{#if !stacked}<a class="btn is-text" href={pageOf(read, loaded)} data-sveltekit-noscroll
				>Open artikel</a
			>{/if}
	{/snippet}
	{#snippet under()}
		{#if stacked}
			<nav class="lp-sprong" aria-label="Ga naar artikel">
				{#each reads as r, i (r.key)}<a
						href="#lp-{r.key}"
						aria-current={i === current ? 'true' : undefined}
						onclick={(e) => toChip(e, i)}>{chipName(r.key, r.at)}</a
					>{/each}
			</nav>
		{:else if loaded && (loaded.previous || loaded.next)}
			<nav class="lp-buren" aria-label="Vorig en volgend artikel">
				{#if loaded.previous}<a
						href={loaded.previous.path ?? undefined}
						rel="prev"
						aria-keyshortcuts={touch.current ? undefined : 'Alt+BracketLeft'}
						onclick={(e) => toNeighbor(e, loaded.previous!.key)}
						>‹ {neighborName(loaded.previous)}</a
					>{:else}<span></span>{/if}
				{#if loaded.next}<a
						href={loaded.next.path ?? undefined}
						rel="next"
						aria-keyshortcuts={touch.current ? undefined : 'Alt+BracketRight'}
						onclick={(e) => toNeighbor(e, loaded.next!.key)}>{neighborName(loaded.next)} ›</a
					>{/if}
			</nav>
		{/if}
	{/snippet}
	<div class="lp-tekst" bind:this={body}>
		<LoadState state={articles.state} what="Het artikel" retry={articles.retry} form="block">
			{#snippet empty()}<p class="lp-leeg">
					{notHeld(stacked ? 'Deze artikelen' : 'Dit artikel')}.
				</p>{/snippet}
			{#snippet children(list)}
				{#if !stacked}
					{@render blocks(list?.[0]?.blocks ?? [], read.at)}
				{:else}
					{#each reads as r, i (r.key)}
						{@const a = list?.[i] ?? null}
						{@const shown = a ? (whole[r.key] ? a.blocks : citedBlocks(a.blocks, r.at)) : []}
						<section class="lp-stuk" id="lp-{r.key}" data-stuk={i} aria-labelledby="lp-t-{r.key}">
							<div class="lp-stuk-kop">
								<h3 class="lp-stuk-titel" id="lp-t-{r.key}" tabindex="-1">
									<a href={pageOf(r, a)} data-sveltekit-noscroll
										>{a ? panelTitle(a) : `Artikel ${chipName(r.key, null)}`}</a
									>
								</h3>
								<a class="btn is-text" href={pageOf(r, a)} data-sveltekit-noscroll>Open artikel</a>
							</div>
							{#if a}
								{@render blocks(shown, r.at)}
								{#if shown.length < a.blocks.length || whole[r.key]}<button
										type="button"
										class="btn is-text lp-heel"
										aria-expanded={!!whole[r.key]}
										onclick={() => wholeOf(r.key)}
										>{whole[r.key] ? 'Alleen het geciteerde' : 'Heel artikel'}</button
									>{/if}
							{:else}
								<p class="lp-leeg">{notHeld('Dit artikel')}.</p>
							{/if}
						</section>
					{/each}
				{/if}
			{/snippet}
		</LoadState>
	</div>
	<p class="sr-only" aria-live="polite">{said}</p>
</Blad>

<style>
	.lp-terug {
		display: inline-flex;
		align-items: center;
		min-height: 28px;
		margin: 0 0 var(--s-1);
		padding: 0;
		border: 0;
		background: none;
		font: var(--t-meta) var(--font-serif);
		color: var(--ink-2);
		cursor: pointer;
	}
	.lp-terug:hover {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	/* Wide, Verbonden stands beside the panel: nothing to go back to. */
	@media (min-width: 1800px) {
		.lp-terug {
			display: none;
		}
	}
	.lp-soort {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin: 0 0 2px;
		font: var(--t-micro) / var(--lh-snug) var(--font-serif);
		color: var(--ink-2);
	}
	.lp-soort::before {
		content: '';
		width: var(--s-2);
		height: var(--s-2);
		background: var(--rubriek-wetten);
	}
	.lp-titel {
		margin: 0;
		font: 600 var(--t-h3) / 26px var(--font-serif);
		color: var(--ink);
	}
	.lp-titel a,
	.lp-stuk-titel a {
		color: inherit;
		text-decoration: none;
	}
	.lp-titel a:hover,
	.lp-stuk-titel a:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.lp-wet {
		margin: var(--s-1) 0 0;
		font: var(--t-meta) / var(--lh-snug) var(--font-serif);
		color: var(--ink-3);
	}
	/* Outside what scrolls (Blad's under): the way on is always in view (live-toets C1). */
	.lp-buren,
	.lp-sprong {
		flex: none;
		display: flex;
		gap: var(--s-2);
		padding: 0 var(--s-4) var(--s-2);
		border-bottom: 1px solid var(--rule);
		font: var(--t-meta) var(--font-serif);
	}
	.lp-buren {
		justify-content: space-between;
	}
	.lp-buren a,
	.lp-sprong a {
		display: inline-flex;
		align-items: center;
		min-height: 28px;
		color: var(--ink-2);
		text-decoration: none;
	}
	.lp-buren a:hover,
	.lp-sprong a:hover {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	/* The jump menu of the stapel: a link per article, the one in view in ink. */
	.lp-sprong {
		flex-wrap: wrap;
		column-gap: var(--s-4);
	}
	.lp-sprong a {
		white-space: nowrap;
	}
	.lp-sprong a[aria-current='true'] {
		font-weight: 600;
		color: var(--ink);
	}
	.lp-tekst {
		padding: var(--s-3) var(--s-4) var(--s-5);
		font: var(--t-body-2) / var(--lh-body) var(--font-serif);
		color: var(--ink);
	}
	/* An article of the stapel: its head stays at the top of the text while it is read. */
	.lp-stuk + .lp-stuk {
		margin-top: var(--s-4);
	}
	.lp-stuk-kop {
		position: sticky;
		top: calc(-1 * var(--s-3));
		z-index: 1;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-2);
		/* The whole width of the panel: the wash of a cited lid goes under it, not beside it. */
		margin: 0 calc(-1 * var(--s-4)) var(--s-1);
		padding: var(--s-2) var(--s-4) var(--s-1);
		background: var(--paper);
	}
	.lp-stuk + .lp-stuk .lp-stuk-kop {
		border-top: 1px solid var(--rule);
	}
	.lp-stuk-titel {
		margin: 0;
		font: 600 var(--t-body-2) / var(--lh-snug) var(--font-serif);
	}
	.lp-heel {
		margin: var(--s-1) 0 0 var(--s-5);
	}
	.lp-kop {
		margin: var(--s-3) 0 var(--s-1);
		font: 600 var(--t-body-2) / var(--lh-snug) var(--font-serif);
	}
	.lp-blok {
		display: flex;
		gap: var(--s-2);
		margin: 0 calc(-1 * var(--s-2));
		padding: var(--s-1) var(--s-2) var(--s-1) calc(var(--s-2) + var(--depth) * var(--s-5));
		border-radius: var(--r-1);
	}
	.lp-blok + .lp-blok:not([data-kind='onderdeel']) {
		margin-top: var(--s-2);
	}
	/* The cited lid or onderdeel: the wash, and the ink at its left, not only a colour. */
	.lp-blok.is-geciteerd {
		background: var(--wassing);
		box-shadow: inset 3px 0 0 var(--ink);
	}
	.lp-nr {
		flex: none;
		min-width: var(--s-5);
		color: var(--ink-2);
	}
	.lp-t {
		flex: 1;
		min-width: 0;
		margin: 0;
	}
	.lp-leeg {
		margin: 0;
		color: var(--ink-3);
	}
	@media (pointer: coarse), (max-width: 768px) {
		.lp-buren a,
		.lp-sprong a,
		.lp-terug {
			min-height: 44px;
		}
		/* "19" is 18 px wide: a finger's 44 px across too (live-toets peek 5, B2). */
		.lp-sprong a {
			justify-content: center;
			min-width: var(--veld-h-raak);
		}
	}
</style>

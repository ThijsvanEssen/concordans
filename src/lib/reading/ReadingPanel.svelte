<script lang="ts">
	// The Leespaneel (Design System, Tekst en lezen): the article a reference names, read beside
	// the text it stands in. A Blad that is not modal: at the right under the top bar, on a phone
	// from below; the page beside it stays the page. Its head names the article and its law and
	// has Open artikel (the page, one step further); under it the article before and after; then
	// its text per lid, the cited lid or onderdeel marked and in view. One article at a time: a new
	// reference replaces it (param.ts, panel.svelte.ts).
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
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
	import { articleRoute, type ReadRef } from './param';
	import { PANEL_ID, closePanel, openInPanel, readHere } from './panel.svelte';
	import { announcement, panelTitle, isCited, lawLine, neighborName, spansOf } from './blocks';

	let { read }: { read: ReadRef } = $props();

	// A reference in the panel's text opens its article here too.
	readHere();

	const touch = new MediaQuery(TOUCH_ONLY);
	let said = $state('');
	let body = $state<HTMLElement | null>(null);

	// The narrow form of the article; null where the data does not hold it.
	const article = load(
		() => read.key,
		(key) => {
			const route = articleRoute(key);
			return route
				? ifExists(getArticleText(route.bwbId, route.articleNumber))
				: Promise.resolve(null);
		},
		'Leespaneel'
	);
	const loaded = $derived(article.state.status === 'ready' ? article.state.data : null);

	const title = $derived(loaded ? panelTitle(loaded) : 'Artikel');
	// Its page, at the cited part: by its readable address once known.
	const pageHref = $derived(
		loaded?.path
			? `${loaded.path}${read.at ? `#${read.at}` : ''}`
			: openHref(`articles/${read.key}`, { at: read.at })
	);
	const firstCited = $derived(loaded?.blocks.findIndex((b) => isCited(b, read.at)) ?? -1);

	const panelEl = () => document.getElementById(PANEL_ID);
	const focusInside = () => !!panelEl()?.contains(document.activeElement);
	const titleEl = () => panelEl()?.querySelector<HTMLElement>('.lp-titel') ?? null;

	// A new article: the cited part in view with room above it, the focus kept in the panel
	// (on its title when what had it went with the old text), and said to a screen reader.
	$effect(() => {
		const a = loaded;
		if (!a) return;
		const at = read.at;
		afterTick(() => {
			showCited();
			showReference();
			const active = document.activeElement;
			if (!active || active === document.body || focusInside())
				titleEl()?.focus({ preventScroll: true });
			said = announcement(a, at, !touch.current);
		});
	});

	/** The cited part in view, 16 px above it, where it is not: the panel opens at its top. */
	function showCited() {
		const scroller = body?.closest<HTMLElement>('.inhoud');
		if (!scroller) return;
		const cited = body?.querySelector<HTMLElement>('.is-geciteerd');
		const view = scroller.getBoundingClientRect();
		const at = cited?.getBoundingClientRect();
		scroller.scrollTop =
			at && at.bottom > view.bottom ? at.top - view.top + scroller.scrollTop - 16 : 0;
	}

	/** From below, the reference it opened from above it, still seen: the page moves the least. */
	function showReference() {
		const sheet = panelEl();
		const reference = document.querySelector<HTMLElement>('a.raakvlak.is-open');
		if (!sheet?.classList.contains('is-bottom') || !reference) return;
		const top = sheet.getBoundingClientRect().top;
		if (reference.getBoundingClientRect().bottom < top) return;
		reference.style.scrollMarginBottom = `${innerHeight - top + 16}px`;
		reference.scrollIntoView({ block: 'nearest' });
		reference.style.scrollMarginBottom = '';
	}

	/** A neighbour in the panel; ⌘-click and the middle button open its page. */
	function toNeighbor(e: MouseEvent, key: string) {
		if (!plainClick(e)) return;
		e.preventDefault();
		openInPanel({ key, at: null });
	}

	onMount(() => {
		const stop = [
			// Alt W: between the reader and the panel; back to the reference it opened from.
			answer('panel-toggle', () => {
				if (!focusInside()) return titleEl()?.focus();
				const back =
					document.querySelector<HTMLElement>('a.raakvlak.is-open') ??
					document.getElementById('main-content');
				back?.focus();
			}),
			// Alt [ and ]: in the panel its article before and after; elsewhere the reader's.
			answer('article-prev', () => {
				if (!focusInside() || !loaded?.previous) return false;
				openInPanel({ key: loaded.previous.key, at: null });
			}),
			answer('article-next', () => {
				if (!focusInside() || !loaded?.next) return false;
				openInPanel({ key: loaded.next.key, at: null });
			})
		];
		return () => stop.forEach((f) => f());
	});
</script>

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
		<p class="lp-soort">Artikel</p>
		<h2 class="lp-titel" tabindex="-1">
			<a href={pageHref} data-sveltekit-noscroll>{title}</a>
		</h2>
		{#if loaded}<p class="lp-wet">{lawLine(loaded)}</p>{/if}
	{/snippet}
	{#snippet actions()}
		<a class="btn is-text" href={pageHref} data-sveltekit-noscroll>Open artikel</a>
	{/snippet}
	{#if loaded && (loaded.previous || loaded.next)}
		<nav class="lp-buren" aria-label="Vorig en volgend artikel">
			{#if loaded.previous}<a
					href={loaded.previous.path ?? undefined}
					rel="prev"
					aria-keyshortcuts={touch.current ? undefined : 'Alt+BracketLeft'}
					onclick={(e) => toNeighbor(e, loaded.previous!.key)}>‹ {neighborName(loaded.previous)}</a
				>{:else}<span></span>{/if}
			{#if loaded.next}<a
					href={loaded.next.path ?? undefined}
					rel="next"
					aria-keyshortcuts={touch.current ? undefined : 'Alt+BracketRight'}
					onclick={(e) => toNeighbor(e, loaded.next!.key)}>{neighborName(loaded.next)} ›</a
				>{/if}
		</nav>
	{/if}
	<div class="lp-tekst" bind:this={body}>
		<LoadState state={article.state} what="Het artikel" retry={article.retry} form="block">
			{#snippet empty()}<p class="lp-leeg">{notHeld('Dit artikel')}.</p>{/snippet}
			{#snippet children(a)}
				{#each a?.blocks ?? [] as b, i (i)}
					{#if b.kind === 'kop'}
						<h3 class="lp-kop">{b.text}</h3>
					{:else}
						<div
							class="lp-blok"
							class:is-geciteerd={isCited(b, read.at)}
							data-kind={b.kind}
							style:--depth={b.within.length}
							aria-current={i === firstCited ? 'location' : undefined}
						>
							{#if b.marker}<span class="lp-nr">{b.marker}</span>{/if}
							<p class="lp-t">
								{#if i === firstCited}<span class="sr-only">Geciteerd: </span>{/if}<CitedText
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
		</LoadState>
	</div>
	<p class="sr-only" aria-live="polite">{said}</p>
</Blad>

<style>
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
	.lp-titel a {
		color: inherit;
		text-decoration: none;
	}
	.lp-titel a:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.lp-wet {
		margin: var(--s-1) 0 0;
		font: var(--t-meta) / var(--lh-snug) var(--font-serif);
		color: var(--ink-3);
	}
	.lp-buren {
		flex: none;
		display: flex;
		justify-content: space-between;
		gap: var(--s-2);
		padding: 0 var(--s-4) var(--s-2);
		border-bottom: 1px solid var(--rule);
		font: var(--t-meta) var(--font-serif);
	}
	.lp-buren a {
		display: inline-flex;
		align-items: center;
		min-height: 28px;
		color: var(--ink-2);
		text-decoration: none;
	}
	.lp-buren a:hover {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.lp-tekst {
		padding: var(--s-3) var(--s-4) var(--s-5);
		font: var(--t-body-2) / var(--lh-body) var(--font-serif);
		color: var(--ink);
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
		.lp-buren a {
			min-height: 44px;
		}
	}
</style>

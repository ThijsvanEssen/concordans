<script lang="ts">
	import { lijstSprong, paneelSprongen } from '$lib/stores/sprong';
	import type { Snippet } from 'svelte';
	import TopBar from './TopBar.svelte';
	import TabBar from './TabBar.svelte';
	import SearchOverlay from './SearchOverlay.svelte';
	import { provideSearchOpener } from '$lib/stores/search-trigger';
	import HelpDialog from '$lib/keys/HelpDialog.svelte';
	import { onKeydown } from '$lib/keys/dispatch.svelte';
	import { page } from '$app/state';
	import { beforeNavigate } from '$app/navigation';
	import { leave } from '$lib/keys/recent.svelte';
	import { offer } from '$lib/keys/doen.svelte';
	import { overalDoer } from '$lib/keys/doen-overal';
	import { onMount } from 'svelte';
	import { Lazy } from '$lib/util/lazy.svelte';
	import { READ_PARAM, parseRead } from '$lib/reading/param';

	let { children }: { children?: Snippet } = $props();

	let searchOpen = $state(false);
	let searchQuery = $state('');

	// A page that shows the search field itself gets the focus there; elsewhere the overlay
	// opens. A query given along starts the field with that text.
	function openSearch(query?: string) {
		const field = document.querySelector<HTMLInputElement>('main [data-search-field]');
		if (field && !query) field.focus();
		else {
			searchQuery = query ?? '';
			searchOpen = true;
		}
	}
	provideSearchOpener(openSearch);
	// ⌘K on every page: `keten awb`, `netwerk 36764` (doen-overal.ts).
	onMount(() => offer(overalDoer));
	// Recent in ⌘K: the place left, by the name its tab had.
	// On the first page `from` can come without a url (eerste-verf.test.ts).
	beforeNavigate(({ from }) => {
		const url = from?.url;
		if (url) leave(url, document.title);
	});

	// The Leespaneel, in a chunk of its own: asked when the address names an article to read.
	const readingPanel = new Lazy(() => import('$lib/reading/ReadingPanel.svelte'), 'Leespaneel');
	const reads = $derived(parseRead(page.url.searchParams.get(READ_PARAM)));
	$effect(() => {
		if (reads.length) readingPanel.load();
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div class="app-shell" class:has-panel={reads.length > 0}>
	<a href="#main-content" class="skip-link">Naar inhoud</a>
	{#if $lijstSprong}<a href="#{$lijstSprong}" class="skip-link">Naar de lijst</a>{/if}
	{#each $paneelSprongen as s (s.id)}<a href="#{s.id}" class="skip-link">{s.label}</a>{/each}
	<TopBar onSearchOpen={() => openSearch()} />
	<main id="main-content" tabindex="-1" class="app-shell__content">
		{@render children?.()}
	</main>
	<TabBar onSearchOpen={() => openSearch()} />
</div>

<HelpDialog />
{#if reads.length && readingPanel.component}{@const ReadingPanel =
		readingPanel.component}<ReadingPanel {reads} />{/if}
<SearchOverlay open={searchOpen} query={searchQuery} onClose={() => (searchOpen = false)} />

<style>
	/* ─── Skip link ─────────────────────────────────────────────────────────── */
	.skip-link {
		position: absolute;
		top: -999px;
		left: 8px;
		z-index: calc(var(--z-modal) + 1);
		background: var(--paper);
		color: var(--ink);
		padding: var(--s-2) var(--s-4);
		border: 1px solid var(--rule-strong);
		border-top: none;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		text-decoration: none;
	}
	.skip-link:focus {
		top: 0;
	}
	/* ─── Shell ──────────────────────────────────────────────────────────────── */
	.app-shell {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		min-height: 100dvh;
		background: var(--paper);
	}

	.app-shell__content {
		flex: 1;
		display: flex;
		flex-direction: column;
		width: 100%;
		/* Under the tab bar of a phone. */
		padding-bottom: var(--tabbar-h);
	}
	/* From 1800 px the Leespaneel stands in the flow: the page gives it its width at the right. */
	@media (min-width: 1800px) {
		.app-shell.has-panel .app-shell__content {
			padding-right: var(--paneel-breed);
		}
	}
</style>

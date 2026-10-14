<script lang="ts">
	import { lijstSprong, paneelSprongen } from '$lib/stores/sprong';
	import type { Snippet } from 'svelte';
	import TopBar from './TopBar.svelte';
	import SearchOverlay from './SearchOverlay.svelte';
	import { provideSearchOpener } from '$lib/stores/search-trigger';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { MAP_PARAMS } from '$lib/map/map';

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

	// A map shared as a link (?map=) opens on Gemarkeerd, with the choice to keep it; a link
	// of before (/explore?map=) goes there too.
	$effect(() => {
		const url = page.url;
		if (!url.searchParams.has('map') || url.pathname.startsWith('/gemarkeerd')) return;
		const doel = new URLSearchParams();
		for (const k of MAP_PARAMS) {
			const v = url.searchParams.get(k);
			if (v !== null) doel.set(k, v);
		}
		goto(`/gemarkeerd?${doel}`, { replaceState: true });
	});
</script>

<div class="app-shell">
	<a href="#main-content" class="skip-link">Naar inhoud</a>
	{#if $lijstSprong}<a href="#{$lijstSprong}" class="skip-link">Naar de lijst</a>{/if}
	{#each $paneelSprongen as s (s.id)}<a href="#{s.id}" class="skip-link">{s.label}</a>{/each}
	<TopBar onSearchOpen={() => openSearch()} />
	<main id="main-content" tabindex="-1" class="app-shell__content">
		{@render children?.()}
	</main>
</div>

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
	}
</style>

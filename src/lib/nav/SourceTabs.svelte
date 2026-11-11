<script lang="ts" module>
	import type { shapeOfCategory } from '$lib/bron/vormen';

	export type SourceTab = {
		key: string;
		label: string;
		href: string;
		/** What it holds, as its title. */
		about?: string;
		/** The glyph of the bron a list holds; a page beside the lists has none. */
		shape?: ReturnType<typeof shapeOfCategory>;
	};
</script>

<script lang="ts">
	// The tab strip of a rubriek (Parlement: Kamerleden, Fracties, Commissies; Rechtspraak:
	// Uitspraken, Rechtsgang); the rubrieken themselves are the top navigation. One strip for
	// the lists of Bladeren (IndexView) and the pages beside them (sources.ts `pages`).
	// On a phone the strip pans (wider, it wraps): the tab on screen is brought to the middle of
	// it, on load and when it changes, and an edge that hides tabs fades out (use:sideScroll).
	// Once the fonts are in the tabs are wider, so it centres again then.
	import { centerChild, sideScroll } from '$lib/actions/side-scroll';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';

	let { label, tabs, current }: { label: string; tabs: SourceTab[]; current: string } = $props();

	let bar = $state<HTMLElement | null>(null);
	function centerActive() {
		const on = bar?.querySelector<HTMLElement>('.cat--on');
		if (bar && on) centerChild(bar, on);
	}
	$effect(() => {
		void current;
		if (!bar) return;
		centerActive();
		document.fonts?.addEventListener('loadingdone', centerActive);
		return () => document.fonts?.removeEventListener('loadingdone', centerActive);
	});
</script>

<nav class="catbar" data-zijscroll use:sideScroll aria-label={label} bind:this={bar}>
	{#each tabs as tab (tab.key)}
		<a
			href={tab.href}
			class="cat"
			class:cat--on={tab.key === current}
			aria-current={tab.key === current ? 'page' : undefined}
			title={tab.about}
			data-sveltekit-noscroll
			data-sveltekit-keepfocus
		>
			{#if tab.shape}<KindGlyph vorm={tab.shape} size={11} />{/if}
			<span class="cat-name">{tab.label}</span>
		</a>
	{/each}
</nav>

<style>
	.catbar {
		display: flex;
		align-items: stretch;
		gap: 0;
		padding: var(--s-3) var(--s-5) 0;
		border-bottom: 1px solid var(--rule);
		background: var(--paper);
		flex-shrink: 0;
		overflow-x: auto;
		scrollbar-width: thin;
		/* A tab reached with the keyboard comes clear of the fade, not under it. */
		scroll-padding-inline: var(--s-7);
		/* The fade is wide here: a tab that is half in view reads as one that goes on. */
		--fade-width: var(--s-7);
	}
	.cat {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		padding: var(--s-2) var(--s-2) var(--s-3);
		text-decoration: none;
		border-bottom: 2px solid transparent;
		white-space: nowrap;
		color: var(--ink-3);
	}
	.cat-name {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink-3);
		line-height: 1;
		transition: color var(--dur-1) var(--ease);
	}
	.cat:hover .cat-name {
		color: var(--ink-2);
	}
	.cat--on {
		border-bottom-color: var(--ink);
		color: var(--ink);
	}
	.cat--on .cat-name {
		color: var(--ink);
		font-weight: 600;
	}
	@media (max-width: 768px) {
		.catbar {
			padding: var(--s-3) var(--s-4) 0;
		}
		.cat {
			min-height: 44px;
			padding: var(--s-2) var(--s-4) var(--s-3);
		}
	}
</style>

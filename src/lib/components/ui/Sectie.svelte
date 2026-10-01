<script lang="ts">
	// A section of a reader under one heading: a rule in ink, the title in the serif with
	// the glyph of what it lists, and its count. The one form for every section (Loopbaan,
	// Toezeggingen, Dossiers, Stemgeschiedenis).
	import type { Snippet } from 'svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import type { Collection } from '$lib/vocabulary';

	let {
		titel,
		soort,
		aantal,
		id,
		naast,
		children
	}: {
		titel: string;
		/** The glyph before the title: what the section lists. */
		soort?: Collection;
		aantal?: number | null;
		id?: string;
		/** Beside the title, at the right: a link or a control. */
		naast?: Snippet;
		children: Snippet;
	} = $props();
</script>

<section class="sectie" {id}>
	<h3 class="kop">
		{#if soort}<KindGlyph collection={soort} size={14} />{/if}{titel}{#if aantal != null}<span
				class="aantal">{aantal.toLocaleString('nl-NL')}</span
			>{/if}
		{#if naast}<span class="naast">{@render naast()}</span>{/if}
	</h3>
	{@render children()}
</section>

<style>
	.sectie {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		padding-top: var(--s-3);
		border-top: 2px solid var(--ink);
	}
	.kop {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 500;
		color: var(--ink);
	}
	.aantal {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--ink-3);
	}
	.naast {
		margin-left: auto;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 400;
	}
</style>

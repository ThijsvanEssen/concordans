<script lang="ts">
	// The kind of a bron above its title, with its glyph, as a link to the list of that kind
	// in Bladeren: "Kamerlid" leads to Kamerleden. The status bar carried this link before
	// (Thijs, 9 Oct: the place only in the band, the bar for actions). A kind Bladeren has no
	// list of stays plain text.
	import KindGlyph from './KindGlyph.svelte';
	import { indexHref } from './href';
	import { categoryLabel, isIndexCategory } from '$lib/components/explore/index/categories';
	import type { Collection } from '$lib/vocabulary';
	import type { Snippet } from 'svelte';

	let {
		collection,
		lijst = collection,
		glyphOnly = false,
		children
	}: {
		collection: Collection;
		/** The list it leads to where that is not its collection: `ministers` for a bewindspersoon. */
		lijst?: Collection | 'ministers';
		/** The link on the glyph alone, the words beside it (a term with its own hover). */
		glyphOnly?: boolean;
		/** The kind in words; the glyph comes before it. */
		children?: Snippet;
	} = $props();
</script>

{#if isIndexCategory(lijst)}<a
		class="soort raakvlak"
		href={indexHref(lijst)}
		title="Alle {categoryLabel(lijst).toLowerCase()} onder Bronnen"
		aria-label={glyphOnly ? `Alle ${categoryLabel(lijst).toLowerCase()} onder Bronnen` : undefined}
		><KindGlyph {collection} />{#if !glyphOnly}{@render children?.()}{/if}</a
	>{:else}<KindGlyph {collection} />{#if !glyphOnly}{@render children?.()}{/if}{/if}

<style>
	.soort {
		display: inline-flex;
		align-items: baseline;
		gap: inherit;
		color: inherit;
		text-decoration: none;
	}
	.soort:hover {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
</style>

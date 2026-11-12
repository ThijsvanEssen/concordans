<script lang="ts">
	// The articles that give a court its say, each a link to its readable address, with its area
	// where the areas differ; an article not read in the source shows the gap (WetsartikelGat).
	// For the stages of Rechtsgang and the schema of the entries into the Hoge Raad.
	import { openHref } from '$lib/bron/href';
	import { separatorBefore } from '$lib/text/words';
	import type { CourtStep } from './route';
	import WetsartikelGat from '$lib/court-route/WetsartikelGat.svelte';

	let { court }: { court: CourtStep } = $props();
</script>

{#if court.gap}
	<WetsartikelGat />
{:else}
	{#each court.articles as a, i (a.name + (a.area ?? ''))}{separatorBefore(
			i,
			court.articles.length
		)}<a class="raakvlak" href={openHref(a.ref, { path: a.path })}>{a.name}</a
		>{#if a.area}{` (${a.area})`}{/if}{/each}
{/if}

<style>
	a {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 3px;
		/* An article whole on its line: a link that breaks has no one place to tap. */
		white-space: nowrap;
	}
</style>

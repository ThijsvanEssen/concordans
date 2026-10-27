<script lang="ts">
	// The one way a date is shown: a time element with the day in its datetime, so a reader
	// that is not the eye (a screen reader, a search engine) takes it as a date. The form is the
	// helper's of `$lib/text/datum`; the words of the date, where the line wants others (the
	// year in a span, "Vandaag"), come as content. No date: `Waarde`, which says so.
	import type { Snippet } from 'svelte';
	import { dagMaand, dagVan, korteDatum, langeDatum, weekdag } from '$lib/text/datum';
	import Waarde from './Waarde.svelte';

	let {
		iso,
		form = 'kort',
		children
	}: {
		/** An ISO day or moment; only its day counts. */
		iso: string | null | undefined;
		form?: 'kort' | 'dagMaand' | 'lang' | 'weekdag';
		children?: Snippet;
	} = $props();

	const day = $derived(dagVan(iso));
	const stamp = $derived(
		day ? `${day.j}-${String(day.m).padStart(2, '0')}-${String(day.d).padStart(2, '0')}` : null
	);
	const words = $derived({ kort: korteDatum, dagMaand, lang: langeDatum, weekdag }[form](iso));
</script>

{#if stamp}<time datetime={stamp}
		>{#if children}{@render children()}{:else}{words}{/if}</time
	>{:else}<Waarde value={null} />{/if}

<script lang="ts">
	// What a search that found nothing offers beside its links: the one line of what was not
	// read, and the five rubrieken to browse. The page of results and the dialog (⌘K) both draw
	// it, so an empty search reads the same in either (hulp.ts).
	import type { Schema } from '$lib/api/types';
	import TextLink from '$lib/components/ui/TekstLink.svelte';
	import type { SearchKind } from './lanes';
	import { BROWSE, unreadLine } from './hulp';

	let {
		searched,
		onleave
	}: {
		searched: Partial<Record<SearchKind, Schema<'SearchedDTO'>>>;
		/** A rubriek was chosen: the dialog closes. */
		onleave?: () => void;
	} = $props();

	const unread = $derived(unreadLine(searched));
</script>

<div class="hulp stil">
	{#if unread}
		<p class="regel">{unread}</p>
	{/if}
	<p class="kop">Blader in</p>
	<p class="blader">
		{#each BROWSE as b (b.href)}
			<TextLink href={b.href} onclick={onleave}>{b.label}</TextLink>
		{/each}
	</p>
</div>

<style>
	.hulp {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		margin: var(--s-5) 0 0;
		padding-top: var(--s-3);
		border-top: 1px solid var(--rule);
	}
	.kop {
		margin-top: var(--s-2);
		font-size: var(--t-label);
		font-weight: 600;
	}
	p {
		margin: 0;
	}
	.blader {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-4);
	}
</style>

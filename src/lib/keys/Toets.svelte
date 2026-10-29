<script lang="ts">
	// One key of the register as caps: Ctrl or ⌘, Alt or ⌥, and the key. Where the platform is
	// not known (the server's text for a crawler, a page without scripts) both are named, "⌘ K of
	// Ctrl K", and in the app it is the reader's own, from the first paint: the app is not
	// rendered on the server, so no wrong symbol flashes.
	import { platform } from '$lib/util/platform';
	import type { Combo } from './register';

	let { combo }: { combo: Combo } = $props();

	const namen = (mac: boolean): string[] => [
		...(combo.mod ? [mac ? '⌘' : 'Ctrl'] : []),
		...(combo.alt ? [mac ? '⌥' : 'Alt'] : []),
		combo.teken
	];
	const heeftModifier = $derived(!!combo.mod || !!combo.alt);
</script>

{#snippet kappen(namen: string[])}{#each namen as n, i (i)}<kbd>{n}</kbd>{/each}{/snippet}

{#if platform === null && heeftModifier}
	{@render kappen(namen(true))} of {@render kappen(namen(false))}
{:else}
	{@render kappen(namen(platform === 'mac'))}
{/if}

<style>
	kbd + kbd {
		margin-left: var(--s-1);
	}
</style>

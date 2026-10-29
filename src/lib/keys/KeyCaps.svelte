<script lang="ts">
	// One key of the register as caps: Ctrl or ⌘, Alt or ⌥, and the key. Where the platform is
	// not known (the server's text for a crawler, a page without scripts) both are named, "⌘ K of
	// Ctrl K", and in the app it is the reader's own, from the first paint: the app is not
	// rendered on the server, so no wrong symbol flashes.
	import { platform } from '$lib/util/platform';
	import type { Combo } from './register';

	let { combo }: { combo: Combo } = $props();

	const labels = (mac: boolean): string[] => [
		...(combo.mod ? [mac ? '⌘' : 'Ctrl'] : []),
		...(combo.alt ? [mac ? '⌥' : 'Alt'] : []),
		combo.cap
	];
	const hasModifier = $derived(!!combo.mod || !!combo.alt);
</script>

{#snippet caps(names: string[])}{#each names as n, i (i)}<kbd>{n}</kbd>{/each}{/snippet}

{#if platform === null && hasModifier}
	{@render caps(labels(true))} of {@render caps(labels(false))}
{:else}
	{@render caps(labels(platform === 'mac'))}
{/if}

<style>
	kbd + kbd {
		margin-left: var(--s-1);
	}
</style>

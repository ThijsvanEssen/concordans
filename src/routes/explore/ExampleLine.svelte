<script lang="ts">
	// One quiet line over the example network: it is an example, and how to choose another. Once
	// closed it stays closed in this browser.
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import { useSearchOpener } from '$lib/stores/search-trigger';
	import { readStored, writeStored } from '$lib/util/storage';

	let { name }: { name: string } = $props();

	const KEY = 'concordans:voorbeeld-regel';
	let closed = $derived(readStored(KEY) === 'weg');
	const openSearch = useSearchOpener();

	function close() {
		closed = true;
		writeStored(KEY, 'weg');
	}
</script>

{#if !closed}
	<p class="line">
		<span
			>Voorbeeld: {name}. Kies een andere bron via het <TekstLink onclick={() => openSearch()}
				>zoekveld</TekstLink
			> (⌘K).</span
		>
		<IconButton label="Deze regel verbergen" onclick={close}>×</IconButton>
	</p>
{/if}

<style>
	.line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-3);
		margin: 0;
		padding: var(--s-2) var(--s-4);
		border-bottom: 1px solid var(--rule);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	/* Room for the 44 px of its link (.raakvlak) inside the line, off the network under it. */
	@media (pointer: coarse) {
		.line {
			padding-block: var(--s-3);
		}
	}
</style>

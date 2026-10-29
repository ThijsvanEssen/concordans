<script lang="ts">
	// The keys of the register under their contexts: the page /docs/sneltoetsen and the window on
	// Ctrl /. One list, so a promise cannot differ from what is bound (a guard reads both).
	import KeyList from '$lib/components/ui/KeyList.svelte';
	import KeyRow from '$lib/components/ui/KeyRow.svelte';
	import { CONTEXTS, MOUSE, SHORTCUTS, type KeyContext } from './register';
	import KeyCaps from './KeyCaps.svelte';

	let {
		first,
		level = 2
	}: {
		/** The context the reader is in: its group stands first. */
		first?: KeyContext;
		level?: 2 | 3;
	} = $props();

	const groups = $derived(
		[...CONTEXTS]
			.sort((a, b) => Number(b.id === first) - Number(a.id === first))
			.map((c) => ({
				...c,
				shortcuts: SHORTCUTS.filter((t) => t.context === c.id && t.kind !== 'reserved')
			}))
			.filter((g) => g.shortcuts.length > 0)
	);
</script>

{#each groups as g (g.id)}
	<svelte:element this={`h${level}`} class="shortcuts__head" id="shortcuts-{g.id}"
		>{g.name}</svelte:element
	>
	<KeyList>
		{#each g.shortcuts as t (t.id)}
			<KeyRow data-shortcut={t.id}>
				{#snippet key()}
					{#each t.keys as c, i (i)}{#if i > 0}{t.join === 'or' ? ' of ' : ' '}{/if}<KeyCaps
							combo={c}
						/>{/each}
				{/snippet}
				{t.description}{#if t.focusIn}<span class="focus-in">Met de focus {t.focusIn}</span>{/if}
			</KeyRow>
		{/each}
		{#if g.id === 'overal'}
			<KeyRow key={MOUSE.keys}>{MOUSE.description}</KeyRow>
		{/if}
	</KeyList>
{/each}

<style>
	.focus-in {
		display: block;
		color: var(--ink-3);
	}
	.shortcuts__head {
		margin: var(--s-5) 0 var(--s-2);
		font-size: var(--t-body-2);
		font-weight: 600;
		line-height: var(--lh-snug);
	}
</style>

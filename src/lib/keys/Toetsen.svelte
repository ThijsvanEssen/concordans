<script lang="ts">
	// The keys of the register under their contexts: the page /docs/sneltoetsen and the window on
	// Ctrl /. One list, so a promise cannot differ from what is bound (a guard reads both).
	import KeyList from '$lib/components/ui/KeyList.svelte';
	import KeyRow from '$lib/components/ui/KeyRow.svelte';
	import { CONTEXTS, MUIS, TOETSEN, type Context } from './register';
	import Toets from './Toets.svelte';

	let {
		eerst,
		niveau = 2
	}: {
		/** The context the reader is in: its group stands first. */
		eerst?: Context;
		niveau?: 2 | 3;
	} = $props();

	const groepen = $derived(
		[...CONTEXTS]
			.sort((a, b) => Number(b.id === eerst) - Number(a.id === eerst))
			.map((c) => ({
				...c,
				toetsen: TOETSEN.filter((t) => t.context === c.id && t.soort !== 'gereserveerd')
			}))
			.filter((g) => g.toetsen.length > 0)
	);
</script>

{#each groepen as g (g.id)}
	<svelte:element this={`h${niveau}`} class="toetsen__kop" id="toetsen-{g.id}"
		>{g.naam}</svelte:element
	>
	<KeyList>
		{#each g.toetsen as t (t.id)}
			<KeyRow data-toets={t.id}>
				{#snippet key()}
					{#each t.keys as c, i (i)}{#if i > 0}{t.sep === 'of' ? ' of ' : ' '}{/if}<Toets
							combo={c}
						/>{/each}
				{/snippet}
				{t.omschrijving}{#if t.waar}<span class="waar">Met de focus {t.waar}</span>{/if}
			</KeyRow>
		{/each}
		{#if g.id === 'overal'}
			<KeyRow key={MUIS.keys}>{MUIS.omschrijving}</KeyRow>
		{/if}
	</KeyList>
{/each}

<style>
	.waar {
		display: block;
		color: var(--ink-3);
	}
	.toetsen__kop {
		margin: var(--s-5) 0 var(--s-2);
		font-size: var(--t-body-2);
		font-weight: 600;
		line-height: var(--lh-snug);
	}
</style>

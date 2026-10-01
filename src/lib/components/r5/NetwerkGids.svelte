<script lang="ts">
	// Ontwerpstudie ronde 5 (prototype): wat de muis doet op het canvas, in vier tekens en
	// vier woorden, onder in het canvas. Weg te klikken; een vraagteken brengt hem terug.
	import Picto, { type PictoNaam } from './Picto.svelte';

	let { kort = false }: { kort?: boolean } = $props();

	const SLEUTEL = 'concordans:netwerkgids';
	let open = $state(true);
	$effect(() => {
		try {
			open = localStorage.getItem(SLEUTEL) !== 'dicht';
		} catch {
			open = true;
		}
	});
	const zet = (v: boolean) => {
		open = v;
		try {
			localStorage.setItem(SLEUTEL, v ? 'open' : 'dicht');
		} catch {
			/* geen opslag */
		}
	};
	const STAPPEN: [PictoNaam, string][] = [
		['klik', 'kiest'],
		['dubbelklik', 'omgeving'],
		['plus', 'in netwerk'],
		['sleep', 'schuift']
	];
</script>

{#if open}
	<div class="gids" class:kort role="note" aria-label="Zo werkt het netwerk">
		{#each STAPPEN as [p, w] (p)}<span class="stap" title={w}><Picto naam={p} />{#if !kort}{w}{/if}</span>{/each}
		<button type="button" class="dicht" aria-label="Uitleg verbergen" onclick={() => zet(false)}>×</button>
	</div>
{:else}
	<button type="button" class="vraag" aria-label="Zo werkt het netwerk" title="Zo werkt het netwerk" onclick={() => zet(true)}>?</button>
{/if}

<style>
	.gids {
		display: inline-flex;
		align-items: center;
		gap: var(--s-4);
		padding: var(--s-1) var(--s-2) var(--s-1) var(--s-3);
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.stap {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
		white-space: nowrap;
	}
	.dicht,
	.vraag {
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink-3);
		cursor: pointer;
		padding: 0 var(--s-1);
	}
	.vraag {
		width: 26px;
		height: 26px;
		border: 1px solid var(--rule);
		border-radius: 50%;
		background: var(--paper);
		color: var(--ink-2);
		font-weight: 600;
	}
	.kort {
		gap: var(--s-2);
	}
</style>

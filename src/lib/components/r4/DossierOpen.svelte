<script lang="ts">
	// Ontwerpstudie ronde 4 (prototype): een geopende dossierrij in Bladeren. Geen tegels en
	// geen herhaling van nummer en soort (die staan al in de rij): de stand per instantie,
	// de volledige titel als die anders is, en twee knoppen.
	import type { Schema } from '$lib/api/types';
	import { bronHref } from '$lib/bron/href';
	import StandBalk from './StandBalk.svelte';

	let { d }: { d: Schema<'DossierSummaryDTO'> } = $props();
	const bron = $derived(`dossiers/${d.number}`);
	const lezen = $derived(bronHref(bron, { keepMode: false, mode: 'read' }) + '&ontwerp=r4');
	const netwerk = $derived(bronHref(bron, { keepMode: false, mode: 'graph' }));
</script>

<div class="open">
	<StandBalk {d} kop={false} />
	{#if d.title && d.short_title && d.title.trim() !== d.short_title}
		<p class="titel">{d.title}</p>
	{/if}
	<div class="acts">
		<a class="act act--pri" href={lezen}>Dossier lezen →</a>
		<a class="act" href={netwerk}>Toon in netwerk →</a>
	</div>
</div>

<style>
	.open {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		padding: var(--s-4) var(--s-4) var(--s-5);
	}
	.titel {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: var(--lh-body);
		color: var(--ink-2);
		max-width: var(--measure);
	}
	.acts {
		display: flex;
		gap: var(--s-2);
	}
	.act {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-weight: 500;
		padding: var(--s-2) var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		color: var(--ink);
		text-decoration: none;
	}
	.act--pri {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--paper);
	}
</style>

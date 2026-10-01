<script lang="ts">
	// Ontwerpstudie ronde 4b (prototype): een geopende dossierrij in de vorm van OpenRij, net
	// als een kabinet of een bewindspersoon: de zin, de stand per instantie, twee knoppen.
	// Geen herhaling van nummer en soort (die staan al in de rij).
	import type { Schema } from '$lib/api/types';
	import { bronHref } from '$lib/bron/href';
	import OpenRij from './OpenRij.svelte';
	import StandBalk from './StandBalk.svelte';

	let { d }: { d: Schema<'DossierSummaryDTO'> } = $props();
	const bron = $derived(`dossiers/${d.number}`);
	const vol = $derived(d.title && d.short_title && d.title.trim() !== d.short_title ? d.title : null);
</script>

<OpenRij
	links={vol ? [{ label: `Volledige titel: ${vol}` }] : []}
	lezen={bronHref(bron, { keepMode: false, mode: 'read' }) + '&ontwerp=r4'}
	lezenLabel="Dossier lezen"
	netwerk={bronHref(bron, { keepMode: false, mode: 'graph' })}
>
	{#snippet boven()}<StandBalk {d} kop={false} />{/snippet}
</OpenRij>

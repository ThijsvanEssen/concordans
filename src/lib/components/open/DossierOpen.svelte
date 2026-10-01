<script lang="ts">
	// Een geopende dossierrij in de vorm van OpenRij, net
	// als een kabinet of een bewindspersoon: de zin, de stand per instantie, twee knoppen.
	// Geen herhaling van nummer en soort (die staan al in de rij).
	import type { Schema } from '$lib/api/types';
	import { bronHref } from '$lib/bron/href';
	import OpenRij from './OpenRij.svelte';
	import StandBalk from '$lib/components/parliamentary/StandBalk.svelte';

	let { d }: { d: Schema<'DossierSummaryDTO'> } = $props();
	const bron = $derived(`dossiers/${d.number}`);
	const vol = $derived(
		d.title && d.short_title && d.title.trim() !== d.short_title ? d.title : null
	);
</script>

<OpenRij
	links={vol ? [{ label: `Volledige titel: ${vol}` }] : []}
	lezen={bronHref(bron, { keepMode: false, mode: 'read' })}
	lezenLabel="Dossier lezen"
	netwerk={bronHref(bron, { keepMode: false, mode: 'graph' })}
>
	{#snippet boven()}<StandBalk {d} kop={false} />{/snippet}
</OpenRij>

<script lang="ts">
	// Switching between netwerk and tekst: two buttons with a picture and one word, the
	// chosen one filled in ink (Keuze). Key L.
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import Picto from '$lib/components/ui/Picto.svelte';
	import type { Weergave } from './weergave';

	let { weergave }: { weergave: Weergave } = $props();
</script>

<Keuze
	label="Weergave (toets L)"
	waarde={weergave.stand}
	onSelect={weergave.onKies}
	opties={[
		{ waarde: 'netwerk', label: 'Netwerk', titel: 'Netwerk: de verbindingen' },
		{
			waarde: 'tekst',
			label: 'Tekst',
			uit: !weergave.tekstMogelijk,
			titel: weergave.tekstMogelijk
				? 'Tekst: lezen op volle breedte'
				: 'Deze bron heeft geen eigen tekst'
		}
	]}
>
	{#snippet voor(w)}<Picto naam={w} size={15} />{/snippet}
</Keuze>

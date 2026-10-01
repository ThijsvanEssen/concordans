<script lang="ts">
	// Switching between netwerk and tekst: two buttons with a picture and one word, the
	// chosen one filled in ink (Keuze). Key L.
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import Picto from '$lib/components/ui/Picto.svelte';

	type Stand = 'netwerk' | 'tekst';
	let {
		stand,
		onKies,
		tekstMogelijk = true
	}: {
		stand: Stand;
		onKies: (s: Stand) => void;
		/** A bron without a text of its own: the reader already stands beside the network. */
		tekstMogelijk?: boolean;
	} = $props();
</script>

<Keuze
	klein
	label="Weergave (toets L)"
	waarde={stand}
	{onKies}
	opties={[
		{ waarde: 'netwerk', label: 'Netwerk', titel: 'Netwerk: de verbindingen' },
		{
			waarde: 'tekst',
			label: 'Tekst',
			uit: !tekstMogelijk,
			titel: tekstMogelijk ? 'Tekst: lezen op volle breedte' : 'Deze bron heeft geen eigen tekst'
		}
	]}
>
	{#snippet voor(w)}<Picto naam={w} size={15} />{/snippet}
</Keuze>

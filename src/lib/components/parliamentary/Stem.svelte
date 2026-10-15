<script lang="ts">
	import { capitalize } from '$lib/text/words';
	// A vote cast, Voor or Tegen, in the shape of an outcome (Uitkomst): a filled box for
	// voor, an open box for tegen, a dashed one for what is neither (niet deelgenomen). Shape,
	// colour and word, so it reads without colour too (Thijs, 9 Oct: "voor en tegen mogen
	// wel iets meer onderscheidend zijn"). The same everywhere a stem stands.
	import Uitkomst from './Uitkomst.svelte';

	let {
		keuze,
		woord = true
	}: {
		/** As the source writes it: `Voor`, `Tegen`, `Niet deelgenomen`. */
		keuze: string;
		/** Without the word only the box, the word in its title. */
		woord?: boolean;
	} = $props();

	const soort = $derived(
		/^voor$/i.test(keuze) ? 'ja' : /^tegen$/i.test(keuze) ? 'nee' : ('open' as const)
	);
	const naam = $derived(capitalize(keuze.toLowerCase()));
</script>

<Uitkomst {soort} woord={woord ? naam : null} title={naam} />

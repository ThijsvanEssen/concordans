<script lang="ts">
	// "36496 Wet betaalbare huur": a dossier by its number and name. The number stands at once;
	// where the data on hand has no name, it is asked once it comes into view (naamVanNummer:
	// once per number, two at a time), so a list of fifty numbers costs nothing until it is
	// read, and never holds up a first paint.
	import { dossierName, naamVanNummer, type DossierNaamBron } from './dossier-naam';

	let {
		dossier
	}: {
		/** The number, with what the data has of its name. */
		dossier: DossierNaamBron | string;
	} = $props();

	const d = $derived<DossierNaamBron>(typeof dossier === 'string' ? { number: dossier } : dossier);
	const bekend = $derived(((n) => (n === d.number ? null : n))(dossierName(d)));
	let gevonden = $state<string | null>(null);
	const naam = $derived(bekend ?? gevonden);

	let el = $state<HTMLElement | null>(null);
	$effect(() => {
		const nummer = d.number;
		gevonden = null;
		if (bekend || !el) return;
		let weg = false;
		const kijk = new IntersectionObserver((entries) => {
			if (!entries.some((e) => e.isIntersecting)) return;
			kijk.disconnect();
			void naamVanNummer(nummer).then((n) => {
				if (!weg) gevonden = n;
			});
		});
		kijk.observe(el);
		return () => {
			weg = true;
			kijk.disconnect();
		};
	});
</script>

<span class="dossier" bind:this={el}
	>{d.number}{#if naam}<span class="naam">{` ${naam}`}</span>{/if}</span
>

<style>
	/* On a phone the name wraps; the number stays whole. */
	.dossier {
		overflow-wrap: break-word;
	}
</style>

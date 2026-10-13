<script lang="ts">
	// A dossier as the reader knows it, the one component for it: "Kamerstuk 36496 Wet
	// betaalbare huur" in a line of text, or only the name where its kind and number stand
	// beside it (a row of Verbonden, whose meta reads "Kamerstuk 36496"). The long title is on
	// hover. Where the data on hand has no short title, it is asked once the name comes into
	// view (once per number, two at a time), so a list of fifty costs nothing until it is read
	// and never holds up a first paint.
	import { dossierVolledigeTitel, kamerstukNummer, type DossierNaamBron } from './dossier-naam';
	import { dossierNaamNu, vraagDossierNaam } from './dossier-namen.svelte';

	let {
		dossier,
		vorm = 'label',
		hover = true
	}: {
		/** The number, with what the data has of its name. */
		dossier: DossierNaamBron | string;
		/** `label`: "Kamerstuk 36496 Wet betaalbare huur"; `naam`: "Wet betaalbare huur". */
		vorm?: 'label' | 'naam';
		/** The long title on hover; off inside a link that carries its own. */
		hover?: boolean;
	} = $props();

	const d = $derived<DossierNaamBron>(typeof dossier === 'string' ? { number: dossier } : dossier);
	const naam = $derived(((n) => (n === d.number ? null : n))(dossierNaamNu(d)));
	const lang = $derived(hover ? dossierVolledigeTitel(d, naam ?? d.number) : null);

	let el = $state<HTMLElement | null>(null);
	$effect(() => {
		const bron = d;
		if (!el) return;
		const kijk = new IntersectionObserver((entries) => {
			if (!entries.some((e) => e.isIntersecting)) return;
			kijk.disconnect();
			vraagDossierNaam(bron);
		});
		kijk.observe(el);
		return () => kijk.disconnect();
	});
</script>

<span class="dossier" bind:this={el} title={lang ?? undefined}
	>{#if vorm === 'naam'}{naam ?? kamerstukNummer(d.number)}{:else}{kamerstukNummer(
			d.number
		)}{#if naam}<span class="naam">{` ${naam}`}</span>{/if}{/if}</span
>

<style>
	/* On a phone the name wraps; the number stays whole. */
	.dossier {
		overflow-wrap: break-word;
	}
</style>

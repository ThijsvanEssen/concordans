<script lang="ts">
	// A dossier as the reader knows it, the one component for it: "Dossier 36496 Wet
	// betaalbare huur" in a line of text, or only the name where its kind and number stand
	// beside it (a row of Verbonden, whose meta reads "Dossier 36496"). The long title is on
	// hover. The name is the short title the data on hand carries: no request of its own.
	import {
		dossierOwnName,
		dossierVolledigeTitel,
		kamerstukNummer,
		type DossierNaamBron
	} from './dossier-naam';

	let {
		dossier,
		vorm = 'label',
		hover = true
	}: {
		/** The number, with what the data has of its name. */
		dossier: DossierNaamBron | string;
		/** `label`: "Dossier 36496 Wet betaalbare huur"; `naam`: "Wet betaalbare huur". */
		vorm?: 'label' | 'naam';
		/** The long title on hover; off inside a link that carries its own. */
		hover?: boolean;
	} = $props();

	const d = $derived<DossierNaamBron>(typeof dossier === 'string' ? { number: dossier } : dossier);
	const naam = $derived(dossierOwnName(d));
	const lang = $derived(hover ? dossierVolledigeTitel(d, naam ?? d.number) : null);
</script>

<span class="dossier" title={lang ?? undefined}
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

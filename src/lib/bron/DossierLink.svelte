<script lang="ts">
	// "Dossier 34372 Wet …", the dossier of the wet that made a text: a link where the
	// dataset holds the dossier, plain text that says so where it does not. The name is the
	// short title the API gives (0.79.30), else asked by number (DossierNaam).
	import { notHeld } from '$lib/text/coverage';
	import BronLink from './BronLink.svelte';
	import DossierNaam from './DossierNaam.svelte';
	import { dossierNumberLabel } from './dossier-naam';

	let {
		dossier
	}: {
		/** `exists: false`: the data lacks it (an older Kamerstuknummer), so it is not linked. */
		dossier: {
			key: string;
			number: string;
			title?: string | null;
			short_title?: string | null;
			exists?: boolean;
		};
	} = $props();
</script>

{#if dossier.exists === false}<span title={notHeld('Dit dossier')}
		>{dossierNumberLabel(dossier.number)}</span
	>{:else}<BronLink
		ref={{ collection: 'dossiers', key: dossier.key, number: dossier.number }}
		title={dossier.title ?? 'Het dossier van de wet die de tekst wijzigde'}
		><DossierNaam {dossier} hover={false} /></BronLink
	>{/if}

<script lang="ts">
	// "Kamerstuk 34372 Wet …", the dossier of the wet that made a text: a link where the
	// dataset holds the dossier, plain text that says so where it does not. The name is the
	// short title the API gives (0.79.30), else asked by number (DossierNaam).
	import BronLink from './BronLink.svelte';
	import DossierNaam from './DossierNaam.svelte';
	import { kamerstukNummer } from './dossier-naam';

	let {
		dossier,
		missing = false
	}: {
		dossier: { key: string; number: string; title?: string | null; short_title?: string | null };
		/** The API answered 404 for it: an older Kamerstuknummer the dataset lacks. */
		missing?: boolean;
	} = $props();
</script>

{#if missing}<span title="Dit dossier staat niet in de gegevens"
		>{kamerstukNummer(dossier.number)}</span
	>{:else}<BronLink
		ref={{ collection: 'dossiers', key: dossier.key, number: dossier.number }}
		title={dossier.title ?? 'Het dossier van de wet die de tekst wijzigde'}
		><DossierNaam {dossier} hover={false} /></BronLink
	>{/if}

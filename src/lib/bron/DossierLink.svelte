<script lang="ts">
	// "Kamerstuk 34372", the dossier of the wet that made a text: a link where the dataset
	// holds the dossier, plain text that says so where it does not.
	import { bronHref } from './href';

	let {
		dossier,
		missing = false
	}: {
		dossier: { key: string; number: string; title?: string | null };
		/** The API answered 404 for it: an older Kamerstuknummer the dataset lacks. */
		missing?: boolean;
	} = $props();
</script>

{#if missing}<span title="Dit dossier staat niet in de dataset">Kamerstuk {dossier.number}</span
	>{:else}<a
		href={bronHref({ collection: 'dossiers', key: dossier.key, number: dossier.number })}
		data-sveltekit-noscroll
		title={dossier.title ?? 'Het dossier van de wet die de tekst wijzigde'}
		>Kamerstuk {dossier.number}</a
	>{/if}

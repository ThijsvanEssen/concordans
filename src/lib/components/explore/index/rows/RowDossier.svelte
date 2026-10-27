<script lang="ts">
	// The name of a dossier under the title of a row, whole: the narrow lead holds its number
	// and nothing that a clamp has to cut (Lijstrij: a dossier always with number and name).
	// Where the title already says it, the row leaves it out. One form for the stemming and
	// the Kamerstuk (guards/lijsten.test.ts).
	import { dossierOwnName, type DossierNaamBron } from '$lib/bron/dossier-naam';

	let { dossier }: { dossier: DossierNaamBron | null | undefined } = $props();
	const label = $derived(dossier ? dossierOwnName(dossier) : null);
</script>

{#if label}<span class="row-sub">{label}</span>{/if}

<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import NietGevonden from '$lib/components/ui/NietGevonden.svelte';
	import { reloadForNewVersion } from '$lib/util/reload';

	// A page that fails because a deploy removed its chunks loads again from the new release.
	onMount(() => {
		if ($page.status >= 500) reloadForNewVersion();
	});
</script>

{#if $page.status === 404}
	<NietGevonden />
{:else}
	<NietGevonden status={$page.status} titel="Er ging iets mis">
		<p>De pagina kon niet worden getoond. Laad de pagina opnieuw of probeer het later nog eens.</p>
	</NietGevonden>
{/if}

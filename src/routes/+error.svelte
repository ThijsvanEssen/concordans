<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import NietGevonden from '$lib/components/ui/NietGevonden.svelte';
	import { reloadForNewVersion } from '$lib/util/reload';

	// A failed page: its title and Opnieuw laden, no text. Without a connection it says so;
	// a 500 the API logged carries its kenmerk beside the status, for a reader to pass on.
	let offline = $state(false);
	const kenmerk = $derived(page.error?.kenmerk ?? null);

	onMount(() => {
		const sync = () => (offline = !navigator.onLine);
		sync();
		// A page that fails because a deploy removed its chunks loads again from the new release.
		if (page.status >= 500 && !offline) reloadForNewVersion();
		window.addEventListener('online', sync);
		window.addEventListener('offline', sync);
		return () => {
			window.removeEventListener('online', sync);
			window.removeEventListener('offline', sync);
		};
	});
</script>

{#if page.status === 404}
	<NietGevonden />
{:else}
	<NietGevonden
		status={page.status}
		title={offline ? 'Geen verbinding' : 'Er ging iets mis'}
		code={offline ? null : kenmerk ? `${page.status}, kenmerk ${kenmerk}` : String(page.status)}
	>
		{#snippet actions()}
			<button type="button" class="btn is-groot is-primary" onclick={() => location.reload()}
				>Opnieuw laden</button
			>
			<a href="/" class="btn is-groot">Naar de startpagina</a>
		{/snippet}
	</NietGevonden>
{/if}

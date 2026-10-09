<script lang="ts">
	import { page } from '$app/stores';
	import { updated } from '$app/state';
	import { onMount } from 'svelte';
	import NietGevonden from '$lib/components/ui/NietGevonden.svelte';

	/** Set when this tab reloaded for a new version; it reloads once per version. */
	const RELOADED = 'concordans:herladen';

	// A page that fails because a deploy removed its chunks: load it again, once, from the
	// new release. Without a new version the error stays.
	onMount(async () => {
		if ($page.status < 500) return;
		const fresh = await updated.check().catch(() => false);
		if (!fresh) return;
		try {
			if (sessionStorage.getItem(RELOADED) === location.href) return;
			sessionStorage.setItem(RELOADED, location.href);
		} catch {
			return;
		}
		location.reload();
	});
</script>

{#if $page.status === 404}
	<NietGevonden />
{:else}
	<NietGevonden status={$page.status} titel="Er ging iets mis">
		<p>De pagina kon niet worden getoond. Laad de pagina opnieuw of probeer het later nog eens.</p>
	</NietGevonden>
{/if}

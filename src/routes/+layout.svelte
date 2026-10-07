<script lang="ts">
	import AppShell from '$lib/components/layout/AppShell.svelte';
	import type { Snippet } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { updated } from '$app/state';

	let { children }: { children: Snippet } = $props();

	// After a deploy the old chunks are gone: the next page loads in full, from the new release.
	beforeNavigate(({ willUnload, to }) => {
		if (updated.current && !willUnload && to?.url) location.href = to.url.href;
	});
</script>

<AppShell>
	{@render children()}
</AppShell>

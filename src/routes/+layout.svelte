<script lang="ts">
	import AppShell from '$lib/components/layout/AppShell.svelte';
	import type { Snippet } from 'svelte';
	import { dev } from '$app/environment';
	import { afterNavigate } from '$app/navigation';
	import { meldZijscroll } from '$lib/dev/zijscroll';

	let { children }: { children: Snippet } = $props();

	// While developing, a page that scrolls sideways on a phone says so in the console.
	afterNavigate(({ to }) => {
		if (dev && to) meldZijscroll(to.url.pathname + to.url.search);
	});
</script>

<AppShell>
	{@render children()}
</AppShell>

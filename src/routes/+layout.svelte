<script lang="ts">
	import AppShell from '$lib/components/layout/AppShell.svelte';
	import type { Snippet } from 'svelte';
	import { browser, dev } from '$app/environment';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { meldZijscroll } from '$lib/dev/zijscroll';
	import { canonical } from '$lib/seo/routes';
	import { serverKop } from '$lib/seo/kop.svelte';

	let { children }: { children: Snippet } = $props();

	// The server gives a readable address its content in <main id="seo"> and its head
	// (title, description, canonical, og:*, JSON-LD), each tag marked data-seo
	// (~/Development/seo-html-ontwerp.md). The content goes before the app's first paint:
	// the app shows the same, and the page has it once.
	if (browser) document.getElementById('seo')?.remove();
	// Without a head from the server (the plain index.html, when the API is down) the fixed
	// description of app.html gives way to the page's own.
	if (browser && !serverKop.actief)
		for (const el of document.head.querySelectorAll('[data-seo]')) el.remove();

	// The server's head stays for the page it was made for: that is what a search engine
	// reads, rendered or not. At the first step to another address it is stale, and the
	// app keeps title, description and canonical itself; a filter or ?lezen=1 is the same
	// address.
	afterNavigate(({ from, to }) => {
		if (dev && to) meldZijscroll(to.url.pathname + to.url.search);
		const van = from?.url;
		const naar = to?.url;
		if (!van || !naar || canonical(van) === canonical(naar)) return;
		if (serverKop.actief) {
			for (const el of document.head.querySelectorAll('[data-seo]')) el.remove();
			serverKop.actief = false;
		}
		// An English judgment of the EHRM is served as lang="en"; the next page is Dutch.
		document.documentElement.lang = 'nl';
	});
</script>

<svelte:head>
	{#if !serverKop.actief}<link rel="canonical" href={canonical(page.url)} />{/if}
</svelte:head>

<AppShell>
	{@render children()}
</AppShell>

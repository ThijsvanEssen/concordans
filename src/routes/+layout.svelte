<script lang="ts">
	import AppShell from '$lib/components/layout/AppShell.svelte';
	import type { Snippet } from 'svelte';
	import { browser, dev } from '$app/environment';
	import { afterNavigate } from '$app/navigation';
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import { meldZijscroll } from '$lib/dev/zijscroll';
	import { canonical } from '$lib/seo/routes';
	import { LADEN_TITEL, serverKop } from '$lib/seo/kop.svelte';

	let { children }: { children: Snippet } = $props();

	// The server gives a readable address its content in <main id="seo"> and its head
	// (title, description, canonical, og:*, JSON-LD), each tag marked data-seo
	// (~/Development/seo-html-ontwerp.md). The content goes before the app's first paint:
	// the app shows the same, and the page has it once.
	if (browser) {
		// The app is here: the server's text goes, and so does the timer that would show it
		// when the app did not come (app.html).
		clearTimeout(window.__seoTerug);
		document.getElementById('seo')?.remove();
	}
	// Without a head from the server (the plain index.html, when the API is down) the fixed
	// description of app.html gives way to the page's own.
	if (browser && !serverKop.actief)
		for (const el of document.head.querySelectorAll('[data-seo]')) el.remove();

	// The server's head stays for the page it was made for: that is what a search engine
	// reads, rendered or not. At the first step to another address it is stale, and the
	// app keeps title, description and canonical itself; a filter or ?lezen=1 is the same
	// address.
	afterNavigate(({ from, to }) => {
		const van = from?.url;
		const naar = to?.url;
		if (dev && naar) meldZijscroll(naar.pathname + naar.search);
		if (!van || !naar || canonical(van) === canonical(naar)) return;
		if (serverKop.actief) {
			for (const el of document.head.querySelectorAll('[data-seo]')) el.remove();
			serverKop.actief = false;
		}
		// An English judgment of the EHRM is served as lang="en"; the next page is Dutch.
		document.documentElement.lang = 'nl';
		void kondigAan();
	});

	// SvelteKit announces the title right after a step, before a bron's name has come (the
	// reader says Laden… then). The name that follows is announced here, once (UX test 10
	// Oct, #13: the previous page's name was read out).
	let aankondiging = $state('');
	let stop: (() => void) | null = null;
	async function kondigAan() {
		stop?.();
		aankondiging = '';
		await tick();
		const gezegd = document.title;
		// The name settles first: the light node's, then the full node's ("Rob Jetten", then
		// "Rob Jetten (D66)").
		let rust: ReturnType<typeof setTimeout> | undefined;
		const kijk = new MutationObserver(() => {
			clearTimeout(rust);
			const t = document.title;
			if (t === gezegd || t === LADEN_TITEL) return;
			rust = setTimeout(() => {
				aankondiging = t;
				stop?.();
			}, 500);
		});
		const klaar = setTimeout(() => stop?.(), 30_000);
		stop = () => {
			kijk.disconnect();
			clearTimeout(klaar);
			clearTimeout(rust);
			stop = null;
		};
		kijk.observe(document.head, { subtree: true, childList: true, characterData: true });
	}
</script>

<svelte:head>
	{#if !serverKop.actief}<link rel="canonical" href={canonical(page.url)} />{/if}
</svelte:head>

<AppShell>
	{@render children()}
</AppShell>
<p class="sr-only" aria-live="polite" aria-atomic="true">{aankondiging}</p>

<script lang="ts">
	import AppShell from '$lib/components/layout/AppShell.svelte';
	import { report } from '$lib/api/errors';
	import type { Snippet } from 'svelte';
	import { browser, dev } from '$app/environment';
	import { afterNavigate } from '$app/navigation';
	import { tick } from 'svelte';
	import { afterTick } from '$lib/util/after-tick';
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
		afterTick(stilAnnouncer);
		if (!van || !naar || canonical(van) === canonical(naar)) return;
		if (serverKop.actief) {
			for (const el of document.head.querySelectorAll('[data-seo]')) el.remove();
			serverKop.actief = false;
		}
		// An English judgment of the EHRM is served as lang="en"; the next page is Dutch.
		document.documentElement.lang = 'nl';
		kondigAan().catch((e) => report('Aankondiging', e));
	});

	// The page's name after a step is said here, once, when it has settled (UX test 10 Oct
	// and 0.79.43, #13). SvelteKit's own announcer reads the title right after the step, while a
	// bron is still on its way ("Laden…, Concordans" at every step): it is made silent, and
	// this region says every page, also one whose title was final before the first read
	// (a kabinet, a judgment).
	const stilAnnouncer = () =>
		document.getElementById('svelte-announcer')?.setAttribute('aria-live', 'off');
	// SvelteKit adds it at the first step: silent from the moment it is there.
	if (browser) {
		const komt = new MutationObserver(() => {
			if (!document.getElementById('svelte-announcer')) return;
			stilAnnouncer();
			komt.disconnect();
		});
		komt.observe(document.body, { childList: true, subtree: true });
	}
	let aankondiging = $state('');
	let stop: (() => void) | null = null;
	async function kondigAan() {
		stop?.();
		aankondiging = '';
		await tick();
		// The name settles first: the light node's, then the full node's ("Rob Jetten", then
		// "Rob Jetten (D66)"); what stands half a second unchanged is said.
		let rust: ReturnType<typeof setTimeout> | undefined;
		const wacht = () => {
			clearTimeout(rust);
			const t = document.title;
			if (!t || t === LADEN_TITEL) return;
			rust = setTimeout(() => {
				aankondiging = t;
				stop?.();
			}, 500);
		};
		const kijk = new MutationObserver(wacht);
		const klaar = setTimeout(() => stop?.(), 30_000);
		stop = () => {
			kijk.disconnect();
			clearTimeout(klaar);
			clearTimeout(rust);
			stop = null;
		};
		kijk.observe(document.head, { subtree: true, childList: true, characterData: true });
		wacht();
	}
</script>

<svelte:head>
	{#if !serverKop.actief}<link rel="canonical" href={canonical(page.url)} />{/if}
</svelte:head>

<AppShell>
	{@render children()}
</AppShell>
<!-- Fixed at the top: after the shell it stood below the screen's height and the page scrolled (#35). -->
<p class="sr-only aankondiging" aria-live="polite" aria-atomic="true">{aankondiging}</p>

<style>
	.aankondiging {
		position: fixed;
		top: 0;
		left: 0;
	}
</style>

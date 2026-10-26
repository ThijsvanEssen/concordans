<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { modKey } from '$lib/util/platform';
	import Wordmark from './Wordmark.svelte';
	import MineMenu from './MineMenu.svelte';
	import NetworkButton from './NetworkButton.svelte';
	import { sign } from '$lib/bevestig/bevestig.svelte';
	import { SOURCES, sourceOf } from '$lib/nav/sources';

	let { onSearchOpen }: { onSearchOpen?: () => void } = $props();

	const isHome = $derived($page.url.pathname === '/');
	// The source a page stands under: the list of Bladeren or the bron read; the network, the
	// start page and Mijn stand under none.
	const source = $derived(sourceOf($page.url));
	const isActueel = $derived($page.url.pathname.startsWith('/actueel'));

	// Something kept or followed shows a sign at Mijn until the reader has been there (the
	// ritual of Bewaar and Volg, bevestig.svelte.ts).
	$effect(() => sign.visited($page.url.pathname));

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			onSearchOpen?.();
		}
		if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
			const tag = (document.activeElement as HTMLElement | null)?.tagName;
			if (
				tag === 'INPUT' ||
				tag === 'TEXTAREA' ||
				(document.activeElement as HTMLElement | null)?.isContentEditable
			)
				return;
			e.preventDefault();
			goto('/docs/sneltoetsen');
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<header class="topbar">
	<a href="/" class="logo raakvlak" aria-label="Concordans">
		<Wordmark />
	</a>

	<nav class="topbar-nav" aria-label="Hoofdnavigatie">
		{#each SOURCES as s (s.id)}
			<a
				href={s.href}
				class="nav-link"
				class:is-active={source?.id === s.id}
				aria-current={source?.id === s.id ? 'page' : undefined}>{s.label}</a
			>
		{/each}
		<a
			href="/actueel"
			class="nav-link"
			class:is-active={isActueel}
			aria-current={isActueel ? 'page' : undefined}>Actueel</a
		>
	</nav>

	<div class="topbar-right">
		<!-- The start page shows the search field itself. On a phone Zoeken is a tab. -->
		{#if !isHome}
			<button
				class="search-trigger raakvlak-knop"
				onclick={() => onSearchOpen?.()}
				aria-label="Zoeken ({modKey} K)"
			>
				<svg
					width="13"
					height="13"
					viewBox="0 0 13 13"
					fill="none"
					stroke="currentColor"
					stroke-width="1.4"
					aria-hidden="true"
				>
					<circle cx="5.5" cy="5.5" r="4" />
					<path d="M8.5 8.5l3 3" />
				</svg>
				<span class="search-trigger-label">Zoek een wet, uitspraak of dossier</span>
				<span class="kbd">{modKey}K</span>
			</button>
		{/if}
		<NetworkButton />
		<div class="mine-slot"><MineMenu /></div>
	</div>
</header>

<style>
	.topbar {
		position: sticky;
		top: 0;
		z-index: var(--z-topbar);
		height: var(--balk-h);
		background: var(--paper);
		border-bottom: 1px solid var(--rule);
		display: flex;
		/* The wordmark and the links share a baseline; the controls on the right are centred. */
		align-items: baseline;
		gap: var(--s-6);
		padding: 0 var(--s-6);
		flex-shrink: 0;
		width: 100%;
	}

	.logo {
		display: flex;
		flex-shrink: 0;
	}

	.topbar-nav {
		display: flex;
		gap: var(--s-5);
		color: var(--ink-3);
	}

	/* The navigation is a menu: the sans of the controls. */
	.nav-link {
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		font-weight: 500;
		color: inherit;
		/* One pixel lower than centred, so the capitals sit on the bar's middle. */
		padding: 21px 0 19px;
	}

	.nav-link:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.nav-link.is-active {
		color: var(--ink);
	}

	.topbar-right {
		align-self: center;
		margin-left: auto;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: var(--s-4);
	}

	/* The search field: a button that looks like the field it opens. */
	.search-trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		width: 340px;
		max-width: 100%;
		min-width: 0;
		height: var(--veld-h);
		padding: 0 var(--s-3);
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		cursor: text;
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		color: var(--ink-3);
		transition: border-color var(--dur-1) var(--ease);
	}

	.search-trigger:hover {
		border-color: var(--ink-3);
	}

	.search-trigger-label {
		flex: 1;
		text-align: left;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.kbd {
		font-size: var(--t-label);
		color: var(--ink-3);
		white-space: nowrap;
	}

	/* Six links, the search field, Netwerk and Mijn: the field narrows first, then folds to its
	   icon, and the links draw closer. */
	@media (max-width: 1439px) {
		.search-trigger {
			width: 240px;
		}
		.kbd {
			display: none;
		}
	}
	@media (max-width: 1100px) {
		.topbar {
			gap: var(--s-5);
			padding: 0 var(--s-5);
		}
		.topbar-nav {
			gap: var(--s-4);
		}
		.topbar-right {
			gap: var(--s-3);
		}
		.search-trigger {
			width: auto;
		}
		.search-trigger-label {
			display: none;
		}
	}

	/* A phone: the logo and the Netwerk button; Zoeken, Bladeren, Actueel and Mijn are the tab
	   bar (TabBalk). */
	@media (max-width: 768px) {
		.topbar {
			align-items: center;
			gap: var(--s-3);
			padding: 0 max(var(--s-4), var(--safe-right)) 0 max(var(--s-4), var(--safe-left));
		}
		.topbar-nav,
		.search-trigger,
		.mine-slot {
			display: none;
		}
	}
</style>

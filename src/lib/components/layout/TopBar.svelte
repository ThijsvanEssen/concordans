<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { modKey } from '$lib/utils/platform';
	import Wordmark from './Wordmark.svelte';

	let { onSearchOpen }: { onSearchOpen?: () => void } = $props();

	const isHome = $derived($page.url.pathname === '/');
	// Verkenner and Bladeren share the route /explore; `mode=index` tells them apart.
	const isIndex = $derived(
		$page.url.pathname.startsWith('/explore') && $page.url.searchParams.get('mode') === 'index'
	);
	const isExplore = $derived($page.url.pathname.startsWith('/explore') && !isIndex);
	const isDocs = $derived($page.url.pathname.startsWith('/docs'));

	let mobileMenuOpen = $state(false);
	let toggleBtnEl: HTMLButtonElement | null = $state(null);
	let mobileNavEl: HTMLElement | null = $state(null);

	function openMobileMenu() {
		mobileMenuOpen = true;
		requestAnimationFrame(() => mobileNavEl?.querySelector<HTMLElement>('a')?.focus());
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
		toggleBtnEl?.focus();
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			onSearchOpen?.();
		}
		if (e.key === 'Escape' && mobileMenuOpen) {
			closeMobileMenu();
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
	<a href="/" class="logo" aria-label="Concordans">
		<Wordmark />
	</a>

	<nav class="topbar-nav" aria-label="Hoofdnavigatie">
		<a
			href="/explore"
			class="nav-link"
			class:is-active={isExplore}
			aria-current={isExplore ? 'page' : undefined}>Verkenner</a
		>
		<a
			href="/explore?mode=index&kind=dossiers"
			class="nav-link"
			class:is-active={isIndex}
			aria-current={isIndex ? 'page' : undefined}>Bladeren</a
		>
		<a
			href="/docs"
			class="nav-link"
			class:is-active={isDocs}
			aria-current={isDocs ? 'page' : undefined}>Documentatie</a
		>
	</nav>

	<button
		bind:this={toggleBtnEl}
		class="mobile-menu-btn"
		aria-label="Menu"
		aria-expanded={mobileMenuOpen}
		aria-controls="mobile-nav"
		onclick={() => (mobileMenuOpen ? closeMobileMenu() : openMobileMenu())}
	>
		{#if mobileMenuOpen}
			<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
				<line
					x1="2"
					y1="2"
					x2="12"
					y2="12"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
				/>
				<line
					x1="12"
					y1="2"
					x2="2"
					y2="12"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
				/>
			</svg>
		{:else}
			<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
				<line
					x1="2"
					y1="4"
					x2="12"
					y2="4"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
				/>
				<line
					x1="2"
					y1="7"
					x2="12"
					y2="7"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
				/>
				<line
					x1="2"
					y1="10"
					x2="12"
					y2="10"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
				/>
			</svg>
		{/if}
	</button>

	{#if mobileMenuOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div
			id="mobile-nav"
			bind:this={mobileNavEl}
			class="mobile-nav"
			onclick={() => closeMobileMenu()}
		>
			<a href="/explore" class="mobile-nav-link" class:is-active={isExplore}>Verkenner</a>
			<a href="/explore?mode=index&kind=dossiers" class="mobile-nav-link" class:is-active={isIndex}
				>Bladeren</a
			>
			<a href="/docs" class="mobile-nav-link" class:is-active={isDocs}>Documentatie</a>
		</div>
	{/if}

	<!-- The start page shows the search field itself. -->
	{#if !isHome}
		<div class="topbar-right">
			<button
				class="search-trigger"
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
				<span class="search-trigger-label">Zoek een artikel, uitspraak of dossier</span>
				<span class="kbd">{modKey}K</span>
			</button>
		</div>
	{/if}
</header>

<style>
	.topbar {
		position: sticky;
		top: 0;
		z-index: var(--z-topbar);
		height: 60px;
		background: var(--paper);
		border-bottom: 1px solid var(--rule);
		display: flex;
		/* The wordmark and the links share a baseline; the controls on the right are centred. */
		align-items: baseline;
		gap: var(--s-6);
		padding: 0 28px;
		flex-shrink: 0;
		width: 100%;
	}

	.logo {
		display: flex;
		flex-shrink: 0;
	}

	.topbar-nav {
		display: flex;
		gap: 20px;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-weight: 500;
		color: var(--ink-3);
	}

	.nav-link {
		color: inherit;
		/* One pixel lower than centred, so the capitals sit on the bar's middle. */
		padding: 21px 0 19px;
	}

	.nav-link:hover {
		color: var(--accent);
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
	}

	/* The search field: a button that looks like the field it opens. */
	.search-trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		width: 340px;
		max-width: 100%;
		min-width: 0;
		height: 32px;
		padding: 0 10px;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		cursor: text;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
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

	.mobile-menu-btn {
		align-self: center;
		display: none;
		background: none;
		border: 0;
		cursor: pointer;
		padding: 6px var(--s-2);
		color: var(--ink-2);
		line-height: 1;
	}

	.mobile-nav {
		position: fixed;
		top: 60px;
		left: 0;
		right: 0;
		background: var(--paper);
		border-bottom: 1px solid var(--rule);
		display: flex;
		flex-direction: column;
		z-index: var(--z-topbar);
		box-shadow: var(--shadow-pop);
	}

	.mobile-nav-link {
		font-family: var(--font-sans);
		font-size: var(--t-body-2);
		color: var(--ink-2);
		padding: 14px var(--s-5);
		border-top: 1px solid var(--rule);
	}

	.mobile-nav-link:hover,
	.mobile-nav-link.is-active {
		color: var(--ink);
		background: var(--paper-2);
	}

	@media (max-width: 1000px) {
		.search-trigger {
			width: 220px;
		}
	}

	@media (max-width: 640px) {
		/* Without the links there is no baseline to share. */
		.topbar {
			align-items: center;
			gap: var(--s-3);
			padding: 0 var(--s-4);
		}
		.topbar-nav {
			display: none;
		}
		.mobile-menu-btn {
			display: flex;
			align-items: center;
		}
		.search-trigger {
			width: auto;
		}
		.search-trigger-label,
		.kbd {
			display: none;
		}
	}
</style>

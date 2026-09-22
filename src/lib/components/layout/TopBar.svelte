<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { modKey } from '$lib/utils/platform';

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
	<a href="/" class="logo no-underline" aria-label="Concordans">
		<svg class="logo-mark" viewBox="0 0 36 36" aria-hidden="true">
			<line x1="6" y1="10" x2="18" y2="18" stroke="var(--ink-3)" stroke-width="0.8" />
			<line x1="30" y1="8" x2="18" y2="18" stroke="var(--ink-3)" stroke-width="0.8" />
			<line x1="28" y1="28" x2="18" y2="18" stroke="var(--ink-3)" stroke-width="0.8" />
			<line x1="8" y1="28" x2="18" y2="18" stroke="var(--ink-3)" stroke-width="0.8" />
			<circle cx="6" cy="10" r="2" fill="var(--paper)" stroke="var(--ink-2)" stroke-width="1" />
			<circle cx="30" cy="8" r="2" fill="var(--indigo)" />
			<circle cx="28" cy="28" r="2" fill="var(--paper)" stroke="var(--ink-2)" stroke-width="1" />
			<circle cx="8" cy="28" r="2" fill="var(--paper)" stroke="var(--ink-2)" stroke-width="1" />
			<circle
				cx="18"
				cy="18"
				r="3.6"
				fill="var(--paper)"
				stroke="var(--accent)"
				stroke-width="1.6"
			/>
		</svg>
		<span class="logo-name">Concordans</span>
	</a>
	<a
		href="/alpha"
		class="alpha-tag no-underline"
		title="Concordans is in vroege ontwikkeling. Klik voor wat alpha hier betekent.">alpha</a
	>

	<nav class="topbar-nav" aria-label="Hoofdnavigatie">
		<a href="/explore" class="nav-link" class:is-active={isExplore}>Verkenner</a>
		<a href="/explore?mode=index&kind=dossiers" class="nav-link" class:is-active={isIndex}
			>Bladeren</a
		>
		<a href="/docs" class="nav-link" class:is-active={isDocs}>Docs</a>
	</nav>

	<!-- Mobile nav toggle (hidden on desktop) -->
	<button
		bind:this={toggleBtnEl}
		class="mobile-menu-btn"
		aria-label="Menu"
		aria-expanded={mobileMenuOpen}
		aria-controls="mobile-nav"
		onclick={() => (mobileMenuOpen ? closeMobileMenu() : openMobileMenu())}
	>
		{#if mobileMenuOpen}
			<svg
				class="mobile-menu-icon"
				width="14"
				height="14"
				viewBox="0 0 14 14"
				fill="none"
				aria-hidden="true"
			>
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
			<svg
				class="mobile-menu-icon"
				width="14"
				height="14"
				viewBox="0 0 14 14"
				fill="none"
				aria-hidden="true"
			>
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
			<a href="/docs" class="mobile-nav-link" class:is-active={isDocs}>Docs</a>
		</div>
	{/if}

	<!-- The start page shows the search field itself. -->
	{#if !isHome}
		<div class="topbar-right">
			<button
				class="search-trigger"
				onclick={() => onSearchOpen?.()}
				aria-label={`Zoeken (${modKey}K)`}
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					aria-hidden="true"
				>
					<circle cx="11" cy="11" r="7" />
					<path d="m20 20-3.5-3.5" />
				</svg>
				<span class="search-trigger-label">Zoeken</span>
				<span class="kbd">{modKey} K</span>
			</button>
		</div>
	{/if}
</header>

<style>
	.topbar {
		position: sticky;
		top: 0;
		z-index: var(--z-topbar);
		height: 64px;
		background: var(--paper);
		border-bottom: 1px solid var(--rule);
		display: flex;
		align-items: center;
		padding: 0 24px;
		flex-shrink: 0;
		width: 100%;
	}

	/* Logo */
	.logo {
		display: flex;
		align-items: center;
		gap: 12px;
		text-decoration: none;
		color: inherit;
		flex-shrink: 0;
	}

	.logo-mark {
		display: block;
		height: 36px;
		width: 36px;
	}

	.alpha-tag {
		display: inline-block;
		margin-left: 12px;
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		text-transform: lowercase;
		letter-spacing: 0.04em;
		color: var(--ochre);
		background: var(--ochre-faint);
		border: 1px solid var(--ochre);
		padding: 2px 7px;
		border-radius: var(--r-1);
		flex-shrink: 0;
		white-space: nowrap;
		text-decoration: none;
		transition: background var(--dur-1) var(--ease);
	}

	.alpha-tag:hover {
		background: var(--ochre);
		color: var(--paper);
	}

	.logo-name {
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: 19px;
		color: var(--ink);
		letter-spacing: 0.005em;
		line-height: 1;
	}

	/* Nav */
	.topbar-nav {
		display: flex;
		gap: 22px;
		margin-left: 36px;
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--fg-2);
	}

	.nav-link {
		border-bottom: none;
		color: inherit;
		text-decoration: none;
		padding: 22px 0;
		transition: color var(--dur-1) var(--ease);
	}

	.nav-link:hover {
		color: var(--ink);
		border-bottom: none;
	}

	.nav-link.is-active {
		color: var(--ink);
		border-bottom: 1.5px solid var(--ink);
	}

	/* Right side */
	.topbar-right {
		margin-left: auto;
		min-width: 0;
		display: flex;
		gap: 14px;
		align-items: center;
	}

	@media (max-width: 1000px) {
		.search-trigger {
			width: 200px;
		}
	}

	/* Search trigger */
	.search-trigger {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 30px;
		padding: 0 12px;
		width: 280px;
		max-width: 100%;
		min-width: 0;
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
		cursor: pointer;
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--fg-3);
		transition: background var(--dur-1) var(--ease);
	}

	.search-trigger:hover {
		background: var(--paper-3);
		color: var(--fg-2);
	}

	.search-trigger-label {
		flex: 1;
		text-align: left;
	}

	.kbd {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--fg-3);
		border: 1px solid var(--rule);
		padding: 1px 6px;
		border-radius: var(--r-1);
		white-space: nowrap;
	}

	.mobile-menu-btn {
		display: none;
		background: none;
		border: 0;
		cursor: pointer;
		padding: 6px 8px;
		color: var(--fg-2);
		font-size: 16px;
		line-height: 1;
		margin-left: 8px;
	}

	.mobile-nav {
		position: fixed;
		top: 64px;
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
		font-size: 14px;
		color: var(--fg-2);
		text-decoration: none;
		border-bottom: none;
		padding: 14px 24px;
		border-top: 1px solid var(--rule);
	}

	.mobile-nav-link:hover,
	.mobile-nav-link.is-active {
		color: var(--ink);
		background: var(--paper-2);
		border-bottom: none;
	}

	@media (max-width: 640px) {
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
		.search-trigger-label {
			display: none;
		}
		.kbd {
			display: none;
		}
	}
</style>

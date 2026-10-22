<script lang="ts">
	import { clickOutside } from '$lib/actions/top-layer';
	import { BUNDLES_PATH } from '$lib/map/page';
	import { page } from '$app/stores';
	import { hasFocus, modeOf } from '$lib/bron/href';
	import { goto } from '$app/navigation';
	import { modKey } from '$lib/util/platform';
	import Wordmark from './Wordmark.svelte';

	let { onSearchOpen }: { onSearchOpen?: () => void } = $props();

	const isHome = $derived($page.url.pathname === '/');
	// The network, the index and the page of a bron share the route /explore. A bron's page
	// is one of the bronnen, its network beside it or not; Samenhang is the network alone.
	const mode = $derived(modeOf($page.url));
	const isBron = $derived(mode !== null && hasFocus($page.url));
	const isIndex = $derived(mode === 'index' || isBron);
	const isExplore = $derived(mode !== null && !isIndex);
	const isActueel = $derived($page.url.pathname.startsWith('/actueel'));
	const isBundles = $derived($page.url.pathname.startsWith(BUNDLES_PATH));
	const isOnderwerpen = $derived($page.url.pathname.startsWith('/onderwerpen'));

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

	/**
	 * The focus leaves the sheet (Tab past Bundels, a click outside): it closes and the
	 * focus goes on where it went, as a menu does (actions/menu.ts). It stood over the page
	 * while Tab went on behind it (audit 3).
	 */
	function focusUitBlad(e: FocusEvent) {
		const naar = e.relatedTarget as Node | null;
		// Focus that goes nowhere is a tap, not Tab: on an iPhone a tapped link takes no focus,
		// and closing here took the sheet away before the tap's click (Thijs, 10 Oct: "op mobiel
		// werken de menuknoppen niet"). A tap elsewhere closes it by its click (below).
		if (!naar) return;
		if (mobileNavEl?.contains(naar) || toggleBtnEl?.contains(naar)) return;
		// A tapped column takes the focus too, without showing it: closing here let the tap's
		// click open what lay under it (#98). Tab shows the focus; a tap closes by its click.
		setTimeout(() => {
			if (naar instanceof Element && naar.matches(':focus-visible')) mobileMenuOpen = false;
		});
	}

	// A click or tap outside the sheet and its button closes it, as a menu does.
	$effect(() => {
		if (!mobileMenuOpen) return;
		return clickOutside(
			() => [mobileNavEl, toggleBtnEl],
			() => (mobileMenuOpen = false)
		);
	});

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
			aria-current={isExplore ? 'page' : undefined}>Samenhang</a
		>
		<a
			href="/explore?mode=index"
			class="nav-link"
			class:is-active={isIndex}
			aria-current={isIndex ? 'page' : undefined}>Bronnen</a
		>
		<a
			href="/actueel"
			class="nav-link"
			class:is-active={isActueel}
			aria-current={isActueel ? 'page' : undefined}>Actueel</a
		>
		<a
			href="/onderwerpen"
			class="nav-link"
			class:is-active={isOnderwerpen}
			aria-current={isOnderwerpen ? 'page' : undefined}>Gevolgd</a
		>
		<!-- Bundels: a page as the others, without a count (Bewaar says per bron what is kept). -->
		<a
			href={BUNDLES_PATH}
			class="nav-link"
			class:is-active={isBundles}
			aria-current={isBundles ? 'page' : undefined}>Bundels</a
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
			onfocusout={focusUitBlad}
		>
			<a href="/explore" class="mobile-nav-link" class:is-active={isExplore}>Samenhang</a>
			<a href="/explore?mode=index" class="mobile-nav-link" class:is-active={isIndex}>Bronnen</a>
			<a href="/actueel" class="mobile-nav-link" class:is-active={isActueel}>Actueel</a>
			<a href="/onderwerpen" class="mobile-nav-link" class:is-active={isOnderwerpen}>Gevolgd</a>
			<a href={BUNDLES_PATH} class="mobile-nav-link" class:is-active={isBundles}>Bundels</a>
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
				<span class="search-trigger-label">Zoek een wet, uitspraak of dossier</span>
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
		height: var(--topbar-h);
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

	.mobile-menu-btn {
		align-self: center;
		display: none;
		background: none;
		border: 0;
		cursor: pointer;
		padding: var(--s-2);
		color: var(--ink-2);
		line-height: 1;
	}

	.mobile-nav {
		position: fixed;
		top: var(--topbar-h);
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
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink-2);
		padding: var(--s-4) var(--s-5);
		border-top: 1px solid var(--rule);
	}

	.mobile-nav-link:hover,
	.mobile-nav-link.is-active {
		color: var(--ink);
		background: var(--paper-2);
	}

	/* Four links and the logo take about 500 px: the search field narrows first. */
	@media (max-width: 900px) {
		.search-trigger {
			width: 220px;
		}
	}
	/* Then it folds to its icon, and the four links keep their room. */
	@media (max-width: 780px) {
		.search-trigger {
			width: auto;
		}
		.search-trigger-label,
		.kbd {
			display: none;
		}
	}

	/* Four links and the search icon need about 600 px: below that, the menu. */
	@media (max-width: 620px) {
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

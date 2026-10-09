<script lang="ts">
	import type { Snippet } from 'svelte';
	import TopBar from './TopBar.svelte';
	import SearchOverlay from './SearchOverlay.svelte';
	import { provideSearchOpener } from '$lib/stores/search-trigger';

	let { children }: { children?: Snippet } = $props();

	let searchOpen = $state(false);
	let searchQuery = $state('');

	// A page that shows the search field itself gets the focus there; elsewhere the overlay
	// opens. A query given along starts the field with that text.
	function openSearch(query?: string) {
		const field = document.querySelector<HTMLInputElement>('main [data-search-field]');
		if (field && !query) field.focus();
		else {
			searchQuery = query ?? '';
			searchOpen = true;
		}
	}
	provideSearchOpener(openSearch);
</script>

<div class="app-shell">
	<a href="#main-content" class="skip-link">Naar inhoud</a>
	<TopBar onSearchOpen={() => openSearch()} />
	<main id="main-content" tabindex="-1" class="app-shell__content">
		{@render children?.()}
	</main>
</div>

<SearchOverlay open={searchOpen} query={searchQuery} onClose={() => (searchOpen = false)} />

<style>
	/* ─── Fonts ──────────────────────────────────────────────────────────────── */
	/* Newsreader, variable (opsz 6..72, wght 400..600), roman and italic; Schibsted
	   Grotesk, variable (wght 400..600). Both under the SIL Open Font License. The
	   latin subset covers Dutch; latin-ext loads only for a page that needs it. */
	@font-face {
		font-family: 'Newsreader';
		src: url('/fonts/Newsreader-Variable.woff2') format('woff2');
		font-weight: 400 600;
		font-style: normal;
		font-display: swap;
		unicode-range:
			U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329,
			U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
	}
	@font-face {
		font-family: 'Newsreader';
		src: url('/fonts/Newsreader-Variable-latin-ext.woff2') format('woff2');
		font-weight: 400 600;
		font-style: normal;
		font-display: swap;
		unicode-range:
			U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329,
			U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F,
			U+A720-A7FF;
	}
	@font-face {
		font-family: 'Newsreader';
		src: url('/fonts/Newsreader-VariableItalic.woff2') format('woff2');
		font-weight: 400 600;
		font-style: italic;
		font-display: swap;
		unicode-range:
			U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329,
			U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
	}
	@font-face {
		font-family: 'Newsreader';
		src: url('/fonts/Newsreader-VariableItalic-latin-ext.woff2') format('woff2');
		font-weight: 400 600;
		font-style: italic;
		font-display: swap;
		unicode-range:
			U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329,
			U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F,
			U+A720-A7FF;
	}
	@font-face {
		font-family: 'Schibsted Grotesk';
		src: url('/fonts/SchibstedGrotesk-Variable.woff2') format('woff2');
		font-weight: 400 600;
		font-style: normal;
		font-display: swap;
		unicode-range:
			U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329,
			U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
	}
	@font-face {
		font-family: 'Schibsted Grotesk';
		src: url('/fonts/SchibstedGrotesk-Variable-latin-ext.woff2') format('woff2');
		font-weight: 400 600;
		font-style: normal;
		font-display: swap;
		unicode-range:
			U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329,
			U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F,
			U+A720-A7FF;
	}
	/* The wordmark's paragraafteken (§) only: Newsreader's own contrast is too even to
	   read as a mark at 22px, so the glyph alone borrows a high-contrast Didone italic
	   — the rest of the type system stays on Newsreader/Schibsted Grotesk. */
	@font-face {
		font-family: 'Playfair Display';
		src: url('/fonts/PlayfairDisplay-Italic-800.woff2') format('woff2');
		font-weight: 800;
		font-style: italic;
		font-display: swap;
		unicode-range: U+00A7;
	}

	/* ─── Design tokens ──────────────────────────────────────────────────────── */
	/* Every component reads these. The canvas reads them too, once, through
	   nodeSprites.ts (readTokens), so a change here reaches the network after a reload. */
	:global(:root) {
		/* Paper and rules */
		--paper: #faf8f3;
		--paper-2: #ece7dc; /* hover, selected row, sheets */
		--rule: #b9b1a0;
		--rule-strong: #6f6859;

		/* Ink */
		--ink: #161513;
		--ink-2: #3b3834;
		--ink-3: #5d5951; /* captions; 6.6:1 on paper */

		/* The accent: a link on hover, the status voorgesteld, and an outcome that says no
		   (--uitkomst-nee). Nothing else is red. */
		--accent: #8c2f28;
		--accent-soft: #f3e4e2;

		/* Text an amendment inserted, in a comparison of versions. Deleted text is struck
		   through in ink, so the two differ by more than colour. */
		--mark-ins: #ece2bd;
		--mark-ins-rule: #b39a4e;

		/* The four colours of the material */
		--indigo: #2f3e5e; /* judgments */
		--moss: #456247; /* structural edges, references between articles */

		/* An outcome, always with its shape or word beside it: passed, done, yes; rejected,
		   withdrawn, no. Dashed is open or expected and needs no colour. */
		--uitkomst-ja: var(--moss);
		--uitkomst-nee: var(--accent);

		/* The height of a control: a field, a select, a choice of buttons. In a bar, the
		   smaller one. */
		--veld-h: 32px;
		--veld-h-klein: 24px;
		--plum: #5e3a55; /* toelichting */
		--slate: #4b5563; /* citations by judgments */

		/* The groups in the network (a hull around their members), each told apart by hue,
		   by a step of 10 in lightness (L* 30, 40, 50, 59) and by its line: apart also with
		   deuteranopia, protanopia and in grey. Against the paper 8.9, 6.1, 4.2 and 3.1:1. */
		--groep-wet: #00487c; /* solid */
		--groep-fractie: #944078; /* dotted */
		--groep-commissie: #438365; /* dash and dot */
		--groep-dossier: #d3762d; /* dashed */

		/* Typography: one text face, one interface face. Identifiers are set in the sans. */
		--font-serif: 'Newsreader', Georgia, serif;
		--font-sans: 'Schibsted Grotesk', system-ui, sans-serif;

		/* Type scale */
		--t-display: 44px;
		--t-h1: 30px; /* page titles, weight 500 */
		--t-h2: 24px;
		--t-h3: 20px;
		--t-body: 17.5px; /* reading text, line-height 1.6 */
		--t-body-2: 16px; /* titles of bronnen in lists and rows */
		--t-meta: 13px; /* interface text: 12.5 to 13px */
		--t-micro: 12px; /* captions and counts, in --ink-3 */
		--t-label: 11px; /* labels over a group: the sans at 500, as written, without spacing */
		--t-glyph: 10px; /* a mark inside a box: a tick, a caret, a badge */
		--t-input: 16px; /* text fields: below 16px a phone zooms in on focus */

		/* Line heights */
		--lh-tight: 1.15;
		--lh-snug: 1.35;
		--lh-body: 1.6;
		--lh-loose: 1.7;

		/* Spacing: 4px grid */
		--s-1: 4px;
		--s-2: 8px;
		--s-3: 12px;
		--s-4: 16px;
		--s-5: 24px;
		--s-6: 32px;
		--s-7: 48px;
		--s-8: 64px;

		/* Layout */
		--measure: 66ch;
		--gutter: var(--s-7);

		/* Radii */
		--r-0: 0px;
		--r-1: 3px; /* buttons, inputs */
		--r-2: 4px; /* menus, cards */
		--r-3: 8px;

		/* Shadows, almost none */
		--shadow-pop: 0 1px 0 rgba(28, 27, 25, 0.04), 0 8px 24px -12px rgba(28, 27, 25, 0.18);
		--shadow-raise:
			0 1px 0 rgba(28, 27, 25, 0.05), 0 4px 12px -4px rgba(28, 27, 25, 0.12),
			0 16px 32px -16px rgba(28, 27, 25, 0.16);
		--shadow-modal: 0 6px 24px rgba(28, 27, 25, 0.1);

		/* Motion */
		--ease: cubic-bezier(0.2, 0.6, 0.2, 1);
		--ease-in: cubic-bezier(0.4, 0, 0.6, 0.2);
		--dur-1: 120ms;
		--dur-2: 220ms;
		--dur-3: 400ms;

		/* Z-index */
		--z-base: 0;
		--z-raised: 10;
		--z-topbar: 20;
		--z-panel: 30;
		--z-float: 40;
		--z-modal: 50;
	}

	/* ─── Global base ────────────────────────────────────────────────────────── */
	:global(html, body) {
		height: 100%;
		margin: 0;
		background: var(--paper);
		color: var(--ink);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		font-optical-sizing: auto;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		text-rendering: optimizeLegibility;
	}

	:global(*, *::before, *::after) {
		box-sizing: border-box;
	}

	:global(#svelte) {
		min-height: 100vh;
		min-height: 100dvh;
	}

	/* Links: ink at rest, the accent on hover. */
	:global(a) {
		color: inherit;
		text-decoration: none;
		transition: color var(--dur-1) var(--ease);
	}
	:global(a:hover) {
		color: var(--accent);
	}

	/* Buttons: 1px rule-strong border, 3px radius, no fill. `is-primary` is ink on paper;
	   `is-text` has no border. */
	:global(.btn) {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: var(--s-1) var(--s-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: transparent;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		line-height: 16px;
		color: var(--ink-2);
		cursor: pointer;
		white-space: nowrap;
		text-decoration: none;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease);
	}
	:global(.btn:hover) {
		color: var(--ink);
		background: var(--paper-2);
	}
	:global(.btn.is-primary) {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}
	:global(.btn.is-primary:hover) {
		background: var(--ink-2);
		border-color: var(--ink-2);
		color: var(--paper);
	}
	:global(.btn.is-text) {
		border-color: transparent;
		padding: var(--s-1);
	}
	:global(.btn.is-text:hover) {
		background: transparent;
		color: var(--accent);
	}
	:global(.btn:disabled) {
		opacity: 0.45;
		cursor: default;
	}
	/* Text for a screen reader only: a live region, a full name behind a short one. */
	:global(.sr-only) {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	:global(.btn .caret) {
		font-size: var(--t-glyph);
		opacity: 0.7;
	}

	:global(::selection) {
		background: var(--accent-soft);
		color: var(--ink);
	}

	:global(:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(*, *::before, *::after) {
			transition-duration: 0ms !important;
			animation-duration: 0ms !important;
		}
	}

	/* ─── Skip link ─────────────────────────────────────────────────────────── */
	.skip-link {
		position: absolute;
		top: -999px;
		left: 8px;
		z-index: calc(var(--z-modal) + 1);
		background: var(--paper);
		color: var(--ink);
		padding: var(--s-2) var(--s-4);
		border: 1px solid var(--rule-strong);
		border-top: none;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		text-decoration: none;
	}
	.skip-link:focus {
		top: 0;
	}

	/* ─── Shell ──────────────────────────────────────────────────────────────── */
	.app-shell {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		min-height: 100dvh;
		background: var(--paper);
	}

	.app-shell__content {
		flex: 1;
		display: flex;
		flex-direction: column;
		width: 100%;
	}
</style>

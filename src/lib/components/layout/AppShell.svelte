<script lang="ts">
	import { lijstSprong, paneelSprongen } from '$lib/stores/sprong';
	import type { Snippet } from 'svelte';
	import TopBar from './TopBar.svelte';
	import SearchOverlay from './SearchOverlay.svelte';
	import { provideSearchOpener } from '$lib/stores/search-trigger';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { MAP_PARAMS } from '$lib/map/map';

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

	// A map shared as a link (?map=) opens on Gemarkeerd, with the choice to keep it; a link
	// of before (/explore?map=) goes there too.
	$effect(() => {
		const url = page.url;
		if (!url.searchParams.has('map') || url.pathname.startsWith('/gemarkeerd')) return;
		const doel = new URLSearchParams();
		for (const k of MAP_PARAMS) {
			const v = url.searchParams.get(k);
			if (v !== null) doel.set(k, v);
		}
		void goto(`/gemarkeerd?${doel}`, { replaceState: true });
	});
</script>

<div class="app-shell">
	<a href="#main-content" class="skip-link">Naar inhoud</a>
	{#if $lijstSprong}<a href="#{$lijstSprong}" class="skip-link">Naar de lijst</a>{/if}
	{#each $paneelSprongen as s (s.id)}<a href="#{s.id}" class="skip-link">{s.label}</a>{/each}
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

		/* The accent says no: an outcome that says no (--uitkomst-nee), an error, and the § of
		   the name. Nothing else is red (Thijs, 10 Oct: "de kleur mag alleen blijven zolang het
		   een doel dient"): a hover and the focus are ink. */
		--accent: #8c2f28;
		/* The focus ring: ink, 2 px, 2 px off the element, so it stands on paper, on paper-2
		   (14.8:1) and around an ink button with the paper between them. */
		--focus: var(--ink);
		/* Selected text, a passage found, a place landed on: a neutral wash. */
		--wassing: color-mix(in srgb, var(--rule) 45%, var(--paper));

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

		/* The network's own colours. No red: in the network red only says no, and nothing
		   there says no yet (Thijs, 10 Oct: "de kleur mag alleen blijven zolang het een doel
		   dient"). A stuk and its dossier in the dossier's hue, a change to a wet in the wet's,
		   the focus and a chosen verbinding in ink. */
		--netwerk-stuk: var(--groep-dossier);
		--netwerk-dossier: var(--groep-dossier);
		--netwerk-wijziging: var(--groep-wet);
		--netwerk-focus: var(--ink);
		/* A verbinding at rest: its weight (0.6 to 1) times this, in pixels at the default zoom
		   (1.8 to 3 px; dimmed at least 1.4); its arrowhead this many thicknesses long, 0.8 of that
		   wide. Below the bronnen in weight; a hover 1.8 and a choice 2.4 times as thick. */
		--netwerk-lijn: 3;
		--netwerk-pijl: 3.2;

		/* Typography: one text face, one interface face. Identifiers are set in the sans. */
		--font-serif: 'Newsreader', Georgia, serif;
		/* One serif for all text, in 400, 600 and 800; the sans only for controls: buttons,
		   choice rows, fields, keys and menus (Thijs, 10 Oct: "typografie is goed").
		   docs/typografie.md. */
		--font-ui: 'Schibsted Grotesk', system-ui, sans-serif;

		/* Type scale */
		--t-display: 44px;
		--t-h1: 30px; /* page titles, weight 500 */
		--t-h2: 24px;
		--t-h3: 20px;
		--t-body: 17.5px; /* reading text, line-height 1.6 */
		--t-body-2: 16px; /* titles of bronnen in lists and rows */
		--t-meta: 14px; /* a group, meta: one pixel over the sans, for the serif's x-height */
		--t-micro: 13px; /* captions and counts, in --ink-3 */
		--t-ui: 13px; /* a control's text, in the sans */
		--t-ui-micro: 12px; /* a small control's text */
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
		--r-rond: 999px; /* a pill or a dot: a count badge, a chip */

		/* Shadows, almost none */
		--shadow-pop: 0 1px 0 rgba(28, 27, 25, 0.04), 0 8px 24px -12px rgba(28, 27, 25, 0.18);
		--shadow-raise:
			0 1px 0 rgba(28, 27, 25, 0.05), 0 4px 12px -4px rgba(28, 27, 25, 0.12),
			0 16px 32px -16px rgba(28, 27, 25, 0.16);
		--shadow-modal: 0 6px 24px rgba(28, 27, 25, 0.1);
		/* The page behind a modal or a sheet. */
		--scherm: rgba(28, 27, 25, 0.18);

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

		/* The cards over the network (Netwerk, Legenda, a cluster's card): one width, one right
		   edge (Thijs, 10 Oct). */
		--paneel-breed: 280px;
		--paneel-rand: var(--s-3);
	}

	/* ─── Global base ────────────────────────────────────────────────────────── */
	/* A control reads in the sans, unless its own style says otherwise (a link-like button). */
	:global(button, input, select, textarea, kbd) {
		font-family: var(--font-ui);
	}
	:global(html, body) {
		height: 100%;
		margin: 0;
		background: var(--paper);
		color: var(--ink);
		font-family: var(--font-serif);
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
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}

	/* The one frame of a full-width page (docs/bediening.md, Layout; Thijs, 10 Oct 2026): the
	   width, gutters, facet column and grid of Bladeren. A list or overview page is .blad with
	   .blad__indeling (facets left, the rest right); a text page keeps a reading width inside
	   it, on the same left edge (.blad--tekst: each child at most 720 px). The panels of the Verkenner have their own. */
	:global(.blad) {
		box-sizing: border-box;
		width: 100%;
		max-width: 1440px;
		margin: 0 auto;
		padding: var(--s-6) var(--s-6) var(--s-8);
	}
	:global(.blad__indeling) {
		display: grid;
		grid-template-columns: 240px minmax(0, 1fr);
		column-gap: 40px;
		align-items: start;
	}
	:global(.blad--tekst > *) {
		max-width: 720px;
	}
	/* The head of every page in the frame: its title and, at its right, the page's actions.
	   What follows starts one step under it, on every page the same; no page spaces its title
	   or what comes after it itself (Thijs, 10 Oct: "een andere verticale uitlijning na de
	   titel"). */
	:global(.blad__kop) {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		/* Actions that wrap under the title (a phone) stand where the next row would. */
		gap: var(--s-4) var(--s-3);
		margin: 0 0 var(--s-4);
	}
	:global(.blad__indeling > .blad__kop) {
		grid-column: 1 / -1;
	}
	/* A state where content would be: loading, nothing, could not. One quiet line everywhere
	   (round 2 of the consistency pass: italic in the readers, roman on the pages); a row's
	   own line keeps its smaller size. */
	:global(.stil) {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-style: normal;
		line-height: var(--lh-snug);
		color: var(--ink-3);
	}
	:global(.blad__titel) {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 600;
		line-height: var(--lh-snug);
		color: var(--ink);
		overflow-wrap: anywhere;
	}
	/* The parts of a text page (/over, /bronnen, /privacy, /voorwaarden, /docs and its pages):
	   the line over the title, the title, the lede, a section with its heading, a citation,
	   and the line of links or the date at its foot. */
	/* The page a subpage belongs to, as a reader's band names its place (ReaderFrame
	   .kop-rij): one line over the title, its rule under it, the parent a link in ink
	   (Thijs, 10 Oct: "als kruimel, zoals de band van een lezer"). */
	:global(.blad--tekst .stub-eyebrow) {
		margin: 0 0 var(--s-4);
		padding-bottom: var(--s-2);
		border-bottom: 1px solid var(--rule);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	:global(.blad--tekst .stub-eyebrow a) {
		color: var(--ink);
		text-decoration: none;
	}
	:global(.blad--tekst .stub-eyebrow a:hover) {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	:global(.blad--tekst .stub-lede) {
		margin-bottom: var(--s-7);
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink-2);
	}
	:global(.blad--tekst .section) {
		margin-bottom: var(--s-6);
	}
	:global(.blad--tekst .section-title) {
		margin: 0 0 var(--s-3);
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 800;
		color: var(--ink);
	}
	:global(.blad--tekst .cite) {
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
	}
	:global(.blad--tekst .meta-row),
	:global(.blad--tekst .updated) {
		margin-top: var(--s-7);
		padding-top: var(--s-5);
		border-top: 1px solid var(--rule);
	}
	:global(.blad--tekst .meta-row) {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-5);
	}
	:global(.blad--tekst .meta-link) {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
		text-decoration: none;
	}
	:global(.blad--tekst .meta-link:hover) {
		color: var(--ink);
	}
	:global(.blad--tekst .updated) {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* The facet column of such a page, as Bladeren's: it stays in view, scrolls on its own
	   with a quiet bar that keeps clear of the counts, and leaves room for a focus ring. */
	:global(.blad__facetten) {
		position: sticky;
		top: var(--s-6);
		max-height: calc(100vh - var(--s-6));
		overflow-y: auto;
		scrollbar-gutter: stable;
		scrollbar-width: thin;
		scrollbar-color: var(--rule) transparent;
		margin: 0 calc(-1 * var(--s-2));
		padding: var(--s-1) var(--s-2) var(--s-5);
	}
	@media (max-width: 768px) {
		:global(.blad__facetten) {
			position: static;
			max-height: none;
			overflow: visible;
		}
		:global(.blad) {
			padding: var(--s-4) var(--s-4) var(--s-8);
		}
		:global(.blad__indeling) {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	/* The Knop (docs/bediening.md): a 1px rule-strong frame, 3px radius, no fill; ink on hover.
	   `.btn` alone is the panel's (24 px: a panel, a group, a reader's head); `is-groot` the
	   page's (32 px). `is-primary` is ink on paper; `is-text` has no frame. */
	:global(.btn) {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
		box-sizing: border-box;
		height: var(--veld-h-klein);
		padding: 0 var(--s-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: transparent;
		font-family: var(--font-ui);
		font-size: var(--t-ui-micro);
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
	/* A place's quiet words in a reader (a lid, an onderdeel, an overweging): "Citeer",
	   "Bewaar", lightly underlined, no frame (Thijs, 10 Oct). */
	:global(.plaats-woord) {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink-3);
		text-decoration: underline;
		text-decoration-color: var(--rule);
		text-underline-offset: 2px;
		white-space: nowrap;
		cursor: pointer;
	}
	:global(.plaats-woord:hover) {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	:global(.plaats-woord[aria-pressed='true']) {
		color: var(--ink);
	}
	/* A kept place: a thin ink bar in the margin, always there (concept 13-map, 1). The place
	   is its containing block (position: relative). */
	:global(.plaats-bewaard::before) {
		content: '';
		position: absolute;
		left: -10px;
		top: var(--s-2);
		bottom: var(--s-2);
		width: 3px;
		background: var(--ink);
	}
	:global(.btn:hover:not(:disabled)),
	:global(.btn:focus-visible) {
		color: var(--ink);
		border-color: var(--ink);
	}
	:global(.btn.is-groot) {
		height: var(--veld-h);
		padding: 0 var(--s-3);
		gap: var(--s-2);
		background: var(--paper);
		font-size: var(--t-ui);
		color: var(--ink);
	}
	:global(.btn.is-primary) {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}
	:global(.btn.is-primary:hover:not(:disabled)) {
		background: var(--ink-2);
		border-color: var(--ink-2);
		color: var(--paper);
	}
	:global(.btn.is-text) {
		border-color: transparent;
		padding: var(--s-1);
	}
	:global(.btn.is-text:hover:not(:disabled)),
	:global(.btn.is-text:focus-visible) {
		border-color: transparent;
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	:global(.btn:disabled) {
		opacity: 0.45;
		cursor: default;
	}
	/* Verfijnen (N): on a phone the facets of a list page wait behind this one line, opened in
	   place (docs/bediening.md, layer 3); on a wider screen they stand beside the list. */
	:global(.verfijnen-knop) {
		display: none;
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		font-weight: 500;
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 4px;
		cursor: pointer;
	}
	@media (max-width: 767px) {
		:global(.verfijnen-knop) {
			display: inline-block;
		}
	}
	/* A finger's target around a small control or a link in a line of text (UX-toets 10 Oct:
	   "Verfijnen" 55 × 16, the band's "…" 13 × 19, names in a row 13 high): an invisible
	   border of the target, at least 24 px high, that moves nothing. On a touch screen only. */
	@media (pointer: coarse) {
		:global(.verfijnen-knop),
		:global(.raakvlak) {
			position: relative;
		}
		:global(.verfijnen-knop::after),
		:global(.raakvlak::after) {
			content: '';
			position: absolute;
			inset: calc(-1 * var(--s-2)) calc(-1 * var(--s-1));
		}
	}
	/* Text for a screen reader only: a live region, a full name behind a short one. */
	/* Read, not seen, and taking no room: no margin of its own (a <p> had 14 px, which made every
	   reader 827 px high on an 812 px phone, UX-toets 10 Oct, #35). */
	:global(.sr-only) {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: 0;
		padding: 0;
		border: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	:global(.btn .caret) {
		font-size: var(--t-glyph);
		opacity: 0.7;
	}

	:global(::selection) {
		background: var(--wassing);
		color: var(--ink);
	}

	:global(:focus-visible) {
		outline: 2px solid var(--focus);
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
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		text-decoration: none;
	}
	.skip-link:focus {
		top: 0;
	}
	/* Where a list is jumped to, it shows the focus as any target would: no ring of its own. */
	:global([tabindex='-1']:focus:not(:focus-visible)) {
		outline: none;
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

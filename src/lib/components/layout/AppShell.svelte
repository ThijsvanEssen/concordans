<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import TopBar from './TopBar.svelte';
  import SearchOverlay from './SearchOverlay.svelte';
  import { provideSearchOpener } from '$lib/stores/search-trigger';
  import { initAnalytics } from '$lib/analytics';

  let { children }: { children?: Snippet } = $props();

  let searchOpen = $state(false);
  provideSearchOpener(() => { searchOpen = true; });

  onMount(() => { initAnalytics(); });
</script>

<div class="app-shell">
  <a href="#main-content" class="skip-link">Naar inhoud</a>
  <TopBar onSearchOpen={() => (searchOpen = true)} />
  <main id="main-content" tabindex="-1" class="app-shell__content">
    {@render children?.()}
  </main>
</div>

<SearchOverlay open={searchOpen} onClose={() => (searchOpen = false)} />

<style>
  /* ─── Fonts ──────────────────────────────────────────────────────────────── */
  @font-face {
    font-family: "EB Garamond";
    src: url("/fonts/EBGaramond-Variable.woff2") format("woff2-variations");
    font-weight: 400 800;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: "EB Garamond";
    src: url("/fonts/EBGaramond-VariableItalic.woff2") format("woff2-variations");
    font-weight: 400 800;
    font-style: italic;
    font-display: swap;
  }
  @font-face {
    font-family: "IBM Plex Sans";
    src: url("/fonts/IBMPlexSans-400.woff2") format("woff2");
    font-weight: 400; font-style: normal; font-display: swap;
  }
  @font-face {
    font-family: "IBM Plex Sans";
    src: url("/fonts/IBMPlexSans-500.woff2") format("woff2");
    font-weight: 500; font-style: normal; font-display: swap;
  }
  @font-face {
    font-family: "IBM Plex Sans";
    src: url("/fonts/IBMPlexSans-600.woff2") format("woff2");
    font-weight: 600; font-style: normal; font-display: swap;
  }
  @font-face {
    font-family: "iA Writer Mono";
    src: url("/fonts/iAWriterMono-400.woff2") format("woff2");
    font-weight: 400; font-style: normal; font-display: swap;
  }

  /* ─── Design tokens ──────────────────────────────────────────────────────── */
  :global(:root) {
    /* Paper & ink — warm, not neutral */
    --paper:       #FFFDF4;
    --paper-2:     #FEF8EB;
    --paper-3:     #F4ECDD;
    --paper-4:     #EDE8DC;
    --paper-edge:  #E2DBCC;

    --ink:         #1A1814;
    --ink-2:       #3A362E;
    --ink-3:       #6B6558;
    --ink-4:       #9A9485;

    /* ── Accent families — 10 spines × 3 tokens ─────────────────────────────
       Each family: base / -2 (hover) / -faint (tinted surface).
       Hardcoded for Sigma — CSS vars can't reach into WebGL shaders.      */

    /* SPINE — oxblood · selection / focus / "you are here" */
    --spine:       #7A1F1A;
    --spine-2:     #9C2E26;
    --spine-faint: #E8D5D0;

    /* BRICK — terracotta · repealed / withdrawn / no longer in force */
    --brick:       #8A3E22;
    --brick-2:     #AA5232;
    --brick-faint: #ECDAD0;

    /* OCHRE — foxed paper · amended / broken citation · aliased as --warn */
    --ochre:       #8A6A1F;
    --ochre-2:     #A8822E;
    --ochre-faint: #E9DEC4;

    /* OLIVE — aged linen · draft / pending / not yet in force */
    --olive:       #5C5A1F;
    --olive-2:     #74722B;
    --olive-faint: #DDDDC2;

    /* MOSS — verdigris · in force / currently valid · aliased as --positive */
    --moss:        #3D5C3A;
    --moss-2:      #4F7349;
    --moss-faint:  #D6E0CF;

    /* TEAL — oxidised copper · international / EU / supranational */
    --teal:        #1F5A56;
    --teal-2:      #2D7672;
    --teal-faint:  #CFE0DE;

    /* INDIGO — archivist's ink · judgments / rechtspraak */
    --indigo:      #2B3A5C;
    --indigo-2:    #3D4F77;
    --indigo-faint:#D5DCE8;

    /* PLUM — marbled endpaper · commentary / annotation / doctrinal */
    --plum:        #5A2D4A;
    --plum-2:      #74416B;
    --plum-faint:  #E0D2DC;

    /* SLATE — graphite · neutral metadata / generic cross-reference */
    --slate:       #44505E;
    --slate-2:     #586677;
    --slate-faint: #D8DDE3;

    /* SEPIA — old leather · historical / archived / superseded */
    --sepia:       #5C4426;
    --sepia-2:     #785B36;
    --sepia-faint: #E5DACA;

    /* Semantic aliases */
    --warn:        var(--ochre);
    --warn-faint:  var(--ochre-faint);
    --positive:    var(--moss);

    /* Semantic aliases used across components */
    --bg:          var(--paper);
    --bg-2:        var(--paper-2);
    --bg-3:        var(--paper-3);
    --surface:     var(--paper);
    --fg-1:        var(--ink);
    --fg-2:        var(--ink-2);
    --fg-3:        var(--ink-3);
    --fg-4:        var(--ink-4);
    --muted:       var(--ink-3);
    --rule:        var(--paper-edge);
    --rule-strong: #B8B0A0;
    --border:      var(--paper-edge);
    --border-strong: var(--rule-strong);

    --accent:      var(--spine);
    --accent-hover:var(--spine-2);
    --accent-soft: var(--spine-faint);
    --accent-tint: var(--spine-faint);

    /* Legacy citation tokens mapped to spine */
    --citation-fg: var(--spine);
    --citation-bg: var(--spine-faint);

    /* Graph node colours */
    --node-article:    var(--ink);
    --node-judgment:   var(--indigo);
    --node-instrument: var(--ink-3);
    --node-tkstuk:     var(--ink-3);
    --node-other:      var(--ink-4);

    /* Graph edge colours */
    --edge-strict:   var(--spine);
    --edge-semantic: var(--spine);

    /* Error */
    --error-fg:    var(--spine);
    --error-bg:    var(--spine-faint);
    --error-border: color-mix(in srgb, var(--spine) 40%, transparent);

    /* Semantic aliases */
    --ink-secondary:   var(--ink-3);
    --citation-border: color-mix(in srgb, var(--spine) 30%, transparent);

    /* Typography */
    --font-serif: "EB Garamond", "Iowan Old Style", Georgia, serif;
    --font-sans:  "IBM Plex Sans", -apple-system, "Segoe UI", system-ui, sans-serif;
    --font-mono:  "iA Writer Mono", "iA Writer Duospace", "SF Mono", Menlo, monospace;

    /* Type scale — Garamond runs small; body bumps to 19px */
    --t-display: 52px;
    --t-h1:      36px;
    --t-h2:      26px;
    --t-h3:      21px;
    --t-body:    19px;
    --t-body-2:  17px;
    --t-meta:    13px;
    --t-micro:   11px;

    /* Legacy scale aliases */
    --text-xs:   var(--t-micro);
    --text-sm:   var(--t-meta);
    --text-base: var(--t-body-2);
    --text-lg:   var(--t-h3);
    --text-xl:   22px;
    --text-2xl:  var(--t-h2);
    --text-3xl:  30px;
    --text-4xl:  40px;
    --text-5xl:  52px;

    /* Line heights */
    --lh-tight: 1.15;
    --lh-snug:  1.35;
    --lh-body:  1.55;
    --lh-loose: 1.7;
    --leading-tight: var(--lh-tight);
    --leading-snug:  var(--lh-snug);
    --leading-body:  var(--lh-body);

    /* Tracking */
    --track-meta: 0.04em;
    --track-caps: 0.08em;

    /* Spacing — 4px grid */
    --s-1:  4px;
    --s-2:  8px;
    --s-3:  12px;
    --s-4:  16px;
    --s-5:  24px;
    --s-6:  32px;
    --s-7:  48px;
    --s-8:  64px;
    --space-0: var(--s-1);
    --space-1: var(--s-2);
    --space-2: var(--s-4);
    --space-3: var(--s-6);
    --space-4: var(--s-7);
    --space-5: 80px;
    --space-6: 96px;

    /* Layout */
    --measure: 66ch;
    --gutter:  var(--s-7);

    /* Radii — rectilinear. Almost flat. */
    --r-0: 0px;
    --r-1: 2px;   /* buttons, chips, inputs */
    --r-2: 4px;   /* menus, popovers */
    --r-3: 8px;   /* cards, tiles */
    --radius-sm:   var(--r-1);
    --radius-md:   var(--r-2);
    --radius-card: var(--r-3);
    --radius-pill: 999px;

    /* Borders */
    --border-hair:   1px solid var(--rule);
    --border-strong-line: 1px solid var(--rule-strong);

    /* Shadows — almost none */
    --shadow-pop:
      0 1px 0 rgba(26,24,20,0.04),
      0 8px 24px -12px rgba(26,24,20,0.18);
    --shadow-raise:
      0 1px 0 rgba(26,24,20,0.05),
      0 4px 12px -4px rgba(26,24,20,0.12),
      0 16px 32px -16px rgba(26,24,20,0.16);
    --shadow-modal:
      0 1px 0 rgba(26,24,20,0.04),
      0 24px 48px -16px rgba(26,24,20,0.25);
    --shadow-sm:   var(--shadow-pop);
    --shadow-md:   var(--shadow-raise);
    --shadow-float: var(--shadow-pop);

    /* Motion — slow and certain */
    --ease:    cubic-bezier(0.2, 0.6, 0.2, 1);
    --ease-in: cubic-bezier(0.4, 0, 0.6, 0.2);
    --dur-1:   120ms;
    --dur-2:   220ms;
    --dur-3:   400ms;

    /* Z-index */
    --z-base:   0;
    --z-raised: 10;
    --z-topbar: 20;
    --z-panel:  30;
    --z-float:  40;
    --z-modal:  50;
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
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  :global(*, *::before, *::after) { box-sizing: border-box; }

  :global(#svelte) { min-height: 100vh; }

  /* Links — underline always present; turns spine on hover */
  :global(a) {
    color: inherit;
    text-decoration: none;
    border-bottom: 1px solid var(--rule-strong);
    transition:
      border-color var(--dur-1) var(--ease),
      color var(--dur-1) var(--ease);
  }
  :global(a:hover) {
    border-bottom-color: var(--accent);
    color: var(--accent);
    text-decoration: none;
  }
  /* Utility class for links that should never have underline (nav, logo) */
  :global(a.no-underline),
  :global(a.no-underline:hover) {
    border-bottom: none;
  }

  :global(::selection) {
    background: var(--accent-tint);
    color: var(--ink);
  }

  :global(:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(*, *::before, *::after) { transition-duration: 0ms !important; animation-duration: 0ms !important; }
  }

  /* ─── Skip link ─────────────────────────────────────────────────────────── */
  .skip-link {
    position: absolute;
    top: -999px;
    left: 8px;
    z-index: calc(var(--z-modal) + 1);
    background: var(--paper);
    color: var(--ink);
    padding: 8px 16px;
    border: 1px solid var(--rule-strong);
    border-top: none;
    font-family: var(--font-sans);
    font-size: var(--t-meta);
    text-decoration: none;
  }
  .skip-link:focus { top: 0; }

  /* ─── Shell ──────────────────────────────────────────────────────────────── */
  .app-shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--paper);
  }

  .app-shell__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
  }
</style>

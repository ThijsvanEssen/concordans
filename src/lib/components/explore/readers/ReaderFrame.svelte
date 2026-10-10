<script lang="ts">
	// The one frame of every reader: the scroll container, the margins, the width of the
	// column and the load, empty and error states. A reader never sets its own padding,
	// width or scroll; the column it stands in sets them for all readers alike, through
	// --reader-pad-top, --reader-pad-left, --reader-pad-right and --reader-max
	// (explore/+page.svelte). So the text keeps its place and width whatever opens
	// beside it, and the scrollbar keeps its gutter whether or not the text scrolls.
	import { getContext, type Snippet } from 'svelte';
	import type { GraphNode } from '$lib/graph/types';
	import BehoortBij from '$lib/bron/BehoortBij.svelte';
	import { BEHOORT_KEY } from '$lib/bron/behoort';
	import WeergaveSchakelaar from '../WeergaveSchakelaar.svelte';
	import { WEERGAVE_KEY, type Weergave } from '../weergave';

	let {
		status = 'ready',
		message = '',
		onRetry,
		children
	}: {
		status?: 'empty' | 'loading' | 'error' | 'ready';
		message?: string;
		/** Load again after an error: the API may have been out of reach for a moment. */
		onRetry?: () => void;
		children?: Snippet;
	} = $props();

	// Where the bron stands, above its text and before it loads (docs/hierarchie.md).
	const bron = getContext<(() => GraphNode) | undefined>(BEHOORT_KEY);

	// Netwerk / Tekst, top right beside the band: only for the bron the band is for, not
	// for a document opened beside it.
	const weergave = getContext<(() => Weergave | null) | undefined>(WEERGAVE_KEY);
	const w = $derived(bron ? (weergave?.() ?? null) : null);
</script>

<div class="reader-frame">
	<div class="reader-frame__col">
		<!-- The band and Netwerk/Tekst on one row, one rule under both over the full width
		     (Thijs, 10 Oct: the rule stopped short of the toggle). -->
		{#if (w || bron) && status !== 'empty'}
			<div class="kop-rij">
				{#if bron}<div class="kop-rij__band"><BehoortBij node={bron()} /></div>{/if}
				{#if w}
					<div class="weergave">
						<WeergaveSchakelaar stand={w.stand} onKies={w.onKies} tekstMogelijk={w.tekstMogelijk} />
					</div>
				{/if}
			</div>
		{/if}
		{#if status === 'empty'}
			<!-- No bron yet: an empty column, no instruction (the UI shows itself, Thijs 9 Oct). -->
		{:else if status === 'loading'}
			<div class="reader-loading">
				<div class="skeleton-h"></div>
				<div class="skeleton-body"></div>
				<div class="skeleton-body skeleton-body--short"></div>
			</div>
		{:else if status === 'error'}
			<div class="reader-error" role="alert">
				<p>{message || 'De bron kon niet worden geladen.'}</p>
				{#if onRetry}
					<button type="button" class="btn is-text" onclick={onRetry}>Opnieuw</button>
				{/if}
			</div>
		{:else}
			{@render children?.()}
		{/if}
	</div>
</div>

<style>
	/* The title and the kind above it in every reader: one form (they stood eight and four
	   times); a reader adds only what differs (an h1, its layout for glyphs and commas). */
	:global(.lezer-titel) {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		font-weight: 600;
		line-height: var(--lh-snug);
		color: var(--ink);
		overflow-wrap: anywhere;
	}
	:global(.lezer-soort) {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.reader-frame {
		height: 100%;
		overflow-y: auto;
		scrollbar-gutter: stable;
		padding: var(--reader-pad-top, var(--s-6)) var(--reader-pad-right, var(--s-6)) var(--s-8)
			var(--reader-pad-left, var(--s-6));
		box-sizing: border-box;
	}
	/* On a phone every reader has the width, 16 px from the edges. */
	@media (max-width: 768px) {
		.reader-frame {
			/* Set here, not only used: what reads them inside (a sticky bar) agrees. */
			--reader-pad-top: var(--s-5);
			--reader-pad-left: var(--s-4);
			--reader-pad-right: var(--s-4);
		}
		/* On a phone a term takes only the room it needs; a number stands inside the text
		   column (no margin to hang in). */
		.reader-frame .reader-frame__col {
			--reader-term: 0px;
		}
	}
	/* Left in Lezen, beside the table of contents; centred where the column says so. */
	/* One design language for every reader (Thijs, 9 Oct: "strak trekken", "een design taal",
	   "de ruimte goed benut"): the title, the meta line, a heading and all running text start
	   at the column's edge; a number (rechtsoverweging, lid) hangs in the frame's margin
	   (`.hangt`, desktop only); a term and what it names (Behoort bij, partijen, Voor and
	   Tegen, a career) share one term column (`--reader-term`), wide enough for the longest
	   term at rung 6 ("Bij wetsvoorstel"). One right edge: the column's. */
	.reader-frame__col {
		--reader-term: calc(var(--s-8) + var(--s-6));
		max-width: var(--reader-max, 760px);
		min-height: 100%;
		margin-left: var(--reader-col-left, 0);
		margin-right: auto;
	}

	/* The switch floats at the column's right edge: the band beside it takes the rest of
	   the width (its own block formatting context, so its rule stops short of the switch),
	   and without a band the title wraps around it. No row of its own. */
	.kop-rij {
		display: flex;
		align-items: flex-start;
		gap: var(--s-4);
		margin: 0 0 var(--s-4);
		padding-bottom: var(--s-2);
		border-bottom: 1px solid var(--rule);
	}
	.kop-rij__band {
		flex: 1;
		min-width: 0;
	}
	/* The rule is the row's; the band keeps none of its own. */
	.kop-rij__band :global(.behoort) {
		margin: 0;
		padding: 0;
		border: 0;
	}
	.weergave {
		flex: none;
		margin-left: auto;
	}
	/* On a phone the tabs (Tekst, Netwerk, Verbonden) are the one control. */
	@media (max-width: 768px) {
		.weergave {
			display: none;
		}
	}

	/* Where the text would begin: the frame's own margins, no more. */
	.reader-error {
		padding: var(--s-5) 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}

	.reader-loading {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		padding: var(--s-5) 0;
	}

	.skeleton-h,
	.skeleton-body {
		border-radius: var(--r-1);
		background: linear-gradient(90deg, var(--paper-2) 25%, var(--rule) 50%, var(--paper-2) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.4s infinite;
	}

	.skeleton-h {
		height: 32px;
		width: 60%;
	}

	.skeleton-body {
		height: 14px;
	}

	.skeleton-body--short {
		width: 70%;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}
</style>

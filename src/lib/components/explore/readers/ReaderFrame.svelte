<script lang="ts" generics="T">
	// The one frame of every reader: the scroll container, the margins, the width of the
	// column and the load and error states (LoadState). A reader hands it what it loads,
	// what that is ("Kabinet") and how to ask again; the frame draws the skeleton or the
	// failure, and the reader's own body once the data is there. A head from the light
	// node (`head`) stands above all three, a part that loads on its own (`foot`) below. A reader never sets its own padding, width or
	// scroll; the column it stands in sets them for all readers alike, through
	// --reader-pad-top, --reader-pad-left, --reader-pad-right and --reader-max
	// (explore/+page.svelte). So the text keeps its place and width whatever opens
	// beside it, and the scrollbar keeps its gutter whether or not the text scrolls.
	import { getContext, setContext, untrack, type Snippet } from 'svelte';
	import type { GraphNode } from '$lib/graph/types';
	import BehoortBij from '$lib/bron/BehoortBij.svelte';
	import { BEHOORT_KEY, bandAlways } from '$lib/bron/behoort';
	import {
		FramePending,
		SearchState,
		FIND_KEY,
		WAIT_KEY,
		type FindInText,
		type FrameWait
	} from '../search-state.svelte';
	import { BandState } from './band-state.svelte';
	import { consultedOn } from '$lib/text/datum';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import type { LoadState as State } from '$lib/util/load.svelte';
	import { afterTick } from '$lib/util/after-tick';
	import { readerReady } from '$lib/first-paint/takeover';

	let {
		state = { status: 'ready', data: undefined as T },
		what = 'De bron',
		retry,
		head,
		find = false,
		loading,
		foot,
		pending: ownPending = false,
		children: body
	}: {
		/** What the reader loads; without it the body stands at once. */
		state?: State<T>;
		/** What fails, as the subject of the sentence: "Artikel", "Uitspraak". */
		what?: string;
		/** Load again after an error: the API may have been out of reach for a moment. */
		retry?: () => void;
		/** A long text: "Zoek in dit stuk" stands in the head's row of actions (ReaderHead) and
		 * marks hits in the text. */
		find?: boolean;
		/** What stands before the load is in (the head from the light node), in every state. */
		head?: Snippet;
		/** In place of the skeleton: the reader's own rows, with their labels, while it loads. */
		loading?: Snippet;
		/** A part of the text still coming after the frame's own load (a dossier's procedure). */
		pending?: boolean;
		/** What stands after the body in every state (a part with a load of its own). */
		foot?: Snippet;
		children?: Snippet<[T]>;
	} = $props();

	/** Where the text was read and when, for paper (print.css): set in the browser, hidden on screen. */
	function readAt(node: HTMLElement) {
		const { origin, pathname, search } = window.location;
		node.textContent = `${origin}${pathname}${search}, geraadpleegd ${consultedOn()}`;
	}

	// Where the bron stands, above its text and before it loads (docs/hierarchie.md).
	const bron = getContext<(() => GraphNode) | undefined>(BEHOORT_KEY);

	// Whether the band has lines, told once its light node is in: until then a kind that always
	// has a band holds its place; a row with nothing in it (no band, no controls) is not drawn
	// at all, no bare rule over the title.
	const band = new BandState();
	const bandHeld = $derived(bron ? bandAlways(bron().collection) && band.has !== false : false);
	const rowShown = $derived(band.has === true || bandHeld);
	// The band comes with the light node, the cheapest call, and may take two lines (an
	// activiteit: its commissie and its dossiers): the column waits for it, unseen, so the title
	// under it does not move down (R3-L F2). An article stands from its first paint, which has
	// its band; the wait is a second at most.
	$effect(() => {
		const id = bron?.().id ?? null;
		const t = setTimeout(() => {
			band.waited = id;
		}, 1000);
		return () => clearTimeout(t);
	});
	const bandWait = $derived(
		!!bron &&
			bron().collection !== 'articles' &&
			bandAlways(bron().collection) &&
			band.has === null &&
			band.waited !== bron().id
	);

	// The head of the reader draws the button and the field (ReaderHead): the actions of the
	// stuk stand together, not one above the band and the others under the title (A190).
	const search = new SearchState();
	// A part of the text that comes after the frame's own load holds data-klaar back.
	const pending = new FramePending();
	// Untracked: a reader registers in an effect, which must not depend on the list it changes.
	setContext<FrameWait>(WAIT_KEY, (part) => {
		untrack(() => pending.parts.push(part));
		return () =>
			untrack(() => {
				pending.parts = pending.parts.filter((p) => p !== part);
			});
	});
	const done = $derived(state.status === 'ready' && !ownPending && !pending.any);
	setContext<FindInText>(FIND_KEY, {
		get find() {
			return find;
		},
		search
	});

	// The text is here: the first paint of the address gives the column to the reader once
	// it stands in its place (lib/first-paint/takeover.ts).
	$effect(() => {
		if (state.status === 'ready') afterTick(readerReady);
	});
</script>

<!-- data-klaar: the text is here; under it on a narrow screen Verbonden may come (explore). -->
<div class="reader-frame" data-klaar={done || undefined}>
	<div class="reader-frame__col" data-wacht={bandWait || undefined} bind:this={search.column}>
		<!-- The band on a row of its own, its rule over the full width. The network is a werkplek
		     of its own, never beside the text (besluit 39). -->
		{#if bron}
			<div class="kop-rij" hidden={!rowShown}>
				{#if bron}<div
						class="kop-rij__band"
						class:kop-rij__band--held={bandHeld}
						hidden={band.has === false}
					>
						<BehoortBij
							node={bron()}
							onHas={(h) => {
								band.has = h;
							}}
						/>
					</div>{/if}
			</div>
		{/if}
		{@render head?.()}
		{#if state.status === 'loading' && loading}
			{@render loading()}
		{:else}
			<LoadState {state} {what} {retry} form="block">
				{#snippet children(data)}{@render body?.(data)}{/snippet}
			</LoadState>
		{/if}
		{@render foot?.()}
		<!-- On paper only (lib/styles/print.css): where the text was read and when. -->
		<p class="papier-bron" use:readAt></p>
	</div>
</div>

<style>
	.papier-bron {
		display: none;
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
	.reader-frame__col[data-wacht] {
		visibility: hidden;
	}
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
	/* One line of the band from the start: it comes with the light node, after the text
	   (where there is no Netwerk/Tekst to hold the row, on a phone). */
	.kop-rij__band {
		flex: 1;
		min-width: 0;
	}
	.kop-rij__band--held {
		min-height: calc(var(--t-meta) * var(--lh-snug));
	}
	.kop-rij[hidden],
	.kop-rij__band[hidden] {
		display: none;
	}
	/* The rule is the row's; the band keeps none of its own. */
	.kop-rij__band :global(.behoort) {
		margin: 0;
		padding: 0;
		border: 0;
	}
	/* On a phone the controls stand under the band, not squeezed beside it. */
	@media (max-width: 768px) {
		.kop-rij {
			flex-wrap: wrap;
			/* Room for a finger's 44 px around the band's links and the controls below. */
			row-gap: var(--s-6);
		}
		.kop-rij__band {
			flex-basis: 100%;
		}
	}
</style>

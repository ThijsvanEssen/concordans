<script lang="ts">
	import { bewaarItem } from '$lib/map/map';
	import { blockClick, terPlekke } from '$lib/actions/klik';
	// One row of the index. A click anywhere in the row, the title too, opens its detail
	// beneath it; the bron itself opens from the buttons there. The title stays a link, so
	// cmd-click and a middle click open the bron in a new tab and it can be copied. The
	// toggle is a button under the row's content, the size of the row: it is what the
	// keyboard stops on.
	//
	// With `acties` (Bladeren): no detail beneath. The title opens the bron in Netwerk (a
	// Kamerstuk on its text, openHref) and a click on the row does the same; the other view
	// is one step from there (docs/bediening.md, Thijs
	// 10 Oct: a row has no buttons of its own, a click on the row does it).
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import RijActies from '$lib/components/ui/RijActies.svelte';
	import { parseNodeId } from '$lib/vocabulary';

	let {
		title,
		href,
		open = false,
		onToggle,
		acties = false,
		bron,
		member = false,
		emphasis = false,
		lead,
		body,
		aside,
		detail,
		bewaar = true,
		dossier = null,
		wet = null,
		cite = null
	}: {
		title: string;
		/** Without a link the title is text, and the whole row is the toggle. */
		href?: string;
		open?: boolean;
		onToggle?: () => void;
		/** The ways on at the end of the row instead of a detail beneath it; `titel` where the
		 *  title is the one way on (a kabinet, read only in the network). */
		acties?: boolean | 'titel';
		/** What the row stands for (`judgments/<key>`), to find it again in the list. */
		bron?: string;
		/** A dossier under its number, indented beneath it. */
		member?: boolean;
		/** What matters in a list of events (a bill, a close vote): its title larger. */
		emphasis?: boolean;
		lead?: Snippet;
		/** Under the title. */
		body?: Snippet;
		aside?: Snippet;
		/** What opens beneath the row: the bron's content. A row with nothing to open passes no
		 *  `onToggle`, and a click on it goes to the bron (Thijs, 10 Oct). */
		detail?: Snippet;
		/** Bewaar on the row (RijActies, as in Verbonden); not where the list is the map itself. */
		bewaar?: boolean;
		/** The dossier the row's Kamerstuk or vote is in, for its group in a map. */
		dossier?: string | null;
		/** The law the row stands for (BWB id or CELEX), for its group in a map. */
		wet?: string | null;
		/** How the map cites the bron, where its reader cites it otherwise than by the title: a
		 *  vote as a vote, not as what was voted on. */
		cite?: { kort: string; voluit: string } | null;
	} = $props();

	const uid = $props.id();

	// Without a toggle the row has nothing to open: a click on it goes to the bron.
	const direct = $derived((acties || !onToggle) && !!href);

	// The row's Bewaar: the bron it stands for, by its title, in its group (map.ts).
	const item = $derived.by(() => {
		const doel = bron ? parseNodeId(bron) : null;
		return bewaar && bron && doel
			? bewaarItem(bron, cite ?? { kort: title, voluit: title }, { dossier, wet })
			: null;
	});

	const onRowClick = () => (direct ? goto(href!) : onToggle?.());

	/** A plain click on the title opens the row; with a modifier it is the link's. With
	 *  `acties` the title is a plain link: it opens the bron. */
	const onTitleClick = (e: MouseEvent) => {
		if (direct) return;
		terPlekke(e, () => onToggle?.());
	};
</script>

<li class="row-wrap" class:row-wrap--member={member} data-bron={bron}>
	<!-- The button below is the keyboard's way in; this only widens its target. -->
	<div
		class="row"
		class:row--on={open}
		class:row--emphasis={emphasis}
		data-rij
		use:blockClick={onRowClick}
	>
		{#if !direct}
			<button
				type="button"
				class="row-toggle"
				aria-expanded={open}
				aria-controls={open && detail ? `${uid}-detail` : undefined}
				aria-label="Details van {title}"
				onclick={onToggle}
			></button>
		{/if}
		<div class="row-id">{@render lead?.()}</div>
		<div class="row-body">
			{#if href}
				<a class="row-title" {href} data-sveltekit-noscroll onclick={onTitleClick}>{title}</a>
			{:else}
				<span class="row-title">{title}</span>
			{/if}
			{@render body?.()}
		</div>
		<div class="row-aside">
			{@render aside?.()}{#if item}<RijActies naam={title} {item} />{/if}
		</div>
	</div>
	{#if open && detail && !acties}
		<div class="detail" id="{uid}-detail">{@render detail()}</div>
	{/if}
</li>

<style>
	/* The links in a row's lines (indieners, a dossier) a finger can hit: the shared target of
	   lib/styles/basis.css (.raakvlak), on a touch screen only. */
	@media (pointer: coarse) {
		.row-body :global(a:not(.row-title)) {
			position: relative;
		}
		.row-body :global(a:not(.row-title)::after) {
			content: '';
			position: absolute;
			inset: calc(-1 * var(--s-2)) calc(-1 * var(--s-1));
		}
	}

	.row-wrap {
		display: flex;
		flex-direction: column;
	}
	/* A row of a table: a hairline under each, the columns as the list sets them
	   (--row-lead, --row-aside), so the heads above the list stand over them. */
	.row {
		position: relative;
		display: grid;
		grid-template-columns: var(--row-lead) minmax(0, 1fr) var(--row-aside);
		gap: var(--s-5);
		padding: var(--s-3) var(--s-2);
		border-bottom: 1px solid var(--rule);
		cursor: pointer;
		align-items: baseline;
		transition: background var(--dur-1) var(--ease);
	}
	.row:hover,
	.row--on {
		background: var(--paper-2);
	}
	.row-toggle {
		position: absolute;
		inset: 0;
		padding: 0;
		border: 0;
		border-radius: inherit;
		background: transparent;
		cursor: pointer;
	}
	.row-toggle:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: -2px;
	}
	/* The content lies over the toggle; a click on it is passed on by the row. */
	.row-id,
	.row-body,
	.row-aside {
		position: relative;
	}

	/* No tabular figures: the column holds words too, and they would give a comma or a
	   full stop the width of a figure ("Wetsvoorstel , aangenomen"). */
	.row-id {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		line-height: 1.4;
		padding-top: 3px;
	}
	.row-body {
		min-width: 0;
	}
	.row-title {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
		line-height: var(--lh-snug);
		text-decoration: none;
		text-wrap: pretty;
		transition: color var(--dur-1) var(--ease);
		/* Two lines at most; the full title is in the inline detail. */
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}
	.row--emphasis .row-title {
		font-size: var(--t-body);
		font-weight: 600;
		line-height: 1.3;
	}
	a.row-title:hover {
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.row--on .row-title {
		color: var(--ink);
	}
	.row-aside {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--s-2);
		text-align: right;
		flex-wrap: wrap;
		padding-top: 2px;
	}

	/* Inline detail */
	.detail {
		background: var(--paper-2);
		border-bottom: 1px solid var(--rule);
		padding: 0 var(--s-2) 0 calc(var(--row-lead) + var(--s-5) + var(--s-2));
	}

	/* Dossiers under one number: the rows of the opened number stand indented beneath it. */
	.row-wrap--member .row {
		padding-left: var(--s-5);
	}
	.row-wrap--member .row-id :global(.row-id-main)::before {
		content: '↳ ';
		color: var(--rule-strong);
	}

	/* Narrow viewports: the columns stack. */
	@media (max-width: 768px) {
		.row {
			grid-template-columns: 1fr;
			gap: var(--s-1);
			padding: var(--s-3) var(--s-2);
		}
		.row-aside {
			justify-content: flex-start;
			padding-top: var(--s-2);
		}
		.detail {
			padding-left: 0;
		}
	}
</style>

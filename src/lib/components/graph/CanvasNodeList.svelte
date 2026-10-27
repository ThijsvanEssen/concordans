<script lang="ts">
	// The bronnen on the canvas for the keyboard: one tab stop, ↑ and ↓ to step through
	// them (Home, End), each a link. The bron in focus lights up on the canvas and nothing
	// more (WCAG 3.2.1, R9): Enter chooses it as a click does, its card open and the address
	// marking it; Enter again reads it. N adds it to the netwerk or takes it out. The
	// canvas itself draws; this list is how it is reached without one.
	import type { GraphNode } from '$lib/graph/types';
	import { bronHref } from '$lib/bron/href';
	import { refOf } from '$lib/bron/ref';
	import { isCollection } from '$lib/vocabulary';
	import { bronKind } from '$lib/components/graph/bron-kind';
	import { moveIndex } from './canvas-keys';
	import { isEscape } from '$lib/actions/keys';
	import { articleTitle } from '$lib/text/citation-record';
	import { bronNaam, stemmingNaam } from '$lib/bron/naam';
	import { instrumentMetaStore } from '$lib/api/instrument-cache';
	import { isClusterId } from '$lib/selection/cluster';
	import { untrack } from 'svelte';
	import { distinctNames } from './canvas-names';

	let {
		nodes,
		isChosen,
		onFocusNode,
		onKies,
		aangewezen = null,
		onToggleChosen,
		onOpenCluster,
		onTab,
		onEscape,
		houdt
	}: {
		/** In reading order: the selected bron first. */
		nodes: GraphNode[];
		isChosen: (id: string) => boolean;
		/** The bron in focus, or null when the focus leaves the list. */
		onFocusNode: (node: GraphNode | null) => void;
		/** Enter (or a click) on a bron: chosen as a click on the canvas chooses it. */
		onKies?: (node: GraphNode) => void;
		/** The bron the arrows point at on the canvas: its link holds the tab stop, its line is read. */
		aangewezen?: GraphNode | null;
		onToggleChosen?: (node: GraphNode) => void;
		/** A cluster bron ("250 uitspraken"): Enter opens its card, as a click does. */
		onOpenCluster?: (node: GraphNode, opener: HTMLElement) => void;
		/** Tab from a bron: true where the focus went into its card. */
		onTab?: (opener: HTMLElement) => boolean;
		/** Escape on a bron: true where it closed the bron's card (the focus stays on the bron). */
		onEscape?: () => boolean;
		/** An element the focus may go to and the bron keep its card (the card itself). */
		houdt?: (el: Node | null) => boolean;
	} = $props();

	let active = $state(0);
	let list = $state<HTMLUListElement | null>(null);
	let said = $state('');

	// Another bron at the head of the list (a step to another page): its line is the old page's.
	let eerste: string | undefined;
	$effect(() => {
		const id = nodes[0]?.id;
		if (id !== eerste) said = '';
		eerste = id;
	});
	// The list changes as the canvas does: the tab stop stays on a bron that exists.
	$effect(() => {
		if (active > nodes.length - 1) active = Math.max(0, nodes.length - 1);
	});

	const kindOf = (n: GraphNode) =>
		isClusterId(n.id)
			? 'groep'
			: isCollection(n.collection)
				? bronKind(n.collection, n.raw?.props)
				: '';
	/**
	 * The full name, where the canvas shows a short one (`2011-07, Memorie`): the name the
	 * chips and Verbonden give (bronNaam: "Hoge Raad, 20 december 2019", an article with its
	 * law, UX test 10 Oct, #23); a BW article as cited (Artikel 6:162 BW); a vote as the
	 * dossier's text names it.
	 */
	const fullName = (n: GraphNode) =>
		isClusterId(n.id)
			? n.label
			: n.collection === 'decisions'
				? stemmingNaam(n)
				: n.collection === 'articles' && n.raw?.props?.instrument_abbreviation
					? articleTitle(n.raw?.display_name ?? n.label, n.raw.props)
					: bronNaam(n, $instrumentMetaStore);
	/** Each its own name: eight judgments of one court on one day by their ECLI (UX review N4). */
	const names = $derived(distinctNames(nodes, fullName));
	const nameOf = (n: GraphNode) => {
		const naam = names.get(n.id) ?? fullName(n);
		return n.collection === 'articles' && n.raw?.props?.repealed === true
			? `${naam}, vervallen`
			: naam;
	};

	// The arrows on the canvas move the bron pointed at: the list follows (its tab stop) and
	// the one line reads its name and kind.
	$effect(() => {
		const n = aangewezen;
		const i = n ? nodes.findIndex((x) => x.id === n.id) : -1;
		untrack(() => {
			if (!n) return;
			if (i >= 0) active = i;
			said = `${nameOf(n)}, ${kindOf(n)}`;
		});
	});

	function focusAt(i: number) {
		active = i;
		list?.querySelectorAll<HTMLElement>('a')[i]?.focus();
	}

	function onfocusin(e: FocusEvent) {
		const i = Number((e.target as HTMLElement).dataset.index);
		const n = nodes[i];
		if (!n) return;
		active = i;
		onFocusNode(n);
		said = `${nameOf(n)}, ${kindOf(n)}${isChosen(n.id) ? ', in het netwerk' : ''}. ${i + 1} van ${nodes.length}.`;
	}

	function onfocusout(e: FocusEvent) {
		const naar = e.relatedTarget as Node | null;
		// Focus that goes nowhere is a tap, not Tab: on an iPhone a tapped button takes no
		// focus, and closing here took the card away before the tap's click ("Omgeving tonen").
		// A tap or click elsewhere closes it (GraphView).
		if (!naar || list?.contains(naar)) return;
		// Its line goes with the focus, so it is not read on the next page (UX test 0.79.43, #13).
		said = '';
		if (!houdt?.(naar)) onFocusNode(null);
	}

	function onkeydown(e: KeyboardEvent) {
		if (isEscape(e) && onEscape?.()) {
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		if (e.key === 'Tab' && !e.shiftKey && onTab?.(e.currentTarget as HTMLElement)) {
			e.preventDefault();
			return;
		}
		const next = moveIndex(e.key, active, nodes.length);
		if (next !== null) {
			e.preventDefault();
			focusAt(next);
			return;
		}
		const n = nodes[active];
		if (
			n &&
			!isClusterId(n.id) &&
			onToggleChosen &&
			(e.key === 'n' || e.key === 'N') &&
			!e.metaKey &&
			!e.ctrlKey
		) {
			e.preventDefault();
			const was = isChosen(n.id);
			onToggleChosen(n);
			said = was
				? `${nameOf(n)} uit het netwerk gehaald.`
				: `${nameOf(n)} toegevoegd aan het netwerk.`;
		}
	}
</script>

{#if nodes.length > 0}
	<ul
		class="sr-only nodes canvas-node-list"
		bind:this={list}
		aria-label="Bronnen in het netwerk, {nodes.length}. Pijl omhoog en omlaag: volgende bron. Enter: kiezen.{onToggleChosen
			? ' N: toevoegen aan of weghalen uit het netwerk.'
			: ''}"
		{onfocusin}
		{onfocusout}
	>
		{#each nodes as n, i (n.id)}
			<li>
				<a
					href={isClusterId(n.id) ? '#' : bronHref(refOf(n.collection, n.key, n.raw?.props))}
					aria-haspopup={isClusterId(n.id) ? 'dialog' : undefined}
					aria-current={aangewezen?.id === n.id ? 'true' : undefined}
					onclick={(e) => {
						if (!isClusterId(n.id) && !onKies) return;
						e.preventDefault();
						if (isClusterId(n.id)) onOpenCluster?.(n, e.currentTarget);
						else onKies?.(n);
					}}
					data-sveltekit-noscroll
					data-index={i}
					tabindex={i === active ? 0 : -1}
					{onkeydown}>{nameOf(n)}, {kindOf(n)}</a
				>
			</li>
		{/each}
	</ul>
	<p class="sr-only" aria-live="polite">{said}</p>
{/if}

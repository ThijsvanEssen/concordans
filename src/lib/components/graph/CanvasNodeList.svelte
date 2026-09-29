<script lang="ts">
	// The bronnen on the canvas for the keyboard: one tab stop, ↑ and ↓ to step through
	// them (Home, End), each a link (Enter opens it). The bron in focus lights up on the
	// canvas and gets the same card as under the pointer; N adds it to the netwerk or
	// takes it out. The canvas itself draws; this list is how it is reached without one.
	import type { GraphNode } from '$lib/graph/types';
	import { bronHref, refOf } from '$lib/bron/href';
	import { bronLabel, isCollection } from '$lib/vocabulary';
	import { moveIndex } from './canvas-keys';

	let {
		nodes,
		isChosen,
		onFocusNode,
		onToggleChosen
	}: {
		/** In reading order: the selected bron first. */
		nodes: GraphNode[];
		isChosen: (id: string) => boolean;
		/** The bron in focus, or null when the focus leaves the list. */
		onFocusNode: (node: GraphNode | null) => void;
		onToggleChosen?: (node: GraphNode) => void;
	} = $props();

	let active = $state(0);
	let list = $state<HTMLUListElement | null>(null);
	let said = $state('');

	// The list changes as the canvas does: the tab stop stays on a bron that exists.
	$effect(() => {
		if (active > nodes.length - 1) active = Math.max(0, nodes.length - 1);
	});

	const kindOf = (n: GraphNode) => (isCollection(n.collection) ? bronLabel(n.collection) : '');
	/** The full name, where the canvas shows a short one (`2011-07 · Memorie`). */
	const nameOf = (n: GraphNode) => n.raw?.display_name ?? n.label;

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
		if (!list?.contains(e.relatedTarget as Node | null)) onFocusNode(null);
	}

	function onkeydown(e: KeyboardEvent) {
		const next = moveIndex(e.key, active, nodes.length);
		if (next !== null) {
			e.preventDefault();
			focusAt(next);
			return;
		}
		const n = nodes[active];
		if (n && onToggleChosen && (e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey) {
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
		class="sr-only nodes"
		bind:this={list}
		aria-label="Bronnen op het doek, {nodes.length}. Pijl omhoog en omlaag: volgende bron. Enter: openen.{onToggleChosen
			? ' N: voeg toe aan of haal uit netwerk.'
			: ''}"
		{onfocusin}
		{onfocusout}
	>
		{#each nodes as n, i (n.id)}
			<li>
				<a
					href={bronHref(refOf(n.collection, n.key, n.raw?.props))}
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

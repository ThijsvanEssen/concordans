<script lang="ts">
	// "Zoek in dit stuk": a bar over the text of a bron (a law, a stuk, a bijlage, a
	// uitspraak) that marks every hit in the text on the page, counts them and goes from one
	// to the next. The text is searched as it stands on the page, so what loads later
	// (a law's articles) is found once it is there.
	import { onMount, untrack } from 'svelte';
	import { scrollInReader } from '$lib/bron/landing';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import { collectText, findHits, hitsAsRanges, MIN_QUERY } from './search-in-text';

	let { root, onClose }: { root: HTMLElement | null; onClose: () => void } = $props();

	let query = $state('');
	let ranges = $state.raw<Range[]>([]);
	let at = $state(0);
	let field = $state<HTMLInputElement | null>(null);

	const HITS = 'zoek-treffer';
	const CURRENT = 'zoek-huidig';
	const highlights = typeof CSS !== 'undefined' && 'highlights' in CSS ? CSS.highlights : null;

	function mark() {
		if (!highlights) return;
		highlights.delete(HITS);
		highlights.delete(CURRENT);
		if (ranges.length === 0) return;
		highlights.set(HITS, new Highlight(...ranges));
		const current = ranges[at];
		if (current) highlights.set(CURRENT, new Highlight(current));
	}

	function searchAgain(toFirst: boolean) {
		if (root && query.trim().length >= MIN_QUERY) {
			const { text, parts } = collectText(root);
			ranges = hitsAsRanges(parts, findHits(text, query), root.ownerDocument);
		} else ranges = [];
		// Text that came in does not move the hit the reader is at.
		at = toFirst || ranges.length === 0 ? 0 : Math.min(at, ranges.length - 1);
		mark();
		if (toFirst) toHit();
	}

	function toHit() {
		const el = ranges[at]?.startContainer.parentElement;
		if (el) scrollInReader(el, 'center');
	}

	function step(delta: number) {
		if (ranges.length === 0) return;
		at = (at + delta + ranges.length) % ranges.length;
		mark();
		toHit();
	}

	$effect(() => {
		void query;
		void root;
		untrack(() => searchAgain(true));
	});

	// The text that loads after the search (articles, a stuk's pages) is searched as it comes.
	$effect(() => {
		if (!root || query.trim().length < MIN_QUERY) return;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const mo = new MutationObserver(() => {
			clearTimeout(timer);
			timer = setTimeout(() => untrack(() => searchAgain(false)), 250);
		});
		mo.observe(root, { childList: true, subtree: true, characterData: true });
		return () => {
			clearTimeout(timer);
			mo.disconnect();
		};
	});

	onMount(() => {
		field?.focus();
		return () => {
			highlights?.delete(HITS);
			highlights?.delete(CURRENT);
		};
	});

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			onClose();
		} else if (e.key === 'Enter') {
			e.preventDefault();
			step(e.shiftKey ? -1 : 1);
		}
	}

	const count = $derived(
		query.trim().length < MIN_QUERY
			? ''
			: ranges.length === 0
				? 'Geen treffer'
				: `${at + 1} van ${ranges.length}`
	);
</script>

<div class="search" role="search" data-search-ui>
	<input
		bind:this={field}
		bind:value={query}
		class="search__field"
		type="search"
		placeholder="Zoek in dit stuk"
		aria-label="Zoek in dit stuk"
		autocomplete="off"
		spellcheck="false"
		onkeydown={onKey}
	/>
	<span class="search__count" role="status" aria-live="polite">{count}</span>
	<IconButton label="Vorige treffer" disabled={ranges.length < 2} onclick={() => step(-1)}
		>↑</IconButton
	>
	<IconButton label="Volgende treffer" disabled={ranges.length < 2} onclick={() => step(1)}
		>↓</IconButton
	>
	<IconButton label="Zoeken sluiten" onclick={onClose}>×</IconButton>
</div>

<style>
	.search {
		position: sticky;
		top: calc(-1 * var(--reader-pad-top, var(--s-6)));
		z-index: var(--z-raised);
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin: calc(-1 * var(--s-2)) 0 var(--s-4);
		padding: var(--s-2) 0;
		background: var(--paper);
		border-bottom: 1px solid var(--rule);
		font-size: var(--t-ui);
	}
	input.search__field {
		flex: 1;
		min-width: 0;
		height: var(--veld-h);
		padding: 0 var(--s-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-family: var(--font-ui);
	}
	.search__count {
		flex: none;
		min-width: var(--s-8);
		color: var(--ink-3);
		white-space: nowrap;
	}
	/* A finger's target. */
	@media (pointer: coarse), (max-width: 768px) {
		input.search__field {
			height: var(--veld-h-raak);
		}
	}
</style>

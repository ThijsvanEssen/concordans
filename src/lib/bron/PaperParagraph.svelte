<script lang="ts">
	// An alinea of a Kamerstuk read in place, as an overweging is (Overweging): with `around`, the
	// alineas around it, the kept one barred. Each alinea's marker (its number, shown while it is
	// pointed at, focused or open), and a click on its text, is its menu, as in the reader
	// (DocumentReader): Citeer, Kopieer tekst and Bewaar (paperParagraphCite). Read where an
	// alinea is shown without its stuk: an opened item of a bundel (MapInhoud).
	import PlaatsMenu, { placeMarker } from '$lib/components/articles/PlaatsMenu.svelte';
	import { blockClick } from '$lib/actions/klik';
	import { citeItems } from '$lib/components/ui/cite-items';
	import { paperParagraphOf } from '$lib/map/inhoud';
	import { paperBlocks, type PaperSource } from '$lib/text/anchor';
	import TextBlocks from '$lib/components/articles/TextBlocks.svelte';
	import { paperParagraphCite, type PaperCitation } from '$lib/components/parliamentary/paper-cite';

	let {
		source,
		at,
		around = false,
		paper = null,
		link
	}: {
		/** The paper's text and structure, cut into alineas as its reader cuts them. */
		source: PaperSource;
		/** The place: an alinea (by a line of it, `p-360a090c`) or a passage, a section of the
		 *  API (`s-300`). */
		at: string;
		/** The alineas around it too. */
		around?: boolean;
		/** The paper as it is cited; without it an alinea has no menu. */
		paper?: PaperCitation | null;
		/** The link to a place in the stuk's reader. */
		link: (anker: string) => string;
	} = $props();

	const shown = $derived(paperParagraphOf(source, at, around));
	// An alinea with a table is one block, as in the reader.
	const blocks = $derived(shown ? paperBlocks(shown.items, source) : []);
	const cite = $derived(paper ? paperParagraphCite(paper) : null);

	/** The alinea whose menu is open, by its number, and the marker it hangs from. */
	let menu = $state<{ at: string; marker: HTMLElement } | null>(null);
	function openMenu(at: string, marker: HTMLElement) {
		menu = menu?.at === at ? null : { at, marker };
	}
	const onText = (at: string) => (e: MouseEvent) => {
		const marker = placeMarker(e, '.alinea');
		if (marker) openMenu(at, marker);
	};
	/** The words of an alinea, a table's every line: what Kopieer tekst copies. */
	const alineaText = (at: string) =>
		(shown?.items ?? [])
			.filter((p) => p.at === at)
			.map((p) => p.text)
			.join('\n');
</script>

{#if shown}
	<div class="alineas">
		{#each blocks as b (b.line.i)}
			{@const a = b.line}
			{@const n = a.n ?? 0}
			{@const at = a.at ?? ''}
			{@const forms = cite?.(n, at, link(at)) ?? null}
			<div
				class="alinea"
				class:eigen={around && shown.eigen.has(n)}
				class:is-open={menu?.at === at}
			>
				{#if forms && a.first}
					<button
						type="button"
						class="plaats-marker"
						aria-haspopup="menu"
						aria-expanded={menu?.at === at}
						aria-label="Alinea {n}: citeren, bewaren"
						onclick={(e) => openMenu(at, e.currentTarget)}>{n}</button
					>
				{/if}
				{#if b.tables.length}
					<div class:is-klikbaar={!!forms} use:blockClick={forms ? onText(at) : null}>
						<TextBlocks text={b.text} tables={b.tables} />
					</div>
				{:else}
					<p class:is-klikbaar={!!forms} use:blockClick={forms ? onText(at) : null}>{a.text}</p>
				{/if}
				{#if menu && menu.at === at && forms && a.first}
					<PlaatsMenu
						anker={menu.marker}
						title={forms.kort}
						cite={citeItems(forms, forms.link)}
						tekst={() => alineaText(at)}
						bewaar={forms.bewaar}
						onClose={() => (menu = null)}
					/>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.alineas {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
	}
	/* Its number in the column before its text, as an overweging's (Overweging). */
	.alinea {
		position: relative;
		padding: 0 var(--s-2) 0 var(--s-7);
		border-radius: var(--r-1);
	}
	.alinea p {
		margin: 0;
	}
	.alinea:has(.plaats-marker):hover,
	.alinea.is-open {
		background: var(--paper-2);
	}
	/* The marker is the alinea's menu: its number with ▾ under it while it is pointed at, open
	   or focused, as in the reader; nothing at rest. */
	.plaats-marker {
		position: absolute;
		top: 0;
		left: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		width: var(--s-7);
		padding: 0 var(--s-2) 0 0;
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-micro);
		line-height: calc(var(--lh-body) * var(--t-body));
		color: transparent;
		white-space: nowrap;
		user-select: none;
		cursor: pointer;
	}
	.alinea:hover > .plaats-marker,
	.alinea.is-open > .plaats-marker,
	.plaats-marker:focus-visible {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.alinea:hover > .plaats-marker::after,
	.alinea.is-open > .plaats-marker::after,
	.plaats-marker:focus-visible::after {
		content: '▾';
		font-size: 0.7em;
		line-height: 1;
		color: var(--ink-3);
		text-decoration: none;
	}
	.plaats-marker:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}
	.is-klikbaar {
		cursor: pointer;
	}
	/* The alinea kept, among those around it: the bar of a kept place. */
	.eigen::before {
		content: '';
		position: absolute;
		left: 0;
		top: var(--s-1);
		bottom: var(--s-1);
		width: 3px;
		background: var(--ink);
	}
</style>

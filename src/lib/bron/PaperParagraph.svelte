<script lang="ts">
	// An alinea of a Kamerstuk read in place, as an overweging is (Overweging): with `around`, the
	// alineas around it, the kept one barred. Each alinea's marker (its number, shown while it is
	// pointed at, focused or open), and a click on its text, is its menu, as in the reader
	// (DocumentReader): Citeer, Kopieer tekst and Bewaar (paperParagraphCite). Read where an
	// alinea is shown without its stuk: an opened item of a bundel (MapInhoud).
	import PlaatsMenu, { placeMarker } from '$lib/components/articles/PlaatsMenu.svelte';
	import PlaceNumber, { placeColumn } from './PlaceNumber.svelte';
	import ParagraphWords from './ParagraphWords.svelte';
	import { blockClick } from '$lib/actions/klik';
	import { citeItems } from '$lib/components/ui/cite-items';
	import { paperParagraphOf } from '$lib/map/inhoud';
	import { numeralOf, paperBlocks, type PaperSource } from '$lib/text/anchor';
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
	<div class="alineas" use:placeColumn={blocks}>
		{#each blocks as b (b.line.i)}
			{@const a = b.line}
			{@const n = a.n ?? 0}
			{@const at = a.at ?? ''}
			{@const forms = at ? (cite?.(n, at, link(at)) ?? null) : null}
			<div
				class="alinea plaats-blok"
				class:eigen={around &&
					(shown.eigen.has(a.i) || (!!b.numeral && shown.eigen.has(b.numeral.i)))}
				class:is-open={menu?.at === at}
			>
				{#if forms && a.first}
					<PlaceNumber
						number={b.numeral ? (numeralOf(b.numeral.text) ?? n) : n}
						label={b.numeral ? `Vraag ${numeralOf(b.numeral.text)}` : `Alinea ${n}`}
						open={menu?.at === at}
						quiet={!b.numeral}
						onopen={(marker) => openMenu(at, marker)}
					/>
				{/if}
				{#if b.tables.length}
					<div class:is-klikbaar={!!forms} use:blockClick={forms ? onText(at) : null}>
						<TextBlocks text={b.text} tables={b.tables} />
					</div>
				{:else}
					<div class:is-klikbaar={!!forms} use:blockClick={forms ? onText(at) : null}>
						<ParagraphWords answerLabel={b.answerLabel?.text ?? null} question={b.question}
							>{a.text}</ParagraphWords
						>
					</div>
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
		/* Its number (PlaceNumber) in the column before its text, as an overweging's
		   (Overweging): as wide as the widest number with 8px after it, 48px at least. */
		--alinea-num: max(var(--s-7), var(--plaats-num, 0px) + var(--s-2));
	}
	.alinea {
		position: relative;
		padding: 0 var(--s-2) 0 var(--alinea-num);
		border-radius: var(--r-1);
	}
	.alinea:has(:global(.plaats-marker)):hover,
	.alinea.is-open {
		background: var(--paper-2);
	}
	.alinea > :global(.plaats-marker) {
		position: absolute;
		top: 0;
		left: 0;
		width: var(--alinea-num);
		padding-right: var(--s-2);
		font-size: var(--t-body);
		line-height: var(--lh-body);
	}
	/* Its ring inside the column: the bundel's pane cuts what stands outside it. */
	.alinea > :global(.plaats-marker:focus-visible) {
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

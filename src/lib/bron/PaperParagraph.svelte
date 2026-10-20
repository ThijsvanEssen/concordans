<script lang="ts">
	// An alinea of a Kamerstuk read in place, as an overweging is (Overweging): with `around`, the
	// alineas around it, the kept one barred. Each alinea's marker, and a click on its text, is
	// its menu, as in the reader (DocumentReader): Citeer, Kopieer tekst and Bewaar
	// (paperParagraphCite). Read where an alinea is shown without its stuk: an opened item of a bundel
	// (MapInhoud).
	import PlaatsMenu, { placeMarker } from '$lib/components/articles/PlaatsMenu.svelte';
	import { blockClick } from '$lib/actions/klik';
	import { citeItems } from '$lib/components/ui/cite-items';
	import { paperParagraphOf } from '$lib/map/inhoud';
	import { paperParagraphAnchor, paperParagraphs } from '$lib/text/anchor';
	import { paperParagraphCite, type PaperCitation } from '$lib/components/parliamentary/paper-cite';

	let {
		text,
		at,
		around = false,
		paper = null,
		link
	}: {
		/** The paper's text, cut into alineas as its reader cuts it. */
		text: string;
		/** The alinea: `alinea-4`. */
		at: string;
		/** The alineas around it too. */
		around?: boolean;
		/** The paper as it is cited; without it an alinea has no menu. */
		paper?: PaperCitation | null;
		/** The link to a place in the stuk's reader. */
		link: (anker: string) => string;
	} = $props();

	const shown = $derived(paperParagraphOf(paperParagraphs(text), at, around));
	const cite = $derived(paper ? paperParagraphCite(paper) : null);

	/** The alinea whose menu is open, and the marker it hangs from. */
	let menu = $state<{ i: number; marker: HTMLElement } | null>(null);
	function openMenu(i: number, marker: HTMLElement) {
		menu = menu?.i === i ? null : { i, marker };
	}
	const onText = (i: number) => (e: MouseEvent) => {
		const marker = placeMarker(e, '.alinea');
		if (marker) openMenu(i, marker);
	};
</script>

{#if shown}
	<div class="alineas">
		{#each shown.items as a (a.i)}
			{@const forms = cite?.(a.i, link(paperParagraphAnchor(a.i))) ?? null}
			<div
				class="alinea"
				class:eigen={around && a.i === shown.eigen}
				class:is-open={menu?.i === a.i}
			>
				{#if forms}
					<button
						type="button"
						class="plaats-marker"
						aria-haspopup="menu"
						aria-expanded={menu?.i === a.i}
						aria-label="Alinea {a.i + 1}: citeren, bewaren"
						onclick={(e) => openMenu(a.i, e.currentTarget)}
					></button>
				{/if}
				<p class:is-klikbaar={!!forms} use:blockClick={forms ? onText(a.i) : null}>{a.text}</p>
				{#if menu && menu.i === a.i && forms}
					<PlaatsMenu
						anker={menu.marker}
						title={forms.kort}
						cite={citeItems(forms, forms.link)}
						tekst={() => a.text}
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
	/* Its marker in the 16px before its text, as in the reader. */
	.alinea {
		position: relative;
		padding-left: var(--s-4);
		border-radius: var(--r-1);
	}
	.alinea p {
		margin: 0;
	}
	.alinea:has(.plaats-marker):hover,
	.alinea.is-open {
		background: var(--paper-2);
	}
	/* The marker is the alinea's menu: nothing at rest, ▾ while it is pointed at, open or
	   focused. */
	.plaats-marker {
		position: absolute;
		top: 0;
		left: 0;
		width: var(--s-4);
		height: calc(var(--lh-body) * 1em);
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink-3);
		cursor: pointer;
	}
	.alinea:hover > .plaats-marker::after,
	.alinea.is-open > .plaats-marker::after,
	.plaats-marker:focus-visible::after {
		content: '▾';
		font-size: 0.7em;
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

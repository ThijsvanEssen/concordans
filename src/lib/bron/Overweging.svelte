<script lang="ts">
	// An overweging read in place, as the reader sets it: its number hanging in the margin,
	// its text with the citations as links, the paragraphs that continue it and its
	// sub-overwegingen; with `ruim`, the overwegingen around it, the kept one barred. The words
	// that cite `doel` are marked. One component for every place an r.o. is read without its
	// judgment: an opened item of Gemarkeerd (MapInhoud) and the card of a reference to an r.o.
	// (OverwegingKaart). With `bewaar`, a number is the overweging's menu, as in the reader:
	// Citeer, Kopieer tekst and Bewaar (overwegingCitaat).
	import PlaatsMenu from '$lib/components/articles/PlaatsMenu.svelte';
	import CitedText from '$lib/components/articles/CitedText.svelte';
	import { citeItems } from '$lib/components/ui/cite';
	import { overwegingVan } from '$lib/map/inhoud';
	import { overwegingCitaat } from '$lib/text/judgment-cite';
	import type { Uitspraak } from './overweging';

	let {
		uitspraak,
		at,
		ruim = false,
		doel = null,
		bewaar = null
	}: {
		uitspraak: Uitspraak;
		/** The overweging: `rov-5.1`. */
		at: string;
		/** The overwegingen around it too. */
		ruim?: boolean;
		/** The bron whose citations are marked: the article the r.o. is read for. */
		doel?: string | null;
		/** The menu of a number: the item's id it keeps under, and the link to a place. */
		bewaar?: { id: string; link: (anker: string) => string } | null;
	} = $props();

	const deel = $derived(overwegingVan(uitspraak.items, at, ruim));

	/** The overweging whose menu is open, and the number it hangs from. */
	let menu = $state<{ id: string; anker: HTMLElement } | null>(null);
	function openMenu(id: string, anker: HTMLElement) {
		menu = menu?.id === id ? null : { id, anker };
	}
	/** A click on an overweging's text opens its menu, as in the reader: not on a link or a
	 *  control, not when text is being selected. */
	function opTekst(e: MouseEvent, id: string) {
		const t = e.target as HTMLElement;
		if (t.closest('a, button, input, textarea, summary, [role="button"]')) return;
		if (window.getSelection()?.toString()) return;
		e.stopPropagation();
		const anker = (e.currentTarget as HTMLElement)
			.closest('.rov')
			?.querySelector<HTMLElement>('.plaats-marker');
		if (anker) openMenu(id, anker);
	}
</script>

{#if deel}
	<div class="overweging">
		{#each deel.items as b, k (k)}
			{#if b.kind === 'rov'}
				{@const forms = bewaar
					? overwegingCitaat(uitspraak.j, b.num, b.id, bewaar.link(b.id), bewaar.id)
					: null}
				<div class="rov" class:eigen={ruim && deel.eigen.has(k)} class:is-open={menu?.id === b.id}>
					{#if forms}
						<button
							type="button"
							class="rov-num plaats-marker"
							aria-haspopup="menu"
							aria-expanded={menu?.id === b.id}
							aria-label="Overweging {b.num}: citeren, bewaren"
							onclick={(e) => openMenu(b.id, e.currentTarget)}>{b.num}</button
						>
					{:else}
						<span class="rov-num">{b.num}</span>
					{/if}
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
					<div class:is-klikbaar={!!forms} onclick={(e) => forms && opTekst(e, b.id)}>
						<p><CitedText text={b.body} citations={b.citations} {doel} /></p>
					</div>
					{#if menu && menu.id === b.id && forms}
						<PlaatsMenu
							anker={menu.anker}
							titel={forms.kort}
							cite={citeItems(forms, forms.link)}
							tekst={() => b.body}
							bewaar={forms.bewaar}
							onClose={() => (menu = null)}
						/>
					{/if}
				</div>
			{:else if b.kind === 'prose'}
				<p class="rov-verder" class:eigen={ruim && deel.eigen.has(k)}>
					<CitedText text={b.body} citations={b.citations} {doel} />
				</p>
			{:else}
				<p class="rov-kop">{b.text}</p>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.overweging {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
	}
	.overweging p {
		margin: 0;
	}
	.rov {
		position: relative;
		display: grid;
		grid-template-columns: 3em minmax(0, 1fr);
		gap: 0 var(--s-3);
	}
	.rov-num {
		color: var(--ink-3);
		text-align: right;
	}
	.rov:has(.plaats-marker):hover,
	.rov.is-open {
		background: var(--paper-2);
	}
	/* The number is the overweging's menu, as in the reader (JudgmentReader): underlined with
	   ▾ while the overweging is pointed at, open or focused. */
	.plaats-marker {
		align-self: start;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink-3);
		cursor: pointer;
	}
	.rov:hover .plaats-marker,
	.rov.is-open .plaats-marker,
	.plaats-marker:focus-visible {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.rov:hover .plaats-marker::after,
	.rov.is-open .plaats-marker::after,
	.plaats-marker:focus-visible::after {
		content: ' ▾';
		font-size: 0.7em;
		color: var(--ink-3);
		text-decoration: none;
	}
	.plaats-marker:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.is-klikbaar {
		cursor: pointer;
	}
	.rov-verder {
		position: relative;
		margin-left: calc(3em + var(--s-3));
	}
	.rov-kop {
		font-weight: 600;
	}
	/* The overweging kept, among those around it: the bar of a kept place. */
	.eigen::before {
		content: '';
		position: absolute;
		left: calc(-1 * var(--s-3));
		top: var(--s-1);
		bottom: var(--s-1);
		width: 3px;
		background: var(--ink);
	}
</style>

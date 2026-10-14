<script lang="ts">
	// The card of a reference to a judgment at an r.o.: the whole overweging, read in the
	// margin without opening the judgment (Thijs, 14 Oct: "alleen die r.o. kort in de kantlijn
	// kan lezen om te checken of ik idd op zoek ben naar een dergelijke uitleg"), the words
	// that cite `doel` marked, and the way on: Open de uitspraak bij r.o. N. It stands in the
	// top layer by the link that opened it (BronLink), below it or above it where the screen
	// ends; it scrolls within itself where the overweging is long. The overweging as Gemarkeerd
	// opens a kept one (Overweging), from the detail the reader shares.
	import { afterTick } from '$lib/util/after-tick';
	import type { Action } from 'svelte/action';
	import { anchorLabel } from '$lib/text/anchor';
	import { isConclusion, uitspraakKop } from '$lib/text/judgment-cite';
	import Overweging from './Overweging.svelte';
	import { zetMarkering, type Markering } from './markering.svelte';
	import { heeftOverweging, laadUitspraak, type Uitspraak } from './overweging';

	let {
		judgment,
		at,
		doel = null,
		noot = null,
		markering = null,
		href,
		anker,
		kaart = $bindable(null),
		onpointerenter,
		onpointerleave,
		onkeydown,
		onfocusout
	}: {
		/** The judgment's key: `ecli_nl_hr_2019_2006`. */
		judgment: string;
		at: string;
		doel?: string | null;
		/** The note the citation stands in: open, its words marked. */
		noot?: string | null;
		/** What the reader marks where the link opens it. */
		markering?: Markering | null;
		/** Where the link goes: the judgment at the r.o., or beside the article. */
		href: string;
		anker: HTMLElement;
		kaart?: HTMLElement | null;
		onpointerenter?: () => void;
		onpointerleave?: () => void;
		onkeydown?: (e: KeyboardEvent) => void;
		onfocusout?: (e: FocusEvent) => void;
	} = $props();

	/** Space between the link and the card, and between the card and the screen's edge. */
	const AFSTAND = 4;
	const RAND = 8;

	let u = $state<Uitspraak | null | 'laden'>('laden');
	$effect(() => {
		const p = laadUitspraak(judgment);
		let stale = false;
		u = p ? 'laden' : null;
		p?.then((x) => !stale && (u = x)).catch(() => !stale && (u = null));
		return () => (stale = true);
	});

	// The key carries the ECLI: `r.o. 5`, `onder 5` in a conclusion, `§ 5` in Strasbourg.
	const plaats = $derived(anchorLabel(at, judgment) ?? at);
	const kop = $derived(u && u !== 'laden' ? (uitspraakKop(u.j)?.short ?? null) : null);

	/** Below the link, or above it where the screen ends below; never past a side. */
	function plaatsKaart() {
		if (!kaart) return;
		const a = anker.getBoundingClientRect();
		const k = kaart.getBoundingClientRect();
		const onder = a.bottom + AFSTAND;
		const boven = a.top - AFSTAND - k.height;
		const top = onder + k.height > innerHeight - RAND && boven >= RAND ? boven : onder;
		const left = Math.max(RAND, Math.min(a.left, innerWidth - RAND - k.width));
		kaart.style.top = `${Math.round(Math.max(RAND, top))}px`;
		kaart.style.left = `${Math.round(left)}px`;
	}

	// In the top layer, outside the text that holds the link: no letter of a line (italics of a
	// derived row) runs into the card.
	const bovenop: Action<HTMLElement> = (node) => {
		document.body.appendChild(node);
		try {
			node.showPopover();
		} catch {
			// Without the popover API the card stands fixed above the page by its z-index.
		}
		return {
			destroy() {
				try {
					node.hidePopover();
				} catch {
					// Already closed, or no popover API.
				}
				node.remove();
			}
		};
	};

	// Placed again when its text has come: the card grows from Laden… to the overweging. A
	// long overweging scrolls within the card to the words that cite `doel`, so they show at
	// once (its own scroll: the page stays).
	$effect(() => {
		if (u === 'laden') return plaatsKaart();
		afterTick(() => {
			plaatsKaart();
			const m = kaart?.querySelector<HTMLElement>('mark.doel, .voetnoot.is-open');
			if (!kaart || !m) return;
			const r = m.getBoundingClientRect();
			const top = r.top - kaart.getBoundingClientRect().top + kaart.scrollTop;
			if (top + r.height > kaart.clientHeight - RAND * 4)
				kaart.scrollTop = Math.max(0, top - kaart.clientHeight / 3);
		});
	});
</script>

<div
	class="kaart"
	role="dialog"
	tabindex="-1"
	aria-label="{kop ? `${kop}, ` : ''}{plaats}"
	popover="manual"
	bind:this={kaart}
	use:bovenop
	{onpointerenter}
	{onpointerleave}
	{onkeydown}
	{onfocusout}
>
	<p class="kop">{kop ? `${kop}, ${plaats}` : plaats}</p>
	{#if u === 'laden'}
		<p class="stil">Laden…</p>
	{:else if u && heeftOverweging(u, at)}
		<div class="tekst"><Overweging uitspraak={u} {at} {doel} {noot} /></div>
	{:else}
		<p class="stil">Tekst niet in de gegevens.</p>
	{/if}
	<p class="verder">
		<a {href} data-sveltekit-noscroll onclick={() => markering && zetMarkering(markering)}
			>{isConclusion(judgment)
				? `Open de conclusie ${plaats}`
				: `Open de uitspraak bij ${plaats}`}</a
		>
	</p>
</div>

<style>
	.kaart {
		position: fixed;
		inset: auto;
		margin: 0;
		z-index: var(--z-float);
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		width: min(64ch, calc(100vw - 16px));
		max-height: min(60vh, 480px);
		padding: var(--s-3) var(--s-4);
		overflow: auto;
		overscroll-behavior: contain;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
		color: var(--ink);
		text-align: left;
		font-style: normal;
		font-weight: normal;
		white-space: normal;
	}
	.kop {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-label);
		color: var(--ink-3);
	}
	/* The overweging in the card's measure: its number hangs in a narrower margin. */
	.tekst {
		font-size: var(--t-meta);
	}
	.tekst :global(.overweging) {
		font-size: var(--t-meta);
	}
	.tekst :global(.rov) {
		grid-template-columns: 2.5em minmax(0, 1fr);
		gap: 0 var(--s-2);
	}
	.tekst :global(.rov-verder) {
		margin-left: calc(2.5em + var(--s-2));
	}
	.stil {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.verder {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.verder a {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.verder a:hover,
	.verder a:focus-visible {
		text-decoration-color: currentColor;
	}
</style>

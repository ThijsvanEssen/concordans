<script lang="ts">
	// The card of a reference to a judgment at an r.o.: the whole overweging, read in the
	// margin without opening the judgment (Thijs, 14 Oct: "alleen die r.o. kort in de kantlijn
	// kan lezen om te checken of ik idd op zoek ben naar een dergelijke uitleg"), the words
	// that cite `doel` marked, and the way on: Open de uitspraak bij r.o. N. It stands in the
	// top layer by the link that opened it (BronLink), outside the text that holds the link (no
	// letter of a line in italics runs into it); it scrolls within itself where it is long.
	// The overweging as Gemarkeerd opens a kept one (Overweging), from the detail the reader
	// shares.
	import { afterTick } from '$lib/util/after-tick';
	import { EDGE } from '$lib/actions/top-layer';
	import FloatingCard from '$lib/components/ui/FloatingCard.svelte';
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
		anchor,
		element = $bindable(null),
		onpointerenter,
		onpointerleave,
		onfocusout,
		onclose
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
		anchor: HTMLElement;
		element?: HTMLElement | null;
		onpointerenter?: () => void;
		onpointerleave?: () => void;
		onfocusout?: (e: FocusEvent) => void;
		/** Closes the card: its link has scrolled out of view. */
		onclose: () => void;
	} = $props();

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

	// A long overweging scrolls within the card to the words that cite `doel`, so they show at
	// once (its own scroll: the page stays). The card grows from Laden… to the overweging, and
	// the top layer places it again.
	$effect(() => {
		if (u === 'laden') return;
		afterTick(() => {
			const m = element?.querySelector<HTMLElement>('mark.doel, .voetnoot.is-open');
			if (!element || !m) return;
			const r = m.getBoundingClientRect();
			const top = r.top - element.getBoundingClientRect().top + element.scrollTop;
			if (top + r.height > element.clientHeight - EDGE * 4)
				element.scrollTop = Math.max(0, top - element.clientHeight / 3);
		});
	});
</script>

<FloatingCard
	kind="text"
	detach
	{anchor}
	{onclose}
	bind:element
	role="dialog"
	tabindex={-1}
	aria-label="{kop ? `${kop}, ` : ''}{plaats}"
	{onpointerenter}
	{onpointerleave}
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
</FloatingCard>

<style>
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

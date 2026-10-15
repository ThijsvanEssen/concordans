<script lang="ts">
	// The footnotes of one overweging or paragraph, the same in every reader: under its text,
	// in the margin beside it where the column leaves room (actions/kantlijn.ts). Each note
	// with its label and its text, the citations in it links as in the text (CitedText). The
	// note a marker opened is marked and brought into view, with the words of a verbinding
	// marked in it (NootStand).
	import CitedText from './CitedText.svelte';
	import type { Noot } from '$lib/text/voetnoten';
	import { nootStand } from '$lib/text/voetnoten.svelte';
	import { scrollInReader } from '$lib/bron/landing';

	let {
		noten,
		ids = true,
		marge = true,
		kop = null
	}: {
		noten: Noot[];
		/** Each note its anchor as id (`fn-35`): in a reader, not in a card beside it. */
		ids?: boolean;
		/** In the margin where there is room; not where the notes close a section or the stuk. */
		marge?: boolean;
		/** A label above them, where they stand apart at the end: `Voetnoten`. */
		kop?: string | null;
	} = $props();

	const stand = nootStand();
	let lijst = $state<HTMLElement | null>(null);

	// The note a marker opened comes into view, where it is out of it.
	$effect(() => {
		const id = stand?.open;
		if (!id || !lijst) return;
		const el = lijst.querySelector<HTMLElement>(`[data-noot="${CSS.escape(id)}"]`);
		if (!el) return;
		const r = el.getBoundingClientRect();
		if (r.top < 0 || r.bottom > innerHeight) scrollInReader(el, 'center');
	});
</script>

{#if noten.length > 0}
	<aside
		class="voetnoten"
		class:voetnoten--marge={marge}
		aria-label={kop ?? 'Voetnoten'}
		bind:this={lijst}
	>
		{#if kop}<p class="voetnoten__kop">{kop}</p>{/if}
		{#each noten as n (n.id)}
			{@const open = stand?.open === n.id}
			<p class="voetnoot" class:is-open={open} id={ids ? n.id : undefined} data-noot={n.id}>
				<span class="voetnoot__label">{n.label}</span>
				<span class="voetnoot__tekst"
					><CitedText
						text={n.text}
						citations={n.citations}
						doel={open ? (stand?.doel ?? null) : null}
						bereik={open ? (stand?.bereik ?? null) : null}
					/></span
				>
			</p>
		{/each}
	</aside>
{/if}

<style>
	.voetnoten {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		margin: var(--s-2) 0 0;
		padding-top: var(--s-2);
		border-top: 1px solid var(--rule);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		color: var(--ink-2);
		text-align: left;
		hyphens: auto;
		overflow-wrap: break-word;
	}
	.voetnoten__kop {
		margin: 0 0 var(--s-1);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.voetnoot {
		display: grid;
		grid-template-columns: 2em minmax(0, 1fr);
		gap: 0 var(--s-1);
		margin: 0;
		padding: 0 var(--s-1);
		border-radius: var(--r-1);
		scroll-margin: 20vh;
		transition: background var(--dur-1) var(--ease);
	}
	/* The note a marker or a link opened: the bar of a place read, so the words marked in it
	   (wassing) stand out. */
	.voetnoot.is-open,
	.voetnoot:global(.is-landed) {
		background: var(--paper-2);
		box-shadow: inset 2px 0 0 var(--ink);
		color: var(--ink);
	}
	.voetnoot__label {
		color: var(--ink-3);
		text-align: right;
	}
	/* In the margin: beside the text it belongs to, the top at the text's; the column's
	   rule is enough, no rule of its own (kantlijn.ts sets the width and keeps them apart). */
	:global(.noten-in-kantlijn) .voetnoten--marge {
		position: absolute;
		top: 0;
		left: calc(100% + var(--s-6));
		width: var(--kantlijn-w, 240px);
		margin: 0;
		padding: 0;
		border-top: 0;
		font-size: var(--t-micro);
	}
</style>

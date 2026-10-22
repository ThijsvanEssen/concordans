<script lang="ts">
	import { isEscape } from '$lib/actions/keys';
	import { page } from '$app/state';
	import CiteMenu from '$lib/components/ui/CiteMenu.svelte';
	// The card Verbinding: the two bronnen with the relation between them, the passage
	// with the citation marked, betrouwbaarheid as a word with the reason, status, the
	// source of the edge, and the actions open at position, show in network, citeer.
	import { bronHref } from '$lib/bron/href';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import {
		betrouwbaarheid,
		citeVerbinding,
		markeringVan,
		toontStatus,
		type Verbinding
	} from './verbinding';
	import { passageOf } from './rows';
	import Aanhaling from './Aanhaling.svelte';
	import ConfidenceDot from './ConfidenceDot.svelte';
	import { zetMarkering } from '$lib/bron/markering.svelte';

	let {
		verbinding,
		docked = false,
		onClose,
		onShowInNetwork,
		besideHref
	}: {
		verbinding: Verbinding;
		/** Docked at the bottom left of the canvas; otherwise a card in the panel. */
		docked?: boolean;
		onClose: () => void;
		onShowInNetwork?: () => void;
		/** For a toelichting or a citing judgment: the address that opens it beside the article. */
		besideHref?: string | null;
	} = $props();

	const v = $derived(verbinding);
	const trust = $derived(betrouwbaarheid(v.confidence, v.derived, v.reason));

	const passage = $derived(passageOf(v));

	const SOURCE_OF_EDGE: Partial<Record<string, string>> = {
		judgments: 'tekst van de uitspraak',
		documents: 'tekst van het Kamerstuk',
		articles: 'tekst van de wet',
		instruments: 'structuur van de wet',
		dossiers: 'dossier van de Tweede Kamer'
	};
	const sourceOfEdge = $derived(
		v.derived && !v.reason
			? 'Concordans, op naam herkend'
			: (SOURCE_OF_EDGE[v.from.ref.collection] ?? 'de gegevens van de bron')
	);

	const openHref = $derived(besideHref ?? bronHref(v.from.ref, { at: v.at }));
	// The first place where it names several: `r.o. 6 en 7` opens at 6.
	const eerste = $derived(v.position?.replace(/ en .*$|, .*$/, '') ?? null);
	const openLabel = $derived(
		v.relation === 'EXPLAINS' && besideHref
			? 'Lees naast het artikel'
			: eerste
				? `Lees bij ${eerste}`
				: 'Lees'
	);

	// Escape closes the card in every mode; taken, so the network does not also clear.
	function onKey(e: KeyboardEvent) {
		if (!isEscape(e)) return;
		e.preventDefault();
		onClose();
	}
</script>

<svelte:window onkeydown={onKey} />

<section class="card" class:is-docked={docked} aria-label="Verbinding">
	<div class="card__head">
		<h2 class="card__title">Verbinding</h2>
		<span class="card__kind">{v.kind}</span>
		<span class="card__space"></span>
		<button type="button" class="btn is-text card__close" aria-label="Sluiten" onclick={onClose}
			>×</button
		>
	</div>

	<div class="ends">
		<KindGlyph collection={v.from.ref.collection} size={13} />
		<div>
			<a class="end__title" href={bronHref(v.from.ref, { at: v.at })} data-sveltekit-noscroll
				>{v.from.title}</a
			>
			{#if v.from.sub}<div class="end__sub">{v.from.sub}</div>{/if}
		</div>
		<div class="arrow" aria-hidden="true">
			<svg width="8" height="18" viewBox="0 0 8 18"
				><path d="M4 0v14M1 11l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.3" /></svg
			>
		</div>
		<div class="end__label">
			{v.label}{#if v.lid}, lid {v.lid}{/if}{#if v.position}, {v.position}{/if}
		</div>
		<KindGlyph collection={v.to.ref.collection} size={13} />
		<div>
			<a class="end__title" href={bronHref(v.to.ref)} data-sveltekit-noscroll>{v.to.title}</a>
			{#if v.to.sub}<div class="end__sub">{v.to.sub}</div>{/if}
		</div>
	</div>

	{#if passage}
		<p class="passage"><Aanhaling {passage} /></p>
	{/if}

	<dl class="kv">
		<dt>Betrouwbaarheid</dt>
		<dd>
			<ConfidenceDot word={trust.word} />
			{trust.word}: {trust.why}
		</dd>
		{#if toontStatus(v)}
			<dt>Status</dt>
			<dd class:is-proposed={v.status === 'voorgesteld'}>{v.status}</dd>
		{/if}
		<dt>Bron van de verbinding</dt>
		<dd>{sourceOfEdge}</dd>
	</dl>

	<div class="actions">
		<a
			class="btn is-primary"
			href={openHref}
			data-sveltekit-noscroll
			onclick={() => zetMarkering(markeringVan(v))}>{openLabel}</a
		>
		{#if onShowInNetwork}
			<button type="button" class="btn" onclick={onShowInNetwork}>In netwerk</button>
		{/if}
		<CiteMenu
			items={[
				{ kind: 'kort', text: citeVerbinding(v) },
				{ kind: 'link', text: new URL(openHref, page.url).toString() }
			]}
			name="deze verbinding"
		/>
	</div>
</section>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		width: 100%;
		padding: var(--s-4);
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink);
	}
	.card.is-docked {
		position: absolute;
		left: var(--s-5);
		bottom: var(--s-5);
		z-index: var(--z-float);
		width: 400px;
		max-width: calc(100% - 2 * var(--s-5));
	}
	.card__head {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
	}
	.card__title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		font-weight: 600;
	}
	.card__kind {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.card__space {
		flex: 1;
	}
	.card__close {
		font-size: var(--t-body-2);
		line-height: 1;
		padding: 0 var(--s-1);
	}
	.ends {
		display: grid;
		grid-template-columns: 14px 1fr;
		gap: var(--s-2) var(--s-3);
		align-items: start;
	}
	.ends :global(.kind-glyph) {
		margin-top: var(--s-1);
	}
	.end__title {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: 1.25;
		color: var(--ink);
	}
	.end__sub {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.arrow {
		display: flex;
		justify-content: center;
		padding-top: 2px;
		color: var(--ink-3);
	}
	.end__label {
		padding-top: var(--s-1);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.passage {
		margin: 0;
		padding-left: var(--s-3);
		border-left: 2px solid var(--rule-strong);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: 1.5;
	}
	.kv {
		display: grid;
		grid-template-columns: 128px 1fr;
		gap: var(--s-2) var(--s-4);
		margin: 0;
		line-height: 1.4;
	}
	.kv dt {
		color: var(--ink-3);
	}
	.kv dd {
		margin: 0;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
</style>

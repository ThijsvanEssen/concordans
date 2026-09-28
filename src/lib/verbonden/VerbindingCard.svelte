<script lang="ts">
	import { createCopier } from '$lib/components/ui/copy.svelte';
	// The card Verbinding: the two bronnen with the relation between them, the passage
	// with the citation marked, betrouwbaarheid as a word with the reason, status, the
	// source of the edge, and the actions open at position, show in network, citeer.
	import { bronHref } from '$lib/bron/href';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { betrouwbaarheid, citeVerbinding, type Verbinding } from './verbinding';

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
		/** For a toelichting: the address that opens it beside the article. */
		besideHref?: string | null;
	} = $props();

	const v = $derived(verbinding);
	const trust = $derived(betrouwbaarheid(v.confidence, v.derived, v.reason));

	const passage = $derived.by(() => {
		if (!v.snippet) return null;
		const i = v.match ? v.snippet.indexOf(v.match) : -1;
		if (i < 0) return { before: v.snippet, mark: '', after: '' };
		return {
			before: v.snippet.slice(0, i),
			mark: v.match!,
			after: v.snippet.slice(i + v.match!.length)
		};
	});

	const SOURCE_OF_EDGE: Partial<Record<string, string>> = {
		judgments: 'tekst van de uitspraak',
		documents: 'tekst van het Kamerstuk',
		articles: 'tekst van de wet',
		instruments: 'structuur van de wet',
		dossiers: 'dossier van de Tweede Kamer'
	};
	const sourceOfEdge = $derived(
		v.derived && !v.reason
			? 'afgeleid door Concordans'
			: (SOURCE_OF_EDGE[v.from.ref.collection] ?? 'de gegevens van de bron')
	);

	const copier = createCopier();
	const cite = () => copier.copy(citeVerbinding(v), 'cite');

	const openHref = $derived(
		v.relation === 'EXPLAINS' && besideHref ? besideHref : bronHref(v.from.ref, { at: v.at })
	);
	const openLabel = $derived(
		v.relation === 'EXPLAINS' && besideHref
			? 'Open naast het artikel'
			: v.position
				? `Open bij ${v.position}`
				: 'Open de bron'
	);
</script>

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
		<p class="passage">
			{passage.before}{#if passage.mark}<mark>{passage.mark}</mark>{/if}{passage.after}
		</p>
	{/if}

	<dl class="kv">
		<dt>Betrouwbaarheid</dt>
		<dd>
			<span class="conf conf--{trust.word}" aria-hidden="true"></span>
			{trust.word}: {trust.why}
		</dd>
		<dt>Status</dt>
		<dd class:is-proposed={v.status === 'voorgesteld'}>{v.status}</dd>
		<dt>Bron van de verbinding</dt>
		<dd>{sourceOfEdge}</dd>
		<dt>Beoordeling</dt>
		<dd>
			<button type="button" class="link" disabled title="Beoordelen is niet ingeschakeld"
				>Klopt</button
			>
			·
			<button type="button" class="link" disabled title="Beoordelen is niet ingeschakeld"
				>Klopt niet</button
			>
		</dd>
	</dl>

	<div class="actions">
		<a class="btn is-primary" href={openHref} data-sveltekit-noscroll>{openLabel}</a>
		{#if onShowInNetwork}
			<button type="button" class="btn" onclick={onShowInNetwork}>Toon in het netwerk</button>
		{/if}
		<button type="button" class="btn" onclick={cite}>{copier.label('cite', 'Citeer')}</button>
		<p class="sr-only" aria-live="polite">{copier.announcement}</p>
	</div>
</section>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 14px;
		width: 100%;
		padding: 18px 20px 20px;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
		font-family: var(--font-sans);
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
		font-weight: 500;
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
		gap: 6px 10px;
		align-items: start;
	}
	.ends :global(.kind-glyph) {
		margin-top: 3px;
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
		padding-top: 3px;
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
	.passage mark {
		background: var(--accent-soft);
		color: inherit;
	}
	.kv {
		display: grid;
		grid-template-columns: 128px 1fr;
		gap: 6px 14px;
		margin: 0;
		line-height: 1.4;
	}
	.kv dt {
		color: var(--ink-3);
	}
	.kv dd {
		margin: 0;
	}
	.kv dd.is-proposed {
		color: var(--accent);
	}
	.conf {
		display: inline-block;
		width: 7px;
		height: 7px;
		margin-right: 3px;
		border: 1.3px solid var(--ink-3);
		border-radius: 50%;
		vertical-align: 0;
	}
	.conf--hoog {
		background: var(--ink-3);
	}
	.conf--matig {
		background: linear-gradient(90deg, var(--ink-3) 50%, transparent 50%);
	}
	.link {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink);
		cursor: pointer;
	}
	.link:hover {
		color: var(--accent);
	}
	.link:disabled {
		color: var(--ink-3);
		cursor: default;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
</style>

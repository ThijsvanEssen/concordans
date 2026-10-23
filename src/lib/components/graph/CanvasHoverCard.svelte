<script lang="ts">
	import { NOT_IN_DATA } from '$lib/text/coverage';
	import { capitalize, textOf, truncate } from '$lib/text/words';
	import { naamVanId } from '$lib/bron/menselijk';
	// The card of the bron marked in the werkplek, in the strip at its right (besluit 39; on a
	// phone a sheet under the canvas): what the bron is, a preview, how it is tied to the chosen
	// bronnen, and its actions: Lees (the one filled), Toevoegen, Bewaar. It covers no bron.
	import type { GraphNode } from '$lib/graph/types';
	import { articleOf, lawIdOf } from '$lib/graph/types';
	import { getArticleDetail } from '$lib/api/articles';
	import { abortable } from '$lib/api/records';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { load } from '$lib/util/load.svelte';
	import { langeDatum } from '$lib/text/datum';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { focusOf, openHref, refOf } from '$lib/bron/href';
	import { bronKind } from '$lib/components/graph/bron-kind';
	import { bronNaam } from '$lib/bron/naam';
	import { instrumentMetaStore } from '$lib/api/instrument-cache';
	import { isEscape } from '$lib/actions/keys';
	import type { NodeNotitie } from '$lib/map/notities';
	import Aantekening from '$lib/map/Aantekening.svelte';
	import Bewaar from '$lib/map/Bewaar.svelte';
	import { bewaarItem } from '$lib/map/map';

	let {
		node,
		isChosen = false,
		onOpen,
		onLezen,
		onToggleChosen,
		ties = [],
		tiesHeading = 'Verbonden met de gekozen bronnen',
		facts = [],
		onClose,
		onVerder,
		onBack,
		notities = [],
		el = $bindable(null)
	}: {
		node: GraphNode;
		isChosen?: boolean;
		/** Called as the link opens the bron: the panel closes. */
		onOpen: (node: GraphNode) => void;
		/** A plain click on "Tekst lezen" opens the bron here; a new tab keeps the link. */
		onLezen?: (node: GraphNode) => void;
		onToggleChosen?: (node: GraphNode) => void;
		/** How it is tied to the chosen bronnen, a line each: `Haalt Art. 6:162 BW aan`. */
		ties?: readonly { text: string; collection: GraphNode['collection'] | null }[];
		/** The heading over them: `Verder in de keten` in the weergave Keten. */
		tiesHeading?: string;
		/** Lines of its own under Datum: `Grondslag`, `Aangehaald`. */
		facts?: readonly { term: string; value: string }[];
		/** Escape in the card (reached from the keyboard's list of bronnen). */
		onClose?: () => void;
		/** Tab past its last action, and Shift+Tab before its first. */
		onVerder?: () => void;
		onBack?: () => void;
		/** The reader's notes on this bron in every bundel, under the card's lines. */
		notities?: readonly NodeNotitie[];
		el?: HTMLElement | null;
	} = $props();

	// The card is reached from the list of bronnen with Tab; it hands the focus on to the
	// canvas after its last action and back to the list before its first (UX test, #14).
	function onkeydown(e: KeyboardEvent) {
		if (isEscape(e) && onClose) {
			e.preventDefault();
			onClose();
			return;
		}
		if (e.key !== 'Tab' || !el) return;
		const acties = [...el.querySelectorAll<HTMLElement>('a[href], button')];
		const hier = acties.indexOf(e.target as HTMLElement);
		if (!e.shiftKey && hier === acties.length - 1 && onVerder) {
			e.preventDefault();
			onVerder();
		} else if (e.shiftKey && hier === 0 && onBack) {
			e.preventDefault();
			onBack();
		}
	}

	const nodeProps = $derived(node.raw?.props ?? undefined);

	// The line next to the kind: the context the source belongs to.
	const cite = $derived.by(() => {
		switch (node.drawClass) {
			// The title already names court and date (bron/naam.ts); the ECLI identifies it.
			case 'judgment':
				return textOf(nodeProps?.['ecli']);
			case 'article':
				return textOf(nodeProps?.['instrument_citation_title']) ?? lawIdOf(nodeProps);
			case 'member':
				return textOf(nodeProps?.['party']);
			case 'dossier':
				return textOf(nodeProps?.['number']) ?? textOf(nodeProps?.['label']) ?? naamVanId(node.id);
			// A Kamerstuk by the dossier it is part of (mockup A197-b: Datum, Dossier).
			case 'document':
				return textOf(nodeProps?.['dossier_number']);
			case 'committee':
			case 'faction':
				return textOf(nodeProps?.['abbreviation']);
			default:
				return null;
		}
	});

	const preview = (value: string | null) => value && truncate(value, 220);

	// Text the node already carries, so hovering costs no request.
	const nodeText = $derived.by(() => {
		switch (node.drawClass) {
			case 'judgment':
				return textOf(nodeProps?.['summary']);
			case 'dossier':
			case 'document':
				return textOf(nodeProps?.['title']) ?? textOf(nodeProps?.['subject']);
			case 'committee':
			case 'faction':
				return textOf(nodeProps?.['name']);
			default:
				return null;
		}
	});

	// The text of an article is not on the node: it is asked, and an answer for a bron the
	// pointer has left is dropped (the shared request goes on for the reader).
	const identity = $derived(
		!node.stub && node.drawClass === 'article' ? articleOf(nodeProps) : null
	);
	const article = load(
		() => (identity ? `${identity.lawId}/${identity.articleNumber}` : null),
		(_, signal) =>
			identity
				? abortable(getArticleDetail(identity.lawId, identity.articleNumber), signal)
				: Promise.resolve(null),
		'Kaart artikel'
	);
	const articleText = $derived(
		article.state.status === 'ready' ? preview(article.state.data?.article.text ?? null) : null
	);

	const snippet = $derived(articleText ?? preview(nodeText));
	const datum = $derived(textOf(nodeProps?.['date']));
	/** What it is: a Kamerstuk by its own kind (Memorie van toelichting), the rest by bronKind. */
	const kindName = $derived(
		(node.collection === 'documents' ? textOf(nodeProps?.['kind']) : null) ??
			bronKind(node.collection, nodeProps)
	);
	/** What the line under Datum names, per kind: the law of an article, a judgment's ECLI. */
	const CITE_LABEL: Partial<Record<GraphNode['drawClass'], string>> = {
		judgment: 'ECLI',
		article: 'Wet',
		member: 'Fractie',
		dossier: 'Dossier',
		document: 'Dossier',
		committee: 'Afkorting',
		faction: 'Afkorting'
	};
	const naam = $derived(bronNaam(node, $instrumentMetaStore));
	const ref = $derived(refOf(node.collection, node.key, node.raw?.props));
	const bewaar = $derived.by(() => {
		const id = node.stub ? null : focusOf(ref);
		return id ? bewaarItem(id, { kort: naam }, { wet: lawIdOf(nodeProps) }) : null;
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="citepanel" {onkeydown} bind:this={el}>
	<div class="head">
		<KindGlyph collection={node.collection} />
		<span class="kind">{kindName}</span>
	</div>

	<h2 class="title {node.stub ? 'title--stub' : ''}">{naam}</h2>

	{#if node.stub}
		<p class="snippet stub-note">{capitalize(NOT_IN_DATA)}.</p>
	{:else if identity && article.state.status !== 'ready'}
		<div class="cite-loading">
			<LoadState state={article.state} what="De tekst" retry={article.retry} />
		</div>
	{:else if snippet}
		<p class="snippet">{snippet}</p>
	{/if}

	{#if datum || cite || facts.length}
		<dl class="facts">
			{#if datum}<dt>Datum</dt>
				<dd>{langeDatum(datum)}</dd>{/if}
			{#if cite}<dt>{CITE_LABEL[node.drawClass] ?? 'Bron'}</dt>
				<dd>{cite}</dd>{/if}
			{#each facts as k (k.term)}<dt>{k.term}</dt>
				<dd>{k.value}</dd>{/each}
		</dl>
	{/if}

	<!-- The reader's notes, as on Bundels (Aantekening), read only: changed there. -->
	{#each notities as n, i (i)}
		<Aantekening tekst={n.tekst} bij={n.waar ?? 'deze bron'} waar={n.waar} compact />
	{/each}

	<div class="foot">
		{#if !node.stub}
			<!-- A link, so a middle click or cmd-click opens the bron in a new tab. -->
			<a
				class="btn is-primary"
				href={openHref(ref)}
				data-sveltekit-noscroll
				onclick={(e) => {
					if (onLezen && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
						e.preventDefault();
						onLezen(node);
					} else onOpen(node);
				}}>Lees</a
			>
		{/if}
		{#if onToggleChosen && !node.stub}
			<button type="button" class="btn" aria-pressed={isChosen} onclick={() => onToggleChosen(node)}
				>{isChosen ? 'Uit het netwerk' : 'Toevoegen'}</button
			>
		{/if}
		{#if bewaar}<Bewaar item={bewaar} />{/if}
	</div>

	{#if ties.length > 0}
		<section class="ties" aria-label={tiesHeading}>
			<h3 class="verbanden__kop">{tiesHeading}</h3>
			<ul>
				{#each ties as v (v.text)}<li>
						{#if v.collection}<KindGlyph collection={v.collection} size={11} />{/if}{v.text}
					</li>{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	/* In the strip at the right of the werkplek, on its paper: no frame of its own. */
	.citepanel {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}

	.head {
		display: flex;
		align-items: center;
		gap: var(--s-2);
	}

	.title--stub {
		color: var(--ink-3);
	}
	.stub-note {
		font-style: italic;
		color: var(--ink-3);
	}

	.kind {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-style: italic;
		color: var(--ink-3);
	}

	/* Datum and its kind's line, as the mockup's: a column of terms, 96 px. */
	.facts {
		display: grid;
		grid-template-columns: 96px minmax(0, 1fr);
		gap: var(--s-2) var(--s-3);
		margin: var(--s-2) 0 0;
	}
	.facts dt {
		font-size: var(--t-micro);
		line-height: 20px;
		color: var(--ink-3);
	}
	.facts dd {
		margin: 0;
		font-size: var(--t-meta);
		line-height: 20px;
		overflow-wrap: anywhere;
	}

	.title {
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 600;
		line-height: 28px;
		color: var(--ink);
		margin: 0;
	}

	.snippet {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: 24px;
		color: var(--ink-2);
		margin: 0;
	}

	.cite-loading {
		padding: var(--s-2) 0;
	}

	/* Lees filled, the others framed (E2), on one line or wrapped. */
	.foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2);
		margin-top: var(--s-2);
	}

	.ties {
		margin-top: var(--s-4);
	}
	.verbanden__kop {
		margin: 0 0 var(--s-2);
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--ink-3);
	}
	.ties ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.ties li {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		padding: var(--s-2) 0;
		border-top: 1px solid var(--rule);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	/* A phone: the sheet holds what one decides by, as the mockup's 390. */
	@media (max-width: 768px) {
		.foot :global(.btn) {
			height: var(--veld-h-raak);
		}
		.title {
			font-size: var(--t-body-2);
			line-height: 24px;
		}
		.snippet {
			font-size: var(--t-meta);
			line-height: 20px;
			display: -webkit-box;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			-webkit-box-orient: vertical;
			overflow: hidden;
		}
		.facts,
		.ties {
			display: none;
		}
	}
</style>

<script lang="ts">
	import { textOf } from '$lib/text/words';
	import { hasPassed, langeDatum } from '$lib/text/datum';
	import { citationRecord } from '$lib/text/citation-record';
	import { getDossier } from '$lib/api/dossiers';
	import { bewaarItem } from '$lib/map/map';
	// Reader for instruments: the articles of the whole regulation in natural order. A
	// publication in the Staatsblad or Staatscourant has no articles of its own: it is
	// shown by its dates, and the articles it changes are in the panel Verbonden. Its text is
	// at its source (`completeness.text` not_fetched): the head says so, with the link.
	import ReaderFrame from './ReaderFrame.svelte';
	import ReaderHead from './ReaderHead.svelte';
	import { instrumentLawId, type GraphNode } from '$lib/graph/types';
	import WholeLawReader from '../WholeLawReader.svelte';
	import { publicationName, publicationTitle, sourceName } from '../law-head';
	import Coverage from '$lib/components/ui/Coverage.svelte';
	import {
		ensureInstrumentName,
		getInstrumentDetail,
		instrumentMetaStore
	} from '$lib/api/instrument-cache';
	import { load } from '$lib/util/load.svelte';
	import { citeItems } from '$lib/components/ui/cite-items';
	import { permalink } from '$lib/bron/landing';
	import { page } from '$app/state';

	let { node }: { node: GraphNode } = $props();

	const p = $derived(node.raw?.props ?? {});
	/** A year or a number as the props give it: 2018, `387`. */
	const numberOf = (v: unknown) => (typeof v === 'number' ? String(v) : textOf(v));
	const bwbId = $derived(instrumentLawId(p, node.key));
	const publication = $derived(textOf(p.publication_kind));
	// The node paints the head; its record adds what the source has (lui, after the first paint).
	const detail = load(
		() => (publication ? node.key.toUpperCase() : null),
		(key) => (key ? getInstrumentDetail(key) : Promise.resolve(null)),
		'Publicatie, gegevens'
	);
	const record = $derived(detail.state.status === 'ready' ? detail.state.data : null);
	// The law it enacted and the day that took effect, from its dossier (`enacted`), asked beside
	// its record: its head names it by them (Stb.-kop: wettitel, afkorting, inwerkingtreding).
	const dossierNumber = $derived(
		Array.isArray(p.dossier_numbers) ? textOf(p.dossier_numbers[0]) : null
	);
	const enactment = load(
		() => (publication && dossierNumber ? dossierNumber : null),
		(n) =>
			n
				? getDossier(n).then((d) => d.enacted?.find((e) => e.key === node.key) ?? null)
				: Promise.resolve(null),
		'Publicatie, wet'
	);
	const enacted = $derived(enactment.state.status === 'ready' ? enactment.state.data : null);
	const lawId = $derived(enacted?.instrument?.key.toUpperCase() ?? null);
	$effect(() => ensureInstrumentName(lawId));
	const cited = $derived(
		citationRecord({
			kind: 'publication',
			series: textOf(p.publication_kind),
			year: numberOf(p.publication_year),
			number: numberOf(p.publication_number),
			law: enacted?.instrument?.title
				? {
						title: enacted.instrument.title,
						abbreviation: lawId ? $instrumentMetaStore.get(lawId)?.abbreviation : null
					}
				: null
		})
	);
	const inForce = $derived(enacted?.first_effective_date ?? null);
	const official = $derived(
		record?.official_url
			? { label: sourceName(record.official_url) ?? 'Officiële tekst', href: record.official_url }
			: null
	);
</script>

<ReaderFrame find={!publication}>
	{#if publication}
		{@const plek = textOf(p.display_name) ?? node.label}
		{@const titel = cited?.heading ?? plek}
		{@const forms = cited ?? { short: plek, full: plek, dated: null }}
		{@const fullTitle = publicationTitle(node.raw?.title, plek)}
		<ReaderHead
			collection="instruments"
			title={titel}
			place={[publicationName(publication)]}
			acties={{
				bewaar: bewaarItem(node.id, { kort: forms.short, voluit: forms.full }, { groep: plek }),
				cite: citeItems(forms, permalink(page.url, '')),
				naam: forms.short,
				bron: official
			}}
		>
			{#snippet onderTitel()}
				{#if fullTitle}<p class="publicatie-titel">{fullTitle}</p>{/if}
			{/snippet}
			{#snippet statusLine()}
				{#if textOf(p.date_signed)}<span>Ondertekend {langeDatum(textOf(p.date_signed))}.</span
					>{/if}
				{#if textOf(p.date_published)}<span
						>Gepubliceerd {langeDatum(textOf(p.date_published))}.</span
					>{/if}
				{#if inForce}<span
						>{hasPassed(inForce) ? 'In werking getreden op' : 'Treedt in werking op'}
						{langeDatum(inForce)}.</span
					>{/if}
				{#if record?.completeness?.text?.state === 'not_fetched'}
					<Coverage coverage={record.completeness} bron={official} />
				{/if}
			{/snippet}
		</ReaderHead>
	{:else}
		<WholeLawReader {bwbId} />
	{/if}
</ReaderFrame>

<style>
	/* The official title under the name, as a law's (WholeLawReader). */
	.publicatie-titel {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-style: italic;
		color: var(--ink-2);
		max-width: 68ch;
	}
</style>

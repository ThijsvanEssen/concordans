<script lang="ts">
	// A source outside Concordans added to a map, in place under its groups: its citation as
	// the reader writes it (required), its address (optional), its kind and its group. Where
	// the address or the citation names a bron Concordans holds (recognize.ts), the form
	// proposes its reader, where Bewaar keeps it as an item of Concordans; it never turns it
	// into one on its own.
	import { articleRef } from '$lib/text/bw';
	import { page } from '$app/state';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import Tekstveld from '$lib/components/ui/Tekstveld.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import {
		externalItem,
		OTHER_SOURCES,
		SOURCE_KINDS,
		webAddress,
		type MapItem,
		type SourceKind
	} from './map';
	import { recognize } from './recognize';
	import { articleCitation } from '$lib/text/cite';
	import { citationRecord } from '$lib/text/citation-record';
	import { BUNDLE_PARAM } from './page';
	import { ensureInstrumentName, instrumentMetaStore } from '$lib/api/instrument-cache';
	import { lawName } from '$lib/text/instrument-meta';

	let {
		bundle,
		groups,
		onAdd,
		onClose
	}: {
		/** The bundel it is added to: the reader of a recognized bron keeps there (`?bundel=`). */
		bundle: string;
		/** The map's groups a source may join, by their key and name. */
		groups: { key: string; name: string }[];
		onAdd: (item: MapItem) => void;
		onClose: () => void;
	} = $props();

	const uid = $props.id();
	/** A reader's address that keeps in this bundel: Bewaar there knows where it was opened. */
	const inBundle = (path: string) => {
		const url = new URL(path, page.url);
		url.searchParams.set(BUNDLE_PARAM, bundle);
		return `${url.pathname}${url.search}${url.hash}`;
	};
	let citation = $state('');
	let url = $state('');
	let kind = $state<SourceKind>('book');
	let groupKey = $state('');

	const kinds = Object.entries(SOURCE_KINDS).map(([waarde, label]) => ({
		waarde: waarde as SourceKind,
		label
	}));
	const groupOptions = $derived([
		{ waarde: '', label: OTHER_SOURCES },
		...groups.filter((g) => g.name !== OTHER_SOURCES).map((g) => ({ waarde: g.key, label: g.name }))
	]);
	const known = $derived(recognize(url, page.url.origin) ?? recognize(citation, page.url.origin));
	const badUrl = $derived(!!url.trim() && !webAddress(url));

	// A law or an article named as its reader names it (`Burgerlijk Wetboek Boek 6`, `art.
	// 7:658 BW`), once Concordans gives the law's name; until then `deze wet`, never its id.
	$effect(() => {
		if (known?.law) ensureInstrumentName(known.law);
	});
	const law = $derived(
		known?.law
			? ($instrumentMetaStore.get(known.law) ?? $instrumentMetaStore.get(known.law.toLowerCase()))
			: null
	);
	const knownLabel = $derived.by(() => {
		if (!known?.law) return known?.label ?? '';
		// An article in the reader's own short form (`art. 6:163 BW`, its citation record), as Bewaar
		// keeps it (UX-toets A21 #5).
		if (known.article) {
			const c = articleCitation(
				{ bwb_id: known.law, article_number: known.article },
				{ meta: law ?? null }
			);
			return c
				? citationRecord({ ...c, kind: 'article' }).short
				: `${articleRef(known.law, known.article)}, deze wet`;
		}
		return lawName(law, null) ?? 'deze wet';
	});

	/** A field's own Escape (isEscape leaves a field alone) closes the form. */
	const leave = (e: KeyboardEvent) => {
		if (e.key === 'Escape') onClose();
	};

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!citation.trim() || badUrl) return;
		const group = groups.find((g) => g.key === groupKey);
		onAdd(externalItem({ citation, kind, url, group }));
		onClose();
	}
</script>

<form class="bron-erbij" aria-label="Andere bron toevoegen" novalidate onsubmit={submit}>
	<label for="{uid}-citation">Citeervorm</label>
	<Tekstveld
		id="{uid}-citation"
		required
		autocomplete="off"
		placeholder="Asser/Hartkamp & Sieburgh 6-IV 2019/45"
		bind:value={citation}
		onkeydown={leave}
		focus
	/>
	<label for="{uid}-url">Adres</label>
	<Tekstveld
		id="{uid}-url"
		type="url"
		inputmode="url"
		autocomplete="off"
		placeholder="https://… (optioneel)"
		aria-invalid={badUrl || undefined}
		aria-describedby={badUrl ? `${uid}-hint` : undefined}
		bind:value={url}
		onkeydown={leave}
	/>
	{#if badUrl}<span class="hint" id="{uid}-hint">Geen webadres</span>{/if}
	<span class="label" id="{uid}-kind">Soort</span>
	<span class="keuze" aria-labelledby="{uid}-kind">
		<TekstMenu label="Soort" opties={kinds} waarde={kind} onSelect={(v) => (kind = v)} />
	</span>
	<span class="label" id="{uid}-group">Groep</span>
	<span class="keuze" aria-labelledby="{uid}-group">
		<TekstMenu
			label="Groep"
			opties={groupOptions}
			waarde={groupKey}
			onSelect={(v) => (groupKey = v)}
		/>
	</span>
	{#if known}
		<p class="in-concordans">
			<span>In Concordans: {knownLabel}</span>
			<TekstLink href={inBundle(known.path)}>Bewaar vanuit de lezer</TekstLink>
		</p>
	{/if}
	<p class="knoppen">
		<button type="submit" class="btn" disabled={!citation.trim() || badUrl}>Toevoegen</button>
		<TekstLink onclick={onClose}>Annuleren</TekstLink>
	</p>
</form>

<style>
	/* The fields as a list of labels and values, as Feiten: the label at the left. */
	.bron-erbij {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		align-items: center;
		gap: var(--s-2) var(--s-3);
		max-width: 640px;
		margin: var(--s-3) 0 0;
		padding: var(--s-3);
		background: var(--paper-2);
		font-size: var(--t-meta);
	}
	label,
	.label {
		color: var(--ink-3);
	}
	.keuze {
		justify-self: start;
	}
	.hint {
		grid-column: 2;
		margin-top: calc(-1 * var(--s-1));
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.in-concordans,
	.knoppen {
		grid-column: 1 / -1;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-1) var(--s-4);
		margin: 0;
	}
	.in-concordans span {
		color: var(--ink-2);
	}
	.knoppen {
		align-items: center;
	}
	@media (max-width: 768px) {
		.bron-erbij {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--s-1);
		}
		.bron-erbij > :global(.tekstveld),
		.keuze {
			margin-bottom: var(--s-2);
		}
		.hint {
			grid-column: 1;
		}
	}
</style>

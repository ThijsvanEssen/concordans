<script lang="ts">
	import { textOf } from '$lib/text/words';
	// What an item of a map shows when its row opens: the place it keeps, read in place, so a
	// map is read without going back and forth (Thijs, 12 Oct). An article its lid in the
	// reader's own text (ArticleText: its references and defined terms as there), Heel artikel
	// a click further; a judgment its overweging (Overweging, as a reference's card shows
	// it), the overwegingen around it a click further; a Kamerstuk its kept alinea or passage (PaperParagraph), the
	// alineas around it a click further, else the words its note quotes
	// in the text around them, else its core text as its row opens anywhere (kernVan: a motie
	// its dictum, an amendement its toelichting, another its opening); another bron the lines
	// of its card. Asked when the row opens, once
	// (the readers share the requests). The bron itself stays one step further, by a link that
	// says where it goes: In de lezer, beside Heel artikel hier, which widens the
	// lid to its article in place (Thijs, 12 Oct). An article opens with the regulations based
	// on it, a law with its kind and its day (its name and title stand in the row: not again,
	// Thijs, 13 Oct) and the regulations based on it, else the laws connected to it
	// (MapRegelingen).
	// A place's menu is the reader's own (PlaatsMenu): Citeer, Kopieer tekst and Bewaar, from
	// the same citation (articleCitation, overwegingCitaat, paperParagraphCite; Thijs, 12 Oct).
	import type { Schema } from '$lib/api/types';
	import { getArticleDetail, getArticleDetailByKey } from '$lib/api/articles';
	import { instrumentMetaStore, recordArticleLaw } from '$lib/api/instrument-cache';
	import { page } from '$app/state';
	import { permalink } from '$lib/bron/landing';
	import { anchorLabel } from '$lib/text/anchor';
	import { articleCitation } from '$lib/text/cite';
	import { getDocument, getNodeFirst } from '$lib/api/records';
	import { loadPreview } from '$lib/bron/preview';
	import ArticleText from '$lib/components/articles/ArticleText.svelte';
	import Overweging from '$lib/bron/Overweging.svelte';
	import PaperParagraph from '$lib/bron/PaperParagraph.svelte';
	import { parseAnchor, type PaperSource } from '$lib/text/anchor';
	import { citePaper, type PaperCitation } from '$lib/components/parliamentary/paper-cite';
	import { heeftOverweging, laadUitspraak, type Uitspraak } from '$lib/bron/overweging';
	import { kernSoort, kernVan } from '$lib/components/open/rij-inhoud';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import StukUitslag from '$lib/components/parliamentary/StukUitslag.svelte';
	import {
		stukUitslag,
		type StukUitslag as StukUitslagT
	} from '$lib/components/parliamentary/stuk-uitslag';
	import { onderdeelMark } from '$lib/text/article-parts';
	import { getInstrumentDetail } from '$lib/api/instrument-cache';
	import { kindName } from '$lib/components/explore/law-head';
	import { korteDatum } from '$lib/text/datum';
	import { parseNodeId } from '$lib/vocabulary';
	import { isNotFound, report } from '$lib/api/errors';
	import { lawIdOf } from '$lib/graph/types';
	import {
		enactedLawId,
		enactedLawOfKey,
		enactedLawStatus,
		isEnactedLawItem
	} from '$lib/text/enacted-law';
	import { MOVED_LAW } from '$lib/bron/moved-law';
	import { citaatUit, paperParagraphOf, rondCitaat } from './inhoud';
	import type { MapItem } from './map';
	import MapRegelingen from './MapRegelingen.svelte';
	import { onderWet, opArtikel } from './verbonden';

	let { item, href }: { item: MapItem; href: string } = $props();

	/** An article's detail, its law's id (a BWB id, an EU act's CELEX) and the name the
	 *  article gives its law where its node was asked. */
	type Artikel = Schema<'ArticleDetailResponse'> & { bwb: string; eigen: string | null };
	type Inhoud =
		| { soort: 'laden' }
		| { soort: 'niets' }
		| { soort: 'vervangen' }
		| { soort: 'artikel'; d: Artikel }
		| { soort: 'uitspraak'; u: Uitspraak; samenvatting: string | null }
		| {
				soort: 'stuk';
				/** How the Kamer decided on a motie or amendement (StukUitslag). */
				uitslag: StukUitslagT | null;
				tekst: string | null;
				kern: string | null;
				als: 'dictum' | 'toelichting' | 'opening';
				/** Its text and structure, cut into alineas as its reader cuts them. */
				source: PaperSource;
				/** How it is cited, for the menu of a kept alinea or passage; its path for the link. */
				paper: PaperCitation | null;
				path: string | null;
		  }
		| { soort: 'wet'; bwb: string; bij: string }
		| { soort: 'regels'; tekst: string };

	let inhoud = $state<Inhoud>({ soort: 'laden' });
	/** The article around its lid, the overwegingen around one. */
	let ruim = $state(false);

	async function artikel(key: string): Promise<Artikel | null> {
		const bekend = getArticleDetailByKey(key);
		if (bekend) {
			const d = await bekend;
			const bwb =
				d.article.bwb_id ??
				d.instrument?.celex ??
				d.instrument?.bwb_id ??
				enactedLawId(d.article.official_id) ??
				'';
			return { ...d, bwb, eigen: null };
		}
		const props = ((await getNodeFirst('articles', key)).node.props ?? {}) as Record<
			string,
			unknown
		>;
		const bwb = lawIdOf(props);
		const nummer = textOf(props.article_number);
		return bwb && nummer
			? {
					...(await getArticleDetail(bwb, nummer)),
					bwb,
					eigen: textOf(props.instrument_citation_title)
				}
			: null;
	}

	async function laad(i: MapItem): Promise<Inhoud> {
		const doel = parseNodeId(i.id);
		if (!doel) return { soort: 'niets' };
		if (doel.collection === 'articles') {
			const d = await artikel(doel.key);
			// The law's names, as the reader records them: its citation reads them.
			if (d?.bwb) recordArticleLaw(d.bwb, d.instrument);
			return d ? { soort: 'artikel', d } : { soort: 'niets' };
		}
		if (doel.collection === 'judgments') {
			const u = await laadUitspraak(doel.key);
			return u ? { soort: 'uitspraak', u, samenvatting: textOf(u.j.summary) } : { soort: 'niets' };
		}
		if (doel.collection === 'instruments') {
			const enacted = enactedLawOfKey(doel.key);
			const d = await getInstrumentDetail(enacted ?? doel.key.toUpperCase());
			const bwb = d.bwb_id ?? d.celex ?? enacted ?? doel.key.toUpperCase();
			const sinds = d.date_in_force ?? d.version_date_in_force;
			return {
				soort: 'wet',
				bwb,
				bij: [
					kindName(d.kind),
					enacted && !d.in_force
						? enactedLawStatus(enacted)?.toLowerCase()
						: sinds
							? `in werking ${korteDatum(sinds)}`
							: null
				]
					.filter(Boolean)
					.join(', ')
			};
		}
		if (doel.collection === 'documents') {
			// A kept alinea or passage is cited as in the reader: with its light node (the
			// vergaderjaar).
			const place = parseAnchor(i.at)?.kind;
			const kept = place === 'line' || place === 'section';
			const [d, light] = await Promise.all([
				getDocument(doel.key),
				kept
					? getNodeFirst('documents', doel.key).catch((e) => {
							// The paper is then cited without its vergaderjaar.
							report('Lichte bron van het stuk', e);
							return null;
						})
					: null
			]);
			const als = kernSoort(d.kind);
			return {
				soort: 'stuk',
				uitslag: stukUitslag(d),
				tekst: d.text ?? null,
				kern: kernVan(als, d),
				als,
				source: d,
				paper: kept ? citePaper(d, (light?.node.props ?? {}) as Record<string, unknown>) : null,
				path: light?.path ?? null
			};
		}
		const p = await loadPreview(i.id, i.at || null);
		return p?.lines ? { soort: 'regels', tekst: p.lines } : { soort: 'niets' };
	}

	$effect(() => {
		const i = item;
		let stale = false;
		inhoud = { soort: 'laden' };
		laad(i)
			.then((x) => {
				if (!stale) inhoud = x;
			})
			.catch((e) => {
				if (stale) return;
				// A law of the Staatsblad, or an article of it, that the BWB now holds: the API lets
				// it go, and its address goes on to the BWB (the server's 301).
				inhoud =
					isNotFound(e) && isEnactedLawItem(i.id) ? { soort: 'vervangen' } : { soort: 'niets' };
			});
		return () => (stale = true);
	});

	const citaat = $derived(citaatUit(item.notitie));
	/** The place kept, as the reader prints it: `lid 2, onder a`; `r.o. 5.1` as its judgment cites it. */
	const plaats = $derived(
		anchorLabel(item.at, inhoud.soort === 'uitspraak' ? inhoud.u.j.ecli : null)
	);

	/** The link Citeer copies: the place in the bron's reader at its own address (its detail's
	 *  `path`, as the reader's page has it), not in the map. */
	const linkNaar = (pad: string | null | undefined, anker: string) =>
		permalink(new URL(pad || href, page.url), anker);

	// An article is cited as its reader cites it (ArticleReader): the same citation, and
	// Bewaar keeps the place under the bron's id, in the active map.
	const citation = $derived(
		inhoud.soort === 'artikel'
			? articleCitation(inhoud.d.article, {
					own: inhoud.d.eigen,
					meta: $instrumentMetaStore.get(inhoud.d.bwb) ?? null,
					displayName: inhoud.d.instrument?.display_name,
					// An act of the EU, its text as adopted: never "geldend" (its day is the reader's).
					adopted: inhoud.d.instrument?.celex && !inhoud.d.instrument.bwb_id ? { on: null } : null
				})
			: null
	);
</script>

<div class="inhoud">
	{#if inhoud.soort === 'laden'}
		<p class="stil">Laden…</p>
	{:else if inhoud.soort === 'artikel'}
		{@const a = inhoud.d.article}
		<div class="artikel">
			<ArticleText
				text={a.text}
				parts={a.parts}
				tables={a.tables}
				citations={inhoud.d.citations}
				begrippen={inhoud.d.term_spans ?? []}
				definities={inhoud.d.definitions ?? []}
				mark={onderdeelMark(inhoud.d.bwb)}
				gemarkeerd={ruim ? item.at || null : null}
				alleen={ruim ? null : item.at || null}
				ankers={false}
				{citation}
				bewaar={citation ? { id: item.id, groep: citation.citationTitle, wet: inhoud.d.bwb } : null}
				adres={a.path || href}
			/>
		</div>
		{#if inhoud.d.bwb && a.article_number}
			{@const bwb = inhoud.d.bwb}
			{@const nummer = a.article_number}
			<MapRegelingen laad={() => opArtikel(bwb, nummer)} />
		{/if}
		<p class="verder">
			{#if item.at}
				<TekstLink onclick={() => (ruim = !ruim)} aria-pressed={ruim}
					>{ruim ? `Alleen ${plaats ?? 'de plaats'}` : 'Heel artikel hier'}</TekstLink
				>
			{/if}
			<TekstLink {href}>In de lezer</TekstLink>
		</p>
	{:else if inhoud.soort === 'uitspraak'}
		{@const u = inhoud.u}
		{@const deel = item.at ? heeftOverweging(u, item.at) : false}
		{#if deel}
			<Overweging
				uitspraak={u}
				at={item.at}
				{ruim}
				bewaar={{ id: item.id, link: (anker) => linkNaar(u.j.path, anker) }}
			/>
		{:else if inhoud.samenvatting}
			<p class="tekst">{inhoud.samenvatting}</p>
		{:else}
			<p class="stil">Tekst niet in de gegevens.</p>
		{/if}
		<p class="verder">
			{#if deel}
				<TekstLink onclick={() => (ruim = !ruim)} aria-pressed={ruim}
					>{ruim ? `Alleen ${plaats ?? 'de overweging'}` : 'Overwegingen eromheen'}</TekstLink
				>
			{/if}
			<TekstLink {href}>In de lezer</TekstLink>
		</p>
	{:else if inhoud.soort === 'stuk'}
		{@const rond = citaat ? rondCitaat(inhoud.tekst, citaat) : null}
		{@const path = inhoud.path}
		{@const kept = !!paperParagraphOf(inhoud.source, item.at)}
		<!-- The row is the map's own (a citation and a note): the outcome stands here, as on
		     the row of every other list of Kamerstukken. -->
		{#if inhoud.uitslag}<p class="uitslag"><StukUitslag uitslag={inhoud.uitslag} /></p>{/if}
		{#if kept}
			<PaperParagraph
				source={inhoud.source}
				at={item.at}
				around={ruim}
				paper={inhoud.paper}
				link={(anchor) => linkNaar(path, anchor)}
			/>
		{:else if rond}
			<p class="tekst">{rond.voor}<mark>{rond.citaat}</mark>{rond.na}</p>
		{:else if inhoud.kern}
			<p class="tekst" class:dictum={inhoud.als === 'dictum'}>{inhoud.kern}</p>
		{:else}
			<p class="stil">Tekst nog niet in de gegevens.</p>
		{/if}
		<p class="verder">
			{#if kept}
				<TekstLink onclick={() => (ruim = !ruim)} aria-pressed={ruim}
					>{ruim
						? `Alleen ${plaats ?? (parseAnchor(item.at)?.kind === 'section' ? 'de passage' : 'de alinea')}`
						: "Alinea's eromheen"}</TekstLink
				>
			{/if}
			<TekstLink {href}>In de lezer</TekstLink>
		</p>
	{:else if inhoud.soort === 'wet'}
		{@const bwb = inhoud.bwb}
		{#if inhoud.bij}<p class="stil">{inhoud.bij}</p>{/if}
		<MapRegelingen laad={() => onderWet(bwb)} />
		<p class="verder"><TekstLink {href}>In de lezer</TekstLink></p>
	{:else if inhoud.soort === 'regels'}
		<p class="tekst">{inhoud.tekst}</p>
		<p class="verder"><TekstLink {href}>In de lezer</TekstLink></p>
	{:else if inhoud.soort === 'vervangen'}
		<p class="stil">{MOVED_LAW}.</p>
		<p class="verder"><TekstLink {href}>Geldende tekst</TekstLink></p>
	{:else}
		<p class="stil">Tekst niet in de gegevens.</p>
		<p class="verder"><TekstLink {href}>In de lezer</TekstLink></p>
	{/if}
</div>

<style>
	/* Under the row, in the reader's letter: the text as wide as a reader's column. */
	.inhoud {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		max-width: 68ch;
		padding: var(--s-2) 0 var(--s-4);
	}
	/* ArticleText hangs its numbers in a reader's margin; here there is none. */
	.artikel {
		--reader-pad-left: 0px;
	}
	.artikel :global(.article-text) {
		margin-left: 0;
	}
	.tekst {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
	}
	mark {
		background: var(--wassing);
		color: inherit;
	}
	.dictum {
		font-style: italic;
	}
	.uitslag {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.stil {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.verder {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-4);
		margin: 0;
		font-size: var(--t-meta);
	}
	/* The way on, one label for every bron (UX-toets A14 #7); not on paper. */
	@media print {
		.verder {
			display: none;
		}
	}
</style>

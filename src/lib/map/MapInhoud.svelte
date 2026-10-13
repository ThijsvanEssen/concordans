<script lang="ts">
	// What an item of a map shows when its row opens: the place it keeps, read in place, so a
	// map is read without going back and forth (Thijs, 12 Oct). An article its lid in the
	// reader's own text (ArticleText: its references and defined terms as there), Heel artikel
	// a click further; a judgment its overweging (CitedText), the overwegingen around it a
	// click further; a Kamerstuk the words its note quotes in the text around them, else the
	// opening of its text; another bron the lines of its card. Asked when the row opens, once
	// (the readers share the requests). The bron itself stays one step further, by a link that
	// says where it goes: Heel artikel in de lezer, beside Heel artikel hier, which widens the
	// lid to its article in place (Thijs, 12 Oct). An article opens with the regulations based
	// on it, a law with its kind and its day (its name and title stand in the row: not again,
	// Thijs, 13 Oct) and the regulations based on it, else the laws connected to it
	// (MapRegelingen).
	// A place's menu is the reader's own (PlaatsMenu): Citeer, Kopieer tekst and Bewaar, from
	// the same citation (articleCitation, overwegingCitaat; Thijs, 12 Oct).
	import type { Schema } from '$lib/api/types';
	import { getArticleDetail, getArticleDetailByKey } from '$lib/api/articles';
	import { instrumentMetaStore, recordArticleLaw } from '$lib/api/instrument-cache';
	import { page } from '$app/state';
	import { permalink } from '$lib/bron/anchor';
	import PlaatsMenu from '$lib/components/articles/PlaatsMenu.svelte';
	import { citeItems } from '$lib/components/ui/cite';
	import { articleCitation } from '$lib/text/cite';
	import { overwegingCitaat, type UitspraakVoorCitaat } from '$lib/text/judgment-cite';
	import { getJudgmentDetail } from '$lib/api/judgments';
	import { getDocument, getNodeFirst } from '$lib/api/records';
	import { loadPreview } from '$lib/bron/preview';
	import { keyEcli } from '$lib/bron/leesbaar';
	import ArticleText from '$lib/components/articles/ArticleText.svelte';
	import CitedText from '$lib/components/articles/CitedText.svelte';
	import {
		bodyItems,
		signatureStart,
		type BodyItem
	} from '$lib/components/explore/readers/judgment-text';
	import { openingVan } from '$lib/components/open/rij-inhoud';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import { onderdeelMark } from '$lib/text/article-parts';
	import { getInstrumentDetail } from '$lib/api/instrument-cache';
	import { kindName } from '$lib/components/explore/law-head';
	import { korteDatum } from '$lib/text/datum';
	import { parseNodeId } from '$lib/vocabulary';
	import { citaatUit, overwegingVan, rondCitaat } from './inhoud';
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
		| { soort: 'artikel'; d: Artikel }
		| {
				soort: 'uitspraak';
				j: UitspraakVoorCitaat;
				items: BodyItem[];
				samenvatting: string | null;
		  }
		| { soort: 'stuk'; tekst: string | null }
		| { soort: 'wet'; bwb: string; bij: string }
		| { soort: 'regels'; tekst: string };

	let inhoud = $state<Inhoud>({ soort: 'laden' });
	/** The article around its lid, the overwegingen around one. */
	let ruim = $state(false);

	const tekstVan = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

	async function artikel(key: string): Promise<Artikel | null> {
		const bekend = getArticleDetailByKey(key);
		if (bekend) {
			const d = await bekend;
			const bwb = d.article.bwb_id ?? d.instrument?.celex ?? d.instrument?.bwb_id ?? '';
			return { ...d, bwb, eigen: null };
		}
		const props = ((await getNodeFirst('articles', key)).node.props ?? {}) as Record<
			string,
			unknown
		>;
		const bwb = tekstVan(props.bwb_id) ?? tekstVan(props.celex);
		const nummer = tekstVan(props.article_number);
		return bwb && nummer
			? {
					...(await getArticleDetail(bwb, nummer)),
					bwb,
					eigen: tekstVan(props.instrument_citation_title)
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
			const ecli = keyEcli(doel.key);
			if (!ecli) return { soort: 'niets' };
			const { judgment: j } = await getJudgmentDetail(ecli);
			const paragraphs = j.paragraphs ?? [];
			return {
				soort: 'uitspraak',
				j,
				items: bodyItems(paragraphs.slice(0, signatureStart(paragraphs))),
				samenvatting: tekstVan(j.summary)
			};
		}
		if (doel.collection === 'instruments') {
			const d = await getInstrumentDetail(doel.key.toUpperCase());
			const bwb = d.bwb_id ?? d.celex ?? doel.key.toUpperCase();
			const sinds = d.date_in_force ?? d.version_date_in_force;
			return {
				soort: 'wet',
				bwb,
				bij: [kindName(d.kind), sinds ? `in werking ${korteDatum(sinds)}` : null]
					.filter(Boolean)
					.join(', ')
			};
		}
		if (doel.collection === 'documents')
			return { soort: 'stuk', tekst: (await getDocument(doel.key)).text ?? null };
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
			.catch(() => {
				if (!stale) inhoud = { soort: 'niets' };
			});
		return () => (stale = true);
	});

	const citaat = $derived(citaatUit(item.notitie));
	const plaats = $derived(item.at.startsWith('lid-') ? `lid ${item.at.slice(4)}` : null);
	const ro = $derived(item.at.startsWith('rov-') ? `r.o. ${item.at.slice(4)}` : null);

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
					displayName: inhoud.d.instrument?.display_name
				})
			: null
	);

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

<div class="inhoud">
	{#if inhoud.soort === 'laden'}
		<p class="stil">Laden…</p>
	{:else if inhoud.soort === 'artikel'}
		{@const a = inhoud.d.article}
		<div class="artikel">
			<ArticleText
				text={a.text}
				parts={a.parts}
				citations={inhoud.d.citations}
				begrippen={inhoud.d.term_spans ?? []}
				definities={inhoud.d.definitions ?? []}
				mark={onderdeelMark(inhoud.d.bwb)}
				gemarkeerd={ruim ? item.at || null : null}
				alleen={ruim ? null : item.at || null}
				ankers={false}
				{citation}
				bewaar={citation ? { id: item.id, groep: citation.citationTitle } : null}
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
			<TekstLink {href}>{item.at ? 'Heel artikel in de lezer' : 'Artikel in de lezer'}</TekstLink>
		</p>
	{:else if inhoud.soort === 'uitspraak'}
		{@const deel = item.at ? overwegingVan(inhoud.items, item.at, ruim) : null}
		{#if deel}
			<div class="uitspraak">
				{#each deel.items as b, k (k)}
					{#if b.kind === 'rov'}
						{@const forms = overwegingCitaat(
							inhoud.j,
							b.num,
							b.id,
							linkNaar(inhoud.j.path, b.id),
							item.id
						)}
						<div
							class="rov"
							class:eigen={ruim && deel.eigen.has(k)}
							class:is-open={menu?.id === b.id}
						>
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
								<p><CitedText text={b.body} citations={b.citations} /></p>
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
							<CitedText text={b.body} citations={b.citations} />
						</p>
					{:else}
						<p class="rov-kop">{b.text}</p>
					{/if}
				{/each}
			</div>
		{:else if inhoud.samenvatting}
			<p class="tekst">{inhoud.samenvatting}</p>
		{:else}
			<p class="stil">Tekst niet in de gegevens.</p>
		{/if}
		<p class="verder">
			{#if deel}
				<TekstLink onclick={() => (ruim = !ruim)} aria-pressed={ruim}
					>{ruim ? `Alleen ${ro ?? 'de overweging'}` : 'Overwegingen eromheen'}</TekstLink
				>
			{/if}
			<TekstLink {href}>Lees verder</TekstLink>
		</p>
	{:else if inhoud.soort === 'stuk'}
		{@const rond = citaat ? rondCitaat(inhoud.tekst, citaat) : null}
		{#if rond}
			<p class="tekst">{rond.voor}<mark>{rond.citaat}</mark>{rond.na}</p>
		{:else if openingVan(inhoud.tekst)}
			<p class="tekst">{openingVan(inhoud.tekst)}</p>
		{:else}
			<p class="stil">Tekst nog niet in de gegevens.</p>
		{/if}
		<p class="verder"><TekstLink {href}>Lees verder</TekstLink></p>
	{:else if inhoud.soort === 'wet'}
		{@const bwb = inhoud.bwb}
		{#if inhoud.bij}<p class="stil">{inhoud.bij}</p>{/if}
		<MapRegelingen laad={() => onderWet(bwb)} />
		<p class="verder"><TekstLink {href}>Wet in de lezer</TekstLink></p>
	{:else if inhoud.soort === 'regels'}
		<p class="tekst">{inhoud.tekst}</p>
		<p class="verder"><TekstLink {href}>Lees verder</TekstLink></p>
	{:else}
		<p class="stil">Tekst niet in de gegevens.</p>
		<p class="verder"><TekstLink {href}>Lees verder</TekstLink></p>
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
	.uitspraak {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
	}
	.uitspraak p {
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
	.rov:hover,
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
	.uitspraak .rov-verder {
		position: relative;
		margin-left: calc(3em + var(--s-3));
	}
	.rov-kop {
		font-weight: 600;
	}
	/* The overweging the item keeps, among those around it: the bar of a kept place. */
	.eigen::before {
		content: '';
		position: absolute;
		left: -10px;
		top: var(--s-1);
		bottom: var(--s-1);
		width: 3px;
		background: var(--ink);
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
</style>

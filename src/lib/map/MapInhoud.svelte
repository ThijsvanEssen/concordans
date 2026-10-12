<script lang="ts">
	// What an item of a map shows when its row opens: the place it keeps, read in place, so a
	// map is read without going back and forth (Thijs, 12 Oct). An article its lid in the
	// reader's own text (ArticleText: its references and defined terms as there), Heel artikel
	// a click further; a judgment its overweging (CitedText), the overwegingen around it a
	// click further; a Kamerstuk the words its note quotes in the text around them, else the
	// opening of its text; another bron the lines of its card. Asked when the row opens, once
	// (the readers share the requests). The bron itself stays one step further: Lees verder.
	import type { Schema } from '$lib/api/types';
	import { getArticleDetail, getArticleDetailByKey } from '$lib/api/articles';
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
	import { parseNodeId } from '$lib/vocabulary';
	import { citaatUit, overwegingVan, rondCitaat } from './inhoud';
	import type { MapItem } from './map';

	let { item, href }: { item: MapItem; href: string } = $props();

	type Artikel = Schema<'ArticleDetailResponse'> & { bwb: string };
	type Inhoud =
		| { soort: 'laden' }
		| { soort: 'niets' }
		| { soort: 'artikel'; d: Artikel }
		| { soort: 'uitspraak'; items: BodyItem[]; samenvatting: string | null }
		| { soort: 'stuk'; tekst: string | null }
		| { soort: 'regels'; tekst: string };

	let inhoud = $state<Inhoud>({ soort: 'laden' });
	/** The article around its lid, the overwegingen around one. */
	let ruim = $state(false);

	const tekstVan = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

	async function artikel(key: string): Promise<Artikel | null> {
		const bekend = getArticleDetailByKey(key);
		if (bekend) {
			const d = await bekend;
			return { ...d, bwb: d.article.bwb_id ?? '' };
		}
		const props = ((await getNodeFirst('articles', key)).node.props ?? {}) as Record<
			string,
			unknown
		>;
		const bwb = tekstVan(props.bwb_id) ?? tekstVan(props.celex);
		const nummer = tekstVan(props.article_number);
		return bwb && nummer ? { ...(await getArticleDetail(bwb, nummer)), bwb } : null;
	}

	async function laad(i: MapItem): Promise<Inhoud> {
		const doel = parseNodeId(i.id);
		if (!doel) return { soort: 'niets' };
		if (doel.collection === 'articles') {
			const d = await artikel(doel.key);
			return d ? { soort: 'artikel', d } : { soort: 'niets' };
		}
		if (doel.collection === 'judgments') {
			const ecli = keyEcli(doel.key);
			if (!ecli) return { soort: 'niets' };
			const { judgment: j } = await getJudgmentDetail(ecli);
			const paragraphs = j.paragraphs ?? [];
			return {
				soort: 'uitspraak',
				items: bodyItems(paragraphs.slice(0, signatureStart(paragraphs))),
				samenvatting: tekstVan(j.summary)
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
			/>
		</div>
		{#if item.at}
			<p class="verder">
				<TekstLink onclick={() => (ruim = !ruim)} aria-pressed={ruim}
					>{ruim ? `Alleen ${plaats ?? 'de plaats'}` : 'Heel artikel'}</TekstLink
				>
				<TekstLink {href}>Lees verder</TekstLink>
			</p>
		{:else}
			<p class="verder"><TekstLink {href}>Lees verder</TekstLink></p>
		{/if}
	{:else if inhoud.soort === 'uitspraak'}
		{@const deel = item.at ? overwegingVan(inhoud.items, item.at, ruim) : null}
		{#if deel}
			<div class="uitspraak">
				{#each deel.items as b, k (k)}
					{#if b.kind === 'rov'}
						<div class="rov" class:eigen={ruim && deel.eigen.has(k)}>
							<span class="rov-num">{b.num}</span>
							<p><CitedText text={b.body} citations={b.citations} /></p>
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

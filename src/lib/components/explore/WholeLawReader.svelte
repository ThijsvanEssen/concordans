<script lang="ts">
	import { bewaarItem } from '$lib/map/map';
	import { naamVanId } from '$lib/bron/menselijk';
	import { vandaag } from '$lib/text/datum';
	import { uniqueBy } from '$lib/util/unique';
	import { onderdeelMark } from '$lib/text/article-parts';
	import { api, unwrap } from '$lib/api/client';
	import { report } from '$lib/api/errors';
	import { untrack } from 'svelte';
	import { getArticleDetail, getLawBasis } from '$lib/api/articles';
	import { grondslagKopregel, type KopDeel } from '$lib/text/delegaties';
	import {
		getInstrumentDetail,
		instrumentMetaStore,
		primeInstrumentNames
	} from '$lib/api/instrument-cache';
	import { formatCount } from '$lib/verbonden/filter';
	import { formatLongDate } from './readers/_shared';
	import type { Schema } from '$lib/api/types';
	import ArticleText from '$lib/components/articles/ArticleText.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import { SvelteMap } from 'svelte/reactivity';

	import { bronHref } from '$lib/bron/href';
	import { keepInPlace, scrollInReader } from '$lib/bron/anchor';
	import { parseAnchor } from '$lib/text/anchor';
	import { deelIds, layersOf } from '$lib/text/division';
	import { articleName } from '$lib/text/bw';
	import { page } from '$app/state';
	import ReaderHead from './readers/ReaderHead.svelte';
	import { citeItems } from '$lib/components/ui/cite';
	import { permalink } from '$lib/bron/anchor';
	import { isDay, versionOn, versionsByYear } from './peildatum';
	import { nog, verderLabel, type Richting } from './bladeren';
	import {
		EMPTY_LIST,
		PREVIEW_CHARS,
		createLawList,
		isDivisionAnchor,
		type LawList,
		type Row
	} from './law-list';
	import { kindName, lawFullTitle, lawHeadLine, lawKind, sourceName, treatyLink } from './law-head';
	import { navigate, withParams } from '$lib/util/address';
	import LoadState from '$lib/components/ui/LoadState.svelte';

	let { bwbId }: { bwbId: string } = $props();

	// ?peildatum=2015-01-01: the law as it applied on that day.
	const peildatum = $derived.by(() => {
		const day = page.url.searchParams.get('peildatum');
		return isDay(day) ? day : null;
	});
	const choose = (day: string) => navigate(withParams(page.url, { peildatum: day }));

	type Detail = Schema<'ArticleDetailResponse'>;
	type Version = Schema<'InstrumentVersionDTO'>;

	const today = vandaag();
	let list = $state.raw<LawList>(EMPTY_LIST);
	const lawList = createLawList((l) => (list = l), today);
	const { articles, start, total, firstVersionFrom, status, failure } = $derived(list);
	/** The reader's text, for keeping the article in view when a page goes in above it. */
	let lawEl = $state<HTMLElement | null>(null);
	// A plain `Map` (even inside `$state()`) does not give `.set()`/`.get()` reactivity
	// in Svelte 5, so a mutation here would never re-render the article that just
	// loaded — SvelteMap is reactive on its own and is cleared in place, never reassigned.
	const detailByNumber = new SvelteMap<string, Detail>();
	const pending = new Set<string>();

	async function ensureDetail(bwb: string, articleNumber: string) {
		if (detailByNumber.has(articleNumber) || pending.has(articleNumber)) return;
		pending.add(articleNumber);
		try {
			const detail = await getArticleDetail(bwb, articleNumber);
			if (bwb === bwbId) detailByNumber.set(articleNumber, detail);
		} catch {
			// The preview stays; scrolling back into view retries.
		} finally {
			pending.delete(articleNumber);
		}
	}

	/** Fetches an article's full text once its preview scrolls near the viewport. */
	function lazyLoad(el: HTMLElement, articleNumber: string | null) {
		const bwb = bwbId;
		if (!articleNumber) return {};
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) {
					observer.disconnect();
					void ensureDetail(bwb, articleNumber);
				}
			},
			{ rootMargin: '600px 0px' }
		);
		observer.observe(el);
		return { destroy: () => observer.disconnect() };
	}

	// The law's names for Citeer, as the article reader builds them.
	const citationOf = (articleNumber: string | null, heading: string | null = null) => {
		const meta = $instrumentMetaStore.get(bwbId);
		const title = meta?.citationTitle ?? meta?.title ?? null;
		if (!articleNumber || !title) return null;
		return { articleNumber, heading, shortTitle: meta?.shortTitle ?? null, citationTitle: title };
	};

	const lawName = $derived.by(() => {
		const meta = $instrumentMetaStore.get(bwbId);
		// A record without a BWB id (a treaty of the Verdragenbank) by the title of its detail.
		return (
			meta?.citationTitle ??
			meta?.title ??
			meta?.shortTitle ??
			lawDetail?.citation_title ??
			lawDetail?.title ??
			bwbId
		);
	});

	// The head of the law: its kind, official title, dates and citations, from its own detail.
	// Its dates are those of the law itself (Awb: in force 1 January 1994); the text in force
	// is dated by version_date_in_force (Awb: 15 August 2026).
	let lawDetail = $state<Schema<'InstrumentDetailDTO'> | null>(null);
	$effect(() => {
		lawDetail = null;
		const bwb = bwbId;
		getInstrumentDetail(bwb)
			.then((d) => {
				if (bwb === bwbId) lawDetail = d;
			})
			.catch(() => {});
	});
	const kindLabel = $derived(lawKind(lawDetail));
	const fullTitle = $derived(lawFullTitle(lawDetail, lawName));
	// A treaty: its record in the Verdragenbank, or from there its text in the BWB.
	const treaty = $derived(treatyLink(lawDetail, lawDetail?.same_treaty ?? []));
	// The versions of the law, for the peildatum; the current one dates the text in force
	// where the law gives no version_date_in_force.
	let versions = $state<Version[]>([]);
	/** The list of versions has come in: an empty one means the dataset keeps none. */
	let versionsLoaded = $state(false);
	$effect(() => {
		versions = [];
		versionsLoaded = false;
		const bwb = bwbId;
		const ac = new AbortController();
		unwrap(
			api.GET('/api/instruments/{bwb_id}/versions', {
				params: { path: { bwb_id: bwb } },
				signal: ac.signal
			})
		)
			.then((r) => {
				if (bwb !== bwbId) return;
				versions = uniqueBy(r.items, (v) => v.valid_from ?? v.key);
				versionsLoaded = true;
			})
			.catch(() => {});
		return () => ac.abort();
	});
	const currentVersion = $derived(versions.find((v) => v.current) ?? null);
	const shownVersion = $derived(peildatum ? versionOn(versions, peildatum) : currentVersion);
	const oldest = $derived(
		versions
			.map((v) => v.valid_from ?? '')
			.filter(Boolean)
			.sort()[0]
	);

	// Tekst zoals geldend op 1 januari 2015, versie van 1 januari 2015 tot 1 april 2015.
	const histLine = $derived.by(() => {
		if (!peildatum) return '';
		const v = shownVersion;
		const of = v?.current
			? ', de geldende tekst'
			: v?.valid_from
				? `, versie van ${formatLongDate(v.valid_from)}${v.valid_until ? ` tot ${formatLongDate(v.valid_until)}` : ''}`
				: '';
		return `Tekst zoals geldend op ${formatLongDate(peildatum)}${of}.`;
	});

	// A regulation's grondslag, under its head: the laws its Gelet op names (`/basis`), asked
	// once its detail says it is no wet (a wet has no Gelet op); the articles stand in its
	// group Grondslag in Verbonden, from the same answer.
	let grondslag = $state<KopDeel[]>([]);
	$effect(() => {
		grondslag = [];
		const bwb = bwbId;
		const soort = kindName(lawDetail?.kind);
		if (!/^BWBR/i.test(bwb) || !soort || /wet$/i.test(soort)) return;
		// Without it the head stands without its Gelet op line.
		getLawBasis(bwb).then(
			(b) => {
				if (bwb === bwbId) grondslag = grondslagKopregel(b?.items ?? []);
			},
			(e) => report('Grondslag', e)
		);
	});

	const headLine = $derived(
		lawHeadLine(lawDetail, {
			count: total,
			peildatum,
			currentFrom: currentVersion?.valid_from,
			longDate: (day) => formatLongDate(day),
			formatCount
		})
	);
	const officialUrl = $derived(
		(peildatum ? shownVersion?.official_url : null) ?? lawDetail?.official_url ?? null
	);

	$effect(() => {
		detailByNumber.clear();
		pending.clear();
		const bwb = bwbId;
		const day = peildatum;
		primeInstrumentNames();
		// The division the link names opens alone; a later anchor is the effect below.
		const hash = untrack(() => decodeURIComponent(page.url.hash.slice(1)));
		untrack(() => lawList.open(bwb, day, isDivisionAnchor(hash) ? hash : null));
		return lawList.stop;
	});

	// A link to a place in the law: a division (`#deel-hoofdstuk-3`, from the band Behoort bij
	// or the table of contents) or an article (`#artikel-658`, from the article itself). The
	// pages load up to it, then it scrolls to the top once and the article is marked.
	let doelGezien = '';
	$effect(() => {
		const hash = decodeURIComponent(page.url.hash.slice(1));
		const doel = parseAnchor(hash);
		if (doel?.kind !== 'division' && doel?.kind !== 'article') {
			doelGezien = '';
			return;
		}
		if (status !== 'ready' || doelGezien === hash) return;
		void articles.length;
		// Not an id: on a fresh load the browser would scroll the document itself to it.
		const el = document.querySelector<HTMLElement>(
			doel.kind === 'division'
				? `[data-deel="${CSS.escape(hash)}"]`
				: `[data-artikel="${CSS.escape(doel.number)}"]`
		);
		if (el) {
			doelGezien = hash;
			landOp(el);
		} else if (doel.kind === 'division' && lawList.opensAlone(bwbId, peildatum, hash)) {
			// Another division of the table of contents: it opens alone, as from a link.
			const [bwb, day] = [bwbId, peildatum];
			untrack(() => lawList.open(bwb, day, hash));
		} else if (start > 0 || start + articles.length < total)
			void lawList.reach(hash).then((found) => {
				if (!found) doelGezien = hash;
			});
		else doelGezien = hash;
	});

	/** Scrolls a heading or an article to the top of the reader; an article is marked. */
	function landOp(el: HTMLElement) {
		scrollInReader(el);
		if (!el.matches('.whole-article')) return;
		el.classList.add('is-landed');
		// The click that brought the reader here has passed by the time this runs.
		setTimeout(() =>
			window.addEventListener('click', () => el.classList.remove('is-landed'), { once: true })
		);
	}

	/** The page before the first article shown: the article looked at stays in place. */
	const previous = () =>
		lawList.loadPrevious(() => (lawEl ? keepInPlace(lawEl, '.whole-article') : () => {}));

	// The layers that begin at this article, each once; a layer that is the law itself
	// (Boek 6 of Burgerlijk Wetboek Boek 6) is no heading.
	function newSections(prev: Row | undefined, cur: Row) {
		const before = layersOf(prev?.breadcrumb ?? [], lawName);
		const crumbs = cur.breadcrumb ?? [];
		const layers = layersOf(crumbs, lawName);
		const ids = deelIds(crumbs).slice(crumbs.length - layers.length);
		return layers
			.map((crumb, depth) => ({ ...crumb, depth, id: ids[depth] }))
			.filter((crumb, i) => before[i]?.label !== crumb.label || before[i]?.type !== crumb.type);
	}
</script>

<!-- Paging on through the law, both ways: one control, the same label and count. -->
{#snippet verder(richting: Richting)}
	<p class="whole-verder whole-verder--{richting}">
		{#if status === (richting === 'vorige' ? 'loading-before' : 'loading-more')}Laden…{:else}<TekstLink
				onclick={() => (richting === 'vorige' ? previous() : lawList.loadMore())}
				disabled={status !== 'ready'}
				>{verderLabel(
					richting,
					formatCount(nog(richting, start, articles.length, total))
				)}</TekstLink
			>{/if}
	</p>
{/snippet}

<!-- The head stands on the law's own detail, the cheapest call; the list of its articles
     follows under it (lazy: the text of the head first, Orchestrator 10 Oct). -->
{#if status === 'loading' && !lawDetail}
	<LoadState state={{ status: 'loading' }} what="De wet" form="block" />
{:else if status === 'error'}
	<LoadState
		state={{ status: 'error', error: failure }}
		what="De wet"
		retry={lawList.retry}
		form="block"
	/>
{:else}
	{@const naam = lawName ?? bwbId}
	<article class="whole-law" bind:this={lawEl}>
		<ReaderHead
			collection="instruments"
			title={naam}
			acties={{
				bewaar: bewaarItem(
					`instruments/${bwbId.toLowerCase()}`,
					{ kort: naam, voluit: fullTitle ?? naam },
					{ groep: naam, wet: bwbId }
				),
				cite: citeItems({ kort: naam, voluit: fullTitle ?? lawName }, permalink(page.url, '')),
				naam,
				bron: officialUrl
					? { label: sourceName(officialUrl) ?? 'Officiële tekst', href: officialUrl }
					: null
			}}
		>
			{#snippet soort()}<span>{kindLabel}</span>{/snippet}
			{#snippet onderTitel()}
				{#if fullTitle}<p class="whole-official">{fullTitle}</p>{/if}
			{/snippet}
			<!-- What is on screen and which text: the count, a treaty, the peildatum. -->
			{#snippet status()}
				<span>{headLine}</span>
				{#each grondslag as deel (deel.werkwoord)}
					<p class="whole-count">
						{deel.werkwoord}
						{#each deel.wetten as w, i (w.key)}{#if i > 0}{i === deel.wetten.length - 1
									? ' en '
									: ', '}{/if}<a
								href={bronHref({ collection: 'instruments', key: w.key })}
								data-sveltekit-noscroll>{w.naam}</a
							>{/each}.
					</p>
				{/each}
				{#if treaty}
					<p class="whole-count">
						{#if treaty.target.kind === 'bron'}
							<a
								href={bronHref({ collection: 'instruments', key: treaty.target.key })}
								data-sveltekit-noscroll>{treaty.label}</a
							>
						{:else}
							<a href={treaty.target.url} rel="external">{treaty.label}</a>
						{/if}
					</p>
				{/if}
				{#if versions.length > 0}
					<!-- The peildatum: the versions of the law by year, the text of today first. -->
					<div class="whole-peil">
						<span>Tekst geldend op</span>
						<TekstMenu label="Tekst geldend op" tekst={formatLongDate(peildatum ?? today)}>
							{#snippet inhoud(sluit)}
								<div class="peil-lijst">
									<span class="peil-noot"
										>{formatCount(versions.length)} versies sinds {formatLongDate(
											oldest ?? null
										)}</span
									>
									<button
										type="button"
										role="menuitemradio"
										class="tekstmenu__item peil-menuitem"
										aria-checked={!peildatum}
										onclick={() => {
											sluit();
											choose('');
										}}>{formatLongDate(today)}, vandaag</button
									>
									{#each versionsByYear(versions) as [year, list] (year)}
										<span class="peil-jaar" aria-hidden="true">{year}</span>
										{#each list as v (v.valid_from)}
											<button
												type="button"
												role="menuitemradio"
												class="tekstmenu__item peil-menuitem"
												aria-checked={peildatum === v.valid_from}
												onclick={() => {
													sluit();
													choose(v.valid_from ?? '');
												}}
												>{formatLongDate(v.valid_from ?? null)}{v.current
													? ', geldend'
													: ''}</button
											>
										{/each}
									{/each}
								</div>
							{/snippet}
						</TekstMenu>
					</div>
				{/if}
			{/snippet}
			{#if peildatum && !(versionsLoaded && versions.length === 0)}
				<p class="whole-hist">
					{histLine}
					<a href={withParams(page.url, { peildatum: null })} data-sveltekit-noscroll
						>Naar de geldende tekst</a
					>
				</p>
			{/if}
		</ReaderHead>

		{#if status === 'loading'}
			<LoadState state={{ status: 'loading' }} what="De wet" />
		{:else if peildatum && articles.length === 0}
			{#if firstVersionFrom && peildatum < firstVersionFrom}
				<!-- Before the first toestand: the BWB holds no text of that day. -->
				<p class="whole-before">
					De BWB heeft geen tekst van vóór {formatLongDate(firstVersionFrom)}.
					<a href={withParams(page.url, { peildatum: firstVersionFrom })} data-sveltekit-noscroll
						>Naar de eerste versie</a
					>
				</p>
			{:else if versionsLoaded && versions.length === 0}
				<!-- An act of the EU: the dataset holds its text in force only. -->
				<p class="whole-before">
					Van deze regeling staat alleen de geldende tekst in de gegevens.
					<a href={withParams(page.url, { peildatum: null })} data-sveltekit-noscroll
						>Naar de geldende tekst</a
					>
				</p>
			{:else}
				<p class="whole-empty-text stil">
					Geen tekst van deze regeling op {formatLongDate(peildatum)}.
				</p>
			{/if}
		{/if}

		{#if status !== 'loading' && articles.length > 0 && start > 0}
			{@render verder('vorige')}
		{/if}

		{#each articles as a, i (a.id)}
			{#each newSections(articles[i - 1], a) as section, j (j)}
				<!-- The designation once (Hoofdstuk 3), the heading under it; deeper layers on one line. -->
				<h2
					class="whole-section whole-section--depth-{Math.min(section.depth, 2)}"
					data-deel={section.id}
				>
					{#if section.title}
						<span class="whole-section-label">{section.label}</span>
						<span class="whole-section-title">{section.title}</span>
					{:else}
						<span class="whole-section-title">{section.label}</span>
					{/if}
				</h2>
			{/each}

			{@const address = a.address}
			{@const detail = address && !peildatum ? detailByNumber.get(address) : undefined}
			{@const name = articleName(bwbId, a.article_number, a.label) ?? naamVanId(a.id)}
			<section
				class="whole-article"
				id="article-{address}"
				data-artikel={a.article_number ?? address}
				use:lazyLoad={peildatum || a.textToday ? null : address}
			>
				<div class="whole-article-head">
					<!-- The anchor of reading: Artikel 3:4, a BW article with its book (6:162). -->
					{#if a.key}
						<a
							class="whole-article-jump"
							href={bronHref(
								{ collection: 'articles', key: a.key },
								{ params: peildatum ? { peildatum } : {} }
							)}
							data-sveltekit-noscroll><span class="whole-art-num">{name}</span></a
						>
					{:else}
						<span class="whole-art-num">{name}</span>
						<span class="whole-art-note">niet meer in de geldende tekst</span>
					{/if}
				</div>

				{#if a.text}
					<ArticleText text={a.text} parts={a.parts} citation={null} mark={onderdeelMark(bwbId)} />
				{:else if a.textToday}
					<ArticleText
						text={a.textToday}
						parts={a.partsToday}
						citation={citationOf(address, a.article_number ? null : (a.label ?? null))}
						mark={onderdeelMark(bwbId)}
					/>
				{:else if detail}
					<ArticleText
						text={detail.article.text}
						parts={detail.article.parts}
						citation={citationOf(address, a.article_number ? null : (a.label ?? null))}
						mark={onderdeelMark(bwbId)}
					/>
				{:else if a.text_preview}
					<p class="whole-text">
						{a.text_preview}{a.text_preview.length >= PREVIEW_CHARS ? '…' : ''}
					</p>
				{:else}
					<p class="whole-text">
						<span class="whole-empty-text stil">Tekst niet in de gegevens.</span>
					</p>
				{/if}
			</section>
		{/each}

		{#if status !== 'loading' && start + articles.length < total}
			{@render verder('volgende')}
		{/if}
	</article>
{/if}

<style>
	/* The reader frame sets the margins and the width, as for every reader. */
	.whole-law {
		width: 100%;
	}

	.whole-count {
		margin: var(--s-2) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.whole-official {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-style: italic;
		color: var(--ink-2);
		max-width: 68ch;
	}
	.whole-count a {
		color: inherit;
		text-decoration: none;
		border-bottom: 1px solid var(--rule-strong);
	}
	.whole-count a:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}

	/* The peildatum: a list that reads as a line of the head. */
	.whole-peil {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-1) var(--s-2);
		margin-top: var(--s-3);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink-2);
	}
	.peil-lijst {
		display: flex;
		flex-direction: column;
		max-height: 60vh;
		overflow-y: auto;
	}
	.peil-noot,
	.peil-jaar {
		padding: var(--s-1) var(--s-3);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.peil-jaar {
		padding-top: var(--s-2);
		font-weight: 600;
	}
	.peil-menuitem {
		white-space: nowrap;
	}
	/* A text of an earlier day says so, with the way back. */
	.whole-hist {
		margin: var(--s-3) 0 0;
		padding: var(--s-2) var(--s-3);
		background: var(--paper-2);
		border-radius: var(--r-1);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	.whole-hist a {
		color: var(--ink);
	}
	.whole-before {
		margin: var(--s-5) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		color: var(--ink-2);
	}
	.whole-before a {
		color: var(--ink);
	}
	.whole-art-note {
		margin-left: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	.whole-section {
		display: flex;
		flex-direction: column;
		margin: var(--s-6) 0 0;
		font-family: var(--font-serif);
		font-weight: 400;
		color: var(--ink);
		text-wrap: balance;
	}
	.whole-section-label {
		font-size: var(--t-body-2);
		color: var(--ink-3);
	}
	.whole-section-title {
		font-size: var(--t-h3);
		font-weight: 600;
		line-height: var(--lh-snug);
	}
	/* The outer layer: a rule above, the heading larger. */
	.whole-section--depth-0 {
		margin-top: var(--s-8);
		padding-top: var(--s-5);
		border-top: 1px solid var(--rule);
	}
	/* The first right under the head: its rule is the one line between head and text, with
	   the head's own step above it (Thijs, 10 Oct: "Deze dubbele lijn is ook niet top"). */
	.whole-law > .whole-section--depth-0:first-of-type {
		margin-top: 0;
	}
	.whole-section--depth-0 .whole-section-label {
		font-size: var(--t-body);
	}
	.whole-section--depth-0 .whole-section-title {
		font-size: var(--t-h2);
		line-height: var(--lh-tight);
	}
	/* Paragraaf and deeper: one line, the heading in italics. */
	.whole-section--depth-2 {
		flex-direction: row;
		flex-wrap: wrap;
		gap: 0 var(--s-2);
		align-items: baseline;
		margin-top: var(--s-5);
	}
	.whole-section--depth-2 .whole-section-label {
		font-size: var(--t-body);
		color: var(--ink-2);
	}
	.whole-section--depth-2 .whole-section-title {
		font-size: var(--t-body);
		font-weight: 400;
		font-style: italic;
		color: var(--ink-2);
	}

	.whole-article {
		margin: var(--s-6) 0 0;
	}

	.whole-article-head {
		margin-bottom: var(--s-1);
	}
	/* The article a link landed on (#artikel-658): its number washed until the next click. */
	.whole-article:global(.is-landed) .whole-art-num {
		background: var(--wassing);
		box-shadow: 0 0 0 var(--s-1) var(--wassing);
	}

	.whole-article-jump {
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
		display: inline-flex;
		align-items: baseline;
		gap: var(--s-2);
		text-align: left;
	}

	.whole-art-num {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		font-weight: 600;
		color: var(--ink);
	}

	.whole-article-jump:hover .whole-art-num {
		color: var(--ink);
		text-decoration: underline;
	}

	.whole-text {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		white-space: pre-line;
	}

	.whole-verder {
		margin: var(--s-6) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
		text-align: center;
	}
	/* Above the text: the step under it is the first heading's own. */
	.whole-verder--vorige {
		margin: 0 0 var(--s-5);
	}

	.whole-empty-text {
		margin: 0;
	}
</style>

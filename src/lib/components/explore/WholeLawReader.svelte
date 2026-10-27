<script lang="ts">
	import { bewaarItem } from '$lib/map/map';
	import { langeDatum, onDate, untilDate, vandaag } from '$lib/text/datum';
	import { report } from '$lib/api/errors';
	import { getContext, untrack } from 'svelte';
	import { WAIT_KEY, type FrameWait } from './search-state.svelte';
	import { getArticleDetail, getLawBasis } from '$lib/api/articles';
	import { basisHeadLines, type BasisPart } from '$lib/text/delegaties';
	import {
		getInstrumentDetail,
		instrumentMetaStore,
		primeInstrumentNames
	} from '$lib/api/instrument-cache';
	import { lawName } from '$lib/text/instrument-meta';
	import { formatCount } from '$lib/text/getal';
	import type { Schema } from '$lib/api/types';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import { SvelteMap } from 'svelte/reactivity';

	import { bronHref } from '$lib/bron/href';
	import { keepInPlace, scrollInReader } from '$lib/bron/landing';
	import { parseAnchor } from '$lib/text/anchor';
	import { newSections } from '$lib/text/division';
	import { page } from '$app/state';
	import ReaderHead from './readers/ReaderHead.svelte';
	import { citeItems } from '$lib/components/ui/cite-items';
	import { permalink } from '$lib/bron/landing';
	import { peildatumVersions, versionOn } from './peildatum';
	import { isDay } from '$lib/text/datum';
	import { nog, type Richting } from './law-paging';
	import { EMPTY_LIST, createLawList, isDivisionAnchor, type LawList } from './law-list';
	import { lawNodeKey } from '$lib/text/enacted-law';
	import { setOwnLaw } from '$lib/text/own-article.svelte';
	import {
		lawCitationRecord,
		lawFullTitle,
		lawHeadFacts,
		lawKind,
		sourceName,
		treatyLink
	} from '$lib/text/law-head';
	import { kindName } from '$lib/text/law-kind';
	import { navigate, withParams } from '$lib/util/address';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { load } from '$lib/util/load.svelte';
	import AlleN from '$lib/components/ui/AlleN.svelte';
	import WholeLawReaderArticle from './WholeLawReaderArticle.svelte';
	import WholeLawReaderPeildatum from './WholeLawReaderPeildatum.svelte';
	import MinistryLink from '$lib/bron/MinistryLink.svelte';
	import Coverage from '$lib/components/ui/Coverage.svelte';
	import Validity from '$lib/components/ui/Validity.svelte';
	import Feiten from '$lib/components/ui/Feiten.svelte';
	import FullTitle from '$lib/components/ui/FullTitle.svelte';
	import Veld from '$lib/components/ui/Veld.svelte';
	import { validityOf } from '$lib/api/validity';
	import { statusOf } from '$lib/text/validity';
	import { coverageLine } from '$lib/text/coverage';
	import { followPosition } from './law-position.svelte';
	import { afterTick } from '$lib/util/after-tick';
	import { readerReady } from '$lib/first-paint/takeover';

	let { bwbId }: { bwbId: string } = $props();
	setOwnLaw(() => bwbId);

	// ?peildatum=2015-01-01: the law as it applied on that day.
	const peildatum = $derived.by(() => {
		const day = page.url.searchParams.get('peildatum');
		return isDay(day) ? day : null;
	});
	const choose = (day: string) => navigate(withParams(page.url, { peildatum: day }));

	type Detail = Schema<'ArticleDetailResponse'>;

	const today = vandaag();
	let list = $state.raw<LawList>(EMPTY_LIST);
	const lawList = createLawList((l) => (list = l), today);
	const { articles, start, total, firstVersionFrom, status, failure, pageFailure } = $derived(list);
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
		} catch (e) {
			// The preview stays.
			report('Artikeltekst', e);
		} finally {
			pending.delete(articleNumber);
		}
	}

	// The law's names for Citeer, as the article reader builds them.
	const citationOf = (articleNumber: string | null, heading: string | null = null) => {
		const meta = $instrumentMetaStore.get(bwbId);
		const title = lawName(meta, null);
		if (!articleNumber || !title) return null;
		return { articleNumber, heading, shortTitle: meta?.shortTitle ?? null, citationTitle: title };
	};

	// A record without a BWB id (a treaty of the Verdragenbank) by the title of its detail.
	const lawTitle = $derived.by(() =>
		lawName($instrumentMetaStore.get(bwbId), lawDetail?.citation_title ?? lawDetail?.title ?? bwbId)
	);

	// The head of the law: its kind, official title, dates and citations, from its own detail.
	// Its dates are those of the law itself (Awb: in force 1 January 1994); the text in force
	// is dated by version_date_in_force (Awb: 15 August 2026).
	// A failure is a line in the head; the list stands on its own call.
	const detail = load(() => bwbId, getInstrumentDetail, 'Wet, gegevens');
	const lawDetail = $derived(detail.state.status === 'ready' ? detail.state.data : null);
	// Whether it holds, once, in the line of the head (undefined: an API without it).
	const validity = $derived(validityOf(lawDetail));
	const verlopen = $derived(validity?.state === 'expired');
	const kindLabel = $derived(lawKind(lawDetail));
	const fullTitle = $derived(lawFullTitle(lawDetail, lawTitle));
	// Its heading and its citations: the name it goes by with the abbreviation it is cited by
	// (`Algemene verordening gegevensbescherming (AVG)`), Citeer short and in full.
	const record = $derived(lawCitationRecord(bwbId, lawDetail, $instrumentMetaStore.get(bwbId)));
	// A treaty: its record in the Verdragenbank, or from there its text in the BWB.
	const treaty = $derived(treatyLink(lawDetail, lawDetail?.same_treaty ?? []));
	// The versions of the law, for the peildatum; the current one dates the text in force
	// where the law gives no version_date_in_force.
	const versionList = load(() => bwbId, peildatumVersions, 'Tekstversies');
	const versions = $derived(versionList.state.status === 'ready' ? versionList.state.data : []);
	/** The list of versions has come in: an empty one means the dataset keeps none. */
	const versionsLoaded = $derived(versionList.state.status === 'ready');
	const currentVersion = $derived(versions.find((v) => v.current) ?? null);
	const shownVersion = $derived(peildatum ? versionOn(versions, peildatum) : currentVersion);

	// Tekst zoals geldend op 1 januari 2015, versie van 1 januari 2015 tot 1 april 2015.
	const histLine = $derived.by(() => {
		if (!peildatum) return '';
		const v = shownVersion;
		const of = v?.current
			? `, de ${verlopen ? 'laatste' : 'geldende'} tekst`
			: v?.valid_from
				? `, versie van ${langeDatum(v.valid_from)}${v.valid_until ? ` ${untilDate(v.valid_until)}` : ''}`
				: '';
		return `Tekst zoals geldend ${onDate(peildatum)}${of}.`;
	});

	// A regulation's grondslag, under its head: the laws its Gelet op names (`/basis`), asked
	// once its detail says it is no wet (a wet has no Gelet op); the articles stand in its
	// group Grondslag in Verbonden, from the same answer.
	let grondslag = $state<BasisPart[]>([]);
	/** The laws of a Gelet op named first; the rest opens in place. */
	const GROUNDS_SHOWN = 3;
	let allGrounds = $state(new Set<string>());
	$effect(() => {
		grondslag = [];
		const bwb = bwbId;
		const soort = kindName(lawDetail?.kind);
		if (!/^BWBR/i.test(bwb) || !soort || /wet$/i.test(soort)) return;
		// Without it the head stands without its Gelet op line.
		getLawBasis(bwb).then(
			(b) => {
				if (bwb === bwbId) grondslag = basisHeadLines(b?.items ?? []);
			},
			(e) => report('Grondslag', e)
		);
	});

	// Verbonden under the text waits for the first page of articles (ReaderFrame, T9).
	const wait = getContext<FrameWait | undefined>(WAIT_KEY);
	$effect(() => wait?.(() => status === 'loading'));

	const headFacts = $derived(
		lawHeadFacts(lawDetail, {
			count: total,
			peildatum,
			currentFrom: currentVersion?.valid_from,
			longDate: (day) => langeDatum(day),
			formatCount,
			validity
		})
	);
	const officialUrl = $derived(
		(peildatum ? shownVersion?.official_url : null) ?? lawDetail?.official_url ?? null
	);
	const officialSource = $derived(
		officialUrl ? { label: sourceName(officialUrl) ?? 'Officiële tekst', href: officialUrl } : null
	);
	// What the dataset lacks of the law, said once in the head (Dekking): an act of the EU has
	// its text as adopted only; a regeling of the BWB without articles has no text read, and a
	// publication says its text is at its source (`completeness.text` not_fetched). A
	// treaty of the BWB counts 0 articles but lists them, so the list decides.
	const textNotRead = $derived(
		!peildatum && lawDetail?.article_count === 0 && status === 'ready' && total === 0
	);
	const lacksArticles = $derived(
		lawDetail?.article_count === 0 && (status !== 'ready' || total === 0)
	);
	const isEu = $derived(lawDetail?.jurisdiction === 'eu');
	// The cell of the peildatum keeps its place while the versions come, so the cells after it
	// do not move (V4); an act of the EU has its text as adopted only, and no versions.
	const peildatumShown = $derived(
		!lacksArticles &&
			!isEu &&
			(versions.length > 0 || (versionList.state.status === 'loading' && !!lawDetail))
	);
	const hasStatus = $derived(
		!!statusOf(validity, 'wet') ||
			textNotRead ||
			isEu ||
			!!coverageLine(lawDetail?.completeness) ||
			detail.state.status === 'error' ||
			versionList.state.status === 'error' ||
			grondslag.length > 0 ||
			!!lawDetail?.ministry ||
			!!treaty
	);
	const withFacts = $derived(
		headFacts.dates.length > 0 || headFacts.counts.length > 0 || peildatumShown
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
	let landedHash = '';
	$effect(() => {
		const hash = decodeURIComponent(page.url.hash.slice(1));
		const target = parseAnchor(hash);
		if (target?.kind !== 'division' && target?.kind !== 'article') {
			landedHash = '';
			return;
		}
		if (status !== 'ready' || landedHash === hash) return;
		void articles.length;
		// Not an id: on a fresh load the browser would scroll the document itself to it.
		const el = document.querySelector<HTMLElement>(
			target.kind === 'division'
				? `[data-deel="${CSS.escape(hash)}"]`
				: `[data-artikel="${CSS.escape(target.number)}"]`
		);
		if (el) {
			landedHash = hash;
			landAt(el);
		} else if (target.kind === 'division' && lawList.opensAlone(bwbId, peildatum, hash)) {
			// Another division of the table of contents: it opens alone, as from a link.
			const [bwb, day] = [bwbId, peildatum];
			untrack(() => lawList.open(bwb, day, hash));
		} else if (start > 0 || start + articles.length < total)
			lawList.reach(hash).then(
				(found) => {
					if (!found) landedHash = hash;
				},
				(e) => report('Wet plek', e)
			);
		else landedHash = hash;
	});

	/** Scrolls a heading or an article to the top of the reader; an article is marked. */
	function landAt(el: HTMLElement) {
		scrollInReader(el);
		position?.read();
		if (!el.matches('.whole-article')) return;
		el.classList.add('is-landed');
		// The click that brought the reader here has passed by the time this runs.
		setTimeout(() =>
			window.addEventListener('click', () => el.classList.remove('is-landed'), { once: true })
		);
	}

	// The article at the top of the text, for the table of contents (K3): read when the reader
	// scrolls, and at once after a jump or a new page of articles, where nothing scrolls (B4).
	let position: ReturnType<typeof followPosition> | null = null;
	$effect(() => {
		const el = lawEl;
		const bwb = bwbId;
		if (!el) return;
		const follow = followPosition(el, bwb);
		position = follow;
		return () => {
			follow.stop();
			if (position === follow) position = null;
		};
	});
	$effect(() => {
		void articles;
		if (status === 'ready') position?.read();
	});

	// Its first articles are in: the first paint of the address gives the column to the reader
	// once they stand where its own do (lib/first-paint/takeover.ts).
	$effect(() => {
		if (status === 'ready' && articles.length > 0) afterTick(readerReady);
	});

	/** The page before the first article shown: the article looked at stays in place. */
	const previous = () =>
		lawList.loadPrevious(() => (lawEl ? keepInPlace(lawEl, '.whole-article') : () => {}));
</script>

<!-- Paging on through the law, both ways: one control, the same label and count. -->
{#snippet verder(richting: Richting)}
	<div class="whole-verder whole-verder--{richting}">
		{#if pageFailure?.richting === richting}<LoadState
				state={{ status: 'error', error: pageFailure.error }}
				what={richting === 'vorige' ? 'Wat eraan voorafgaat' : 'Het vervolg van de wet'}
				retry={lawList.retry}
			/>{:else}<AlleN
				volgende
				woord={richting === 'vorige' ? 'Vorige' : 'Volgende'}
				noun="artikelen"
				rest={nog(richting, start, articles.length, total)}
				laden={status === (richting === 'vorige' ? 'loading-before' : 'loading-more')}
				onclick={() =>
					status === 'ready' && (richting === 'vorige' ? previous() : lawList.loadMore())}
			/>{/if}
	</div>
{/snippet}

<!-- What the head says besides its facts: whether the law holds, what of it is read, a
     failure, its grondslag, a treaty. Only where it says something: no empty line (A190). -->
{#snippet lawStatus()}
	<Validity {validity} soort="wet" />
	{#if lawDetail?.ministry}
		<span
			>Ministerie: <MinistryLink
				ministry={lawDetail.ministry}
				name={lawDetail.ministry_name}
			/>.</span
		>
	{/if}
	{#if textNotRead}
		<p class="whole-count">
			<Coverage noText coverage={lawDetail?.completeness} bron={officialSource} />
		</p>
	{:else if isEu}
		<p class="whole-count">
			<Coverage
				coverage={{ versions: { state: 'not_in_source', as_of: lawDetail?.date_signed } }}
				bron={officialSource && { ...officialSource, label: 'EUR-Lex' }}
			/>
		</p>
	{:else if coverageLine(lawDetail?.completeness)}
		<!-- A law of the Staatsblad: what of its references and definitions is read. -->
		<p class="whole-count"><Coverage coverage={lawDetail?.completeness} /></p>
	{/if}
	{#if detail.state.status === 'error'}
		<LoadState state={detail.state} what="De gegevens van de wet" retry={detail.retry} />
	{/if}
	{#if versionList.state.status === 'error'}
		<LoadState state={versionList.state} what="De tekstversies" plural retry={versionList.retry} />
	{/if}
	<!-- A regulation on many laws names the first three, the rest one click away in place (R3-L
	     F8): its head is no wall of links above its facts. -->
	{#each grondslag as deel (deel.werkwoord)}
		{@const all = allGrounds.has(deel.werkwoord)}
		{@const shown = all ? deel.wetten : deel.wetten.slice(0, GROUNDS_SHOWN)}
		{@const rest = deel.wetten.length - shown.length}
		<p class="whole-count">
			{deel.werkwoord}
			{#each shown as w, i (w.key)}{#if i > 0}{i === shown.length - 1 && !rest
						? ' en '
						: ', '}{/if}<a
					href={bronHref({ collection: 'instruments', key: w.key })}
					data-sveltekit-noscroll>{w.naam}</a
				>{/each}{rest > 0 ? ' en ' : ''}{#if rest > 0}<TekstLink
					onclick={() => (allGrounds = new Set([...allGrounds, deel.werkwoord]))}
					>{rest} andere</TekstLink
				>{/if}.
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
{/snippet}

<!-- The facts of the law, each once (E9), a strip of their own under its title (A190): its
     dates, the text of which day (the peildatum), its articles, how often it is cited. -->
{#snippet factStrip()}
	<Feiten strip label="Kenmerken">
		{#each headFacts.dates as f (f.label)}<Veld label={f.label} value={f.value} />{/each}
		{#if peildatumShown}
			<WholeLawReaderPeildatum asFact {versions} {peildatum} {today} {choose} {verlopen} />
		{/if}
		{#each headFacts.counts as f (f.label)}<Veld label={f.label} value={f.value} />{/each}
	</Feiten>
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
	<article class="whole-law" bind:this={lawEl}>
		<ReaderHead
			collection="instruments"
			{kindLabel}
			title={record.heading}
			facts={withFacts ? factStrip : undefined}
			statusLine={hasStatus ? lawStatus : undefined}
			acties={{
				bewaar: bewaarItem(
					`instruments/${lawNodeKey(bwbId)}`,
					{ kort: record.short, voluit: record.full },
					{ groep: lawTitle, wet: bwbId }
				),
				cite: citeItems(record, permalink(page.url, '')),
				naam: record.short,
				bron: officialSource
			}}
		>
			{#snippet onderTitel()}
				{#if fullTitle}<FullTitle title={fullTitle} />{/if}
			{/snippet}
			{#if peildatum && !(versionsLoaded && versions.length === 0)}
				<p class="whole-hist">
					{histLine}
					<a href={withParams(page.url, { peildatum: null })} data-sveltekit-noscroll
						>Naar de {verlopen ? 'laatste' : 'geldende'} tekst</a
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
					De BWB heeft geen tekst van vóór {langeDatum(firstVersionFrom)}.
					<a href={withParams(page.url, { peildatum: firstVersionFrom })} data-sveltekit-noscroll
						>Naar de eerste versie</a
					>
				</p>
			{:else if versionsLoaded && versions.length === 0 && isEu}
				<!-- An act of the EU: its text as adopted, on any day. The head says so once
				     (Dekking); here only the way back to it. -->
				<p class="whole-before">
					<a href={withParams(page.url, { peildatum: null })} data-sveltekit-noscroll
						>Naar de tekst zoals vastgesteld</a
					>
				</p>
			{:else if versionsLoaded && versions.length === 0}
				<!-- A record without versions in the dataset: its text in force only. -->
				<p class="whole-before">
					Van deze regeling staat alleen de geldende tekst in de gegevens.
					<a href={withParams(page.url, { peildatum: null })} data-sveltekit-noscroll
						>Naar de geldende tekst</a
					>
				</p>
			{:else}
				<p class="whole-empty-text stil">
					Geen tekst van deze regeling {onDate(peildatum)}.
				</p>
			{/if}
		{/if}

		{#if status !== 'loading' && articles.length > 0 && start > 0}
			{@render verder('vorige')}
		{/if}

		{#each articles as a, i (a.id)}
			{#each newSections(articles[i - 1], a, lawTitle) as section, j (j)}
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

			<WholeLawReaderArticle
				row={a}
				{bwbId}
				{peildatum}
				detail={a.address ? detailByNumber.get(a.address) : undefined}
				{citationOf}
				onNear={(n) => void ensureDetail(bwbId, n)}
			/>
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

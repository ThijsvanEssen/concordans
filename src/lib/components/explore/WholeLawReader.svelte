<script lang="ts">
	import { uniqueBy } from '$lib/util/unique';
	import { onderdeelMark } from '$lib/text/article-parts';
	import { api, unwrap } from '$lib/api/client';
	import { getArticleDetail } from '$lib/api/articles';
	import {
		getInstrumentDetail,
		instrumentMetaStore,
		primeInstrumentNames
	} from '$lib/api/instrument-cache';
	import { formatCount } from '$lib/verbonden/filter';
	import { formatLongDate } from './readers/_shared';
	import type { Schema } from '$lib/api/types';
	import ArticleText from '$lib/components/articles/ArticleText.svelte';
	import { SvelteMap } from 'svelte/reactivity';

	import { bronHref } from '$lib/bron/href';
	import { layersOf } from '$lib/text/division';
	import { articleName } from '$lib/text/bw';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { atArticles, isDay, versionOn, versionsByYear } from './peildatum';

	let { bwbId }: { bwbId: string | null } = $props();

	// The overview lists every article of the law with a preview only: at full text and
	// parts per article, 810 articles would balloon the payload. The full, leden-structured
	// text of an article is fetched only once it scrolls into view (`lazyLoad` below),
	// through the same per-article endpoint the article reader already uses.
	const PREVIEW_CHARS = 600;
	const PAGE_SIZE = 100;

	type Detail = Schema<'ArticleDetailResponse'>;
	type Version = Schema<'InstrumentVersionDTO'>;
	/** An article as the list shows it, of today or of the peildatum. */
	type Row = {
		id: string;
		/** The article to link to; null for one that is no longer in the law. */
		key: string | null;
		article_number: string | null;
		label: string | null;
		address: string | null;
		breadcrumb: Schema<'InstrumentArticleNodeDTO'>['breadcrumb'];
		/** The whole text of an old version, which comes with the list. */
		text: string | null;
		text_preview: string | null;
	};

	// ?peildatum=2015-01-01: the law as it applied on that day.
	const peildatum = $derived.by(() => {
		const day = page.url.searchParams.get('peildatum');
		return isDay(day) ? day : null;
	});
	const withParams = (params: Record<string, string | null>) => {
		const url = new URL(page.url);
		for (const [k, v] of Object.entries(params))
			if (v === null) url.searchParams.delete(k);
			else url.searchParams.set(k, v);
		return `${url.pathname}?${url.searchParams.toString().replaceAll('%2F', '/').replaceAll('%2C', ',')}`;
	};
	const choose = (day: string) =>
		goto(withParams({ peildatum: day || null }), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});

	let articles = $state<Row[]>([]);
	let total = $state(0);
	let status = $state<'idle' | 'loading' | 'loading-more' | 'ready' | 'error'>('idle');
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
		if (!bwb || !articleNumber) return {};
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
		const meta = bwbId ? $instrumentMetaStore.get(bwbId) : null;
		const title = meta?.citationTitle ?? meta?.title ?? null;
		if (!articleNumber || !title) return null;
		return { articleNumber, heading, shortTitle: meta?.shortTitle ?? null, citationTitle: title };
	};

	const lawName = $derived.by(() => {
		const meta = bwbId ? $instrumentMetaStore.get(bwbId) : null;
		return meta?.citationTitle ?? meta?.title ?? meta?.shortTitle ?? bwbId;
	});

	// The head of the law: its kind, official title, dates and citations, from its own detail.
	// Its dates are those of the version in force (Awb: 2013), not of the first enactment.
	let lawDetail = $state<Schema<'InstrumentDetailDTO'> | null>(null);
	$effect(() => {
		lawDetail = null;
		const bwb = bwbId;
		if (!bwb) return;
		getInstrumentDetail(bwb)
			.then((d) => {
				if (bwb === bwbId) lawDetail = d;
			})
			.catch(() => {});
	});
	const KIND: Record<string, string> = {
		wet: 'Wet',
		verdrag: 'Verdrag',
		bilateraalverdrag: 'Bilateraal verdrag',
		multilateraalverdrag: 'Multilateraal verdrag'
	};
	const kindLabel = $derived((lawDetail?.kind && KIND[lawDetail.kind]) || 'Regeling');
	// The versions of the law, for the peildatum; the current one dates the text in force
	// (Awb: 15 August 2026). `date_in_force` is not that date (Awb: 2013).
	let versions = $state<Version[]>([]);
	$effect(() => {
		versions = [];
		const bwb = bwbId;
		if (!bwb) return;
		const ac = new AbortController();
		unwrap(
			api.GET('/api/instruments/{bwb_id}/versions', {
				params: { path: { bwb_id: bwb } },
				signal: ac.signal
			})
		)
			.then((r) => {
				if (bwb === bwbId) versions = uniqueBy(r.items, (v) => v.valid_from ?? v.key);
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
	const today = new Date().toISOString().slice(0, 10);

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

	// The head in sentences: 587 artikelen. Geldende tekst: versie van 15 augustus 2026.
	const headLine = $derived(
		[
			`${formatCount(peildatum ? total : (lawDetail?.article_count ?? total))} artikelen.`,
			!peildatum && currentVersion?.valid_from
				? `Geldende tekst: versie van ${formatLongDate(currentVersion.valid_from)}.`
				: null,
			lawDetail?.inbound_citation_count
				? `${formatCount(lawDetail.inbound_citation_count)} keer aangehaald.`
				: null
		]
			.filter(Boolean)
			.join(' ')
	);
	const officialUrl = $derived(
		(peildatum ? shownVersion?.official_url : null) ?? lawDetail?.official_url ?? null
	);

	// The articles of today, in pages; the place of an article of an earlier day is read
	// from today's list, once per law.
	const todayList = new Map<string, Promise<Schema<'InstrumentArticleNodeDTO'>[]>>();
	function articlesNow(bwb: string) {
		let list = todayList.get(bwb);
		if (!list) {
			list = unwrap(
				api.GET('/api/instruments/{bwb_id}/articles', {
					params: { path: { bwb_id: bwb }, query: { text_preview_chars: 0, limit: 2000 } }
				})
			).then((r) => r.items);
			list.catch(() => todayList.delete(bwb));
			todayList.set(bwb, list);
		}
		return list;
	}

	async function load(
		bwb: string,
		day: string | null,
		offset: number,
		signal?: AbortSignal
	): Promise<{ items: Row[]; total: number }> {
		if (day) {
			// The whole text of each old version comes with the list: there is no call per
			// article for a version. From W2 the API gives `text` only when asked; the types do
			// not know `include_text` yet, so the query is not a literal.
			// TODO(backend W2): into the literal once the types are synced.
			const query = {
				text_preview_chars: PREVIEW_CHARS,
				limit: PAGE_SIZE,
				offset,
				include_text: true
			};
			const [at, now] = await Promise.all([
				unwrap(
					api.GET('/api/instruments/{bwb_id}/articles/at/{at_date}', {
						params: { path: { bwb_id: bwb, at_date: day }, query },
						signal
					})
				),
				articlesNow(bwb)
			]);
			return {
				total: at.total,
				items: atArticles(at.items, now).map((a) => ({ ...a, address: a.article_number }))
			};
		}
		const r = await unwrap(
			api.GET('/api/instruments/{bwb_id}/articles', {
				params: {
					path: { bwb_id: bwb },
					query: { text_preview_chars: PREVIEW_CHARS, limit: PAGE_SIZE, offset }
				},
				signal
			})
		);
		return {
			total: r.total,
			items: r.items.map((a) => ({
				id: a.id,
				key: a.key,
				article_number: a.article_number ?? null,
				label: a.label ?? null,
				address: a.article_number ?? a.address ?? null,
				breadcrumb: a.breadcrumb ?? [],
				text: null,
				text_preview: a.text_preview ?? null
			}))
		};
	}

	$effect(() => {
		articles = [];
		detailByNumber.clear();
		pending.clear();
		if (!bwbId) {
			status = 'idle';
			return;
		}
		primeInstrumentNames();
		const controller = new AbortController();
		status = 'loading';
		load(bwbId, peildatum, 0, controller.signal)
			.then((first) => {
				articles = first.items;
				total = first.total;
				status = 'ready';
			})
			.catch(() => {
				if (!controller.signal.aborted) status = 'error';
			});
		return () => controller.abort();
	});

	async function loadMore() {
		if (!bwbId || status !== 'ready') return;
		const bwb = bwbId;
		status = 'loading-more';
		try {
			const day = peildatum;
			const next = await load(bwb, day, articles.length);
			if (bwb === bwbId && day === peildatum)
				articles = uniqueBy([...articles, ...next.items], (a) => a.id);
		} catch {
			// The articles already shown stay; the button remains for another attempt.
		}
		status = 'ready';
	}

	// The layers that begin at this article, each once; a layer that is the law itself
	// (Boek 6 of Burgerlijk Wetboek Boek 6) is no heading.
	function newSections(prev: Row | undefined, cur: Row) {
		const before = layersOf(prev?.breadcrumb ?? [], lawName);
		return layersOf(cur.breadcrumb ?? [], lawName)
			.map((crumb, depth) => ({ ...crumb, depth }))
			.filter((crumb, i) => before[i]?.label !== crumb.label || before[i]?.type !== crumb.type);
	}
</script>

{#if status === 'idle'}
	<div class="whole-empty"></div>
{:else if status === 'loading'}
	<div class="whole-loading">
		<div class="spinner" aria-hidden="true"></div>
		<span>Laden…</span>
	</div>
{:else if status === 'error'}
	<div class="whole-error">Wet niet geladen.</div>
{:else}
	<article class="whole-law">
		<header class="whole-head">
			<span class="whole-kind">{kindLabel}</span>
			<h1 class="whole-title">{lawName}</h1>
			{#if lawDetail?.official_title && lawDetail.official_title !== lawName}
				<p class="whole-official">{lawDetail.official_title}</p>
			{/if}
			<p class="whole-count">
				{headLine}
				{#if officialUrl}<a href={officialUrl} rel="external">wetten.overheid.nl</a>{/if}
			</p>
			{#if versions.length > 0}
				<!-- The peildatum: the versions of the law by year, the text of today first. -->
				<div class="whole-peil">
					<label for="peildatum-{bwbId}">Tekst geldend op</label>
					<select
						id="peildatum-{bwbId}"
						class="whole-peil-pick"
						value={peildatum ?? ''}
						onchange={(e) => choose(e.currentTarget.value)}
					>
						<option value="">{formatLongDate(today)}</option>
						{#if peildatum && !versions.some((v) => v.valid_from === peildatum)}
							<option value={peildatum}>{formatLongDate(peildatum)}</option>
						{/if}
						{#each versionsByYear(versions) as [year, list] (year)}
							<optgroup label={year}>
								{#each list as v (v.valid_from)}
									<option value={v.valid_from}
										>{formatLongDate(v.valid_from ?? null)}{v.current ? ', geldend' : ''}</option
									>
								{/each}
							</optgroup>
						{/each}
					</select>
					<span class="whole-peil-note"
						>{formatCount(versions.length)} versies sinds {formatLongDate(oldest ?? null)}</span
					>
				</div>
			{/if}
			{#if peildatum}
				<p class="whole-hist">
					{histLine}
					<a href={withParams({ peildatum: null })} data-sveltekit-noscroll
						>Naar de geldende tekst</a
					>
				</p>
			{/if}
		</header>

		{#if peildatum && articles.length === 0}
			<p class="whole-empty-text">Geen versie van deze wet op {formatLongDate(peildatum)}.</p>
		{/if}

		{#each articles as a, i (a.id)}
			{#each newSections(articles[i - 1], a) as section, j (j)}
				<!-- The designation once (Hoofdstuk 3), the heading under it; deeper layers on one line. -->
				<h2 class="whole-section whole-section--depth-{Math.min(section.depth, 2)}">
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
			{@const name = articleName(bwbId, a.article_number, a.label) ?? a.id}
			<section
				class="whole-article"
				id="article-{address}"
				use:lazyLoad={peildatum ? null : address}
			>
				<div class="whole-article-head">
					<!-- The anchor of reading: Artikel 3:4, a BW article with its book (6:162). -->
					{#if a.key}
						<a
							class="whole-article-jump"
							href={peildatum
								? `${bronHref({ collection: 'articles', key: a.key })}&peildatum=${peildatum}`
								: bronHref({ collection: 'articles', key: a.key })}
							data-sveltekit-noscroll><span class="whole-art-num">{name}</span></a
						>
					{:else}
						<span class="whole-art-num">{name}</span>
						<span class="whole-art-note">niet meer in de geldende tekst</span>
					{/if}
				</div>

				{#if a.text}
					<ArticleText text={a.text} parts={null} citation={null} mark={onderdeelMark(bwbId)} />
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
					<p class="whole-text"><span class="whole-empty-text">Geen tekst beschikbaar.</span></p>
				{/if}
			</section>
		{/each}

		{#if articles.length < total}
			<button
				type="button"
				class="whole-more"
				disabled={status === 'loading-more'}
				onclick={loadMore}
			>
				{status === 'loading-more'
					? 'Laden…'
					: `Volgende artikelen (${total - articles.length} resterend)`}
			</button>
		{/if}
	</article>
{/if}

<style>
	.whole-empty,
	.whole-error {
		padding: var(--s-7);
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--t-body-2);
		color: var(--ink-3);
		text-align: center;
	}

	.whole-error {
		color: var(--ink-2);
		font-style: normal;
	}

	.whole-loading {
		padding: var(--s-7);
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		align-items: center;
		color: var(--ink-3);
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--t-body-2);
	}

	.spinner {
		width: 26px;
		height: 26px;
		border: 2px solid var(--rule);
		border-top-color: var(--ink-2);
		border-radius: 50%;
		animation: spin 0.9s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* The reader frame sets the margins and the width, as for every reader. */
	.whole-law {
		width: 100%;
	}

	.whole-head {
		margin-bottom: var(--s-7);
		padding-bottom: var(--s-4);
		border-bottom: 1px solid var(--rule);
	}

	.whole-kind {
		display: block;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink-3);
		margin-bottom: var(--s-1);
	}

	.whole-title {
		margin: 0 0 6px;
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: var(--t-h1);
		line-height: var(--lh-tight);
		color: var(--ink);
	}

	.whole-count {
		margin: var(--s-2) 0 0;
		font-family: var(--font-sans);
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
		color: var(--accent);
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
	.whole-peil-pick {
		max-width: 100%;
		padding: 0 var(--s-1);
		border: 0;
		border-bottom: 1px solid var(--ink-3);
		border-radius: 0;
		background: none;
		font: inherit;
		font-weight: 500;
		color: var(--ink);
		cursor: pointer;
	}
	/* Below 16 px a phone zooms in on the list. */
	@media (max-width: 768px) {
		.whole-peil-pick {
			font-size: var(--t-input);
			min-height: var(--s-6);
		}
	}
	.whole-peil-pick:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.whole-peil-note {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* A text of an earlier day says so, with the way back. */
	.whole-hist {
		margin: var(--s-3) 0 0;
		padding: var(--s-2) var(--s-3);
		background: var(--accent-soft);
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	.whole-hist a {
		color: var(--accent);
	}
	.whole-art-note {
		margin-left: var(--s-2);
		font-family: var(--font-sans);
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
		font-weight: 500;
		line-height: var(--lh-snug);
	}
	/* The outer layer: a rule above, the heading larger. */
	.whole-section--depth-0 {
		margin-top: var(--s-8);
		padding-top: var(--s-5);
		border-top: 1px solid var(--rule);
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
		color: var(--accent);
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

	.whole-more {
		display: block;
		margin: var(--s-6) auto 0;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-2);
		background: none;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		padding: 6px 14px;
		cursor: pointer;
	}

	.whole-more:hover:not(:disabled) {
		background: var(--paper-2);
		color: var(--ink);
	}

	.whole-more:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.whole-empty-text {
		margin: 0;
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--ink-3);
	}
</style>

<script lang="ts">
	// Reader for articles: the place of the article, its title, one line with the version
	// picker, the wetsvoorstellen that touch it and Citeer, then the leden with the number
	// of verbindingen of each, and the previous and next article.
	import { api, unwrap } from '$lib/api/client';
	import { getArticleDetail } from '$lib/api/articles';
	import { instrumentMetaStore, recordInstrument } from '$lib/api/instrument-cache';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import ArticleText from '$lib/components/articles/ArticleText.svelte';
	import { page } from '$app/state';
	import { anchorOfHash, landOn } from '$lib/bron/anchor';
	import { bronHref, refId } from '$lib/bron/href';
	import { citeArticle } from '$lib/text/cite';
	import { findPassage } from '$lib/text/find-passage';
	import { articleIdentity } from '$lib/util/law-id';
	import { filterParams, type VerbondenFilter } from '$lib/verbonden/filter';
	import { proposedTextOf, type ProposedText } from '$lib/verbonden/proposed-text';
	import type { Row } from '$lib/verbonden/rows';
	import { longDate } from '$lib/verbonden/rows';
	import { tick } from 'svelte';
	import ReaderFrame from './ReaderFrame.svelte';
	import ReaderHead from './ReaderHead.svelte';

	let {
		selection,
		prevHref,
		nextHref,
		place = [],
		lidCounts = new Map(),
		billCount = 0,
		filter,
		proposedRow = null,
		onCloseProposed
	}: {
		selection: GraphNode | null;
		prevHref?: string;
		nextHref?: string;
		place?: string[];
		lidCounts?: Map<string, number>;
		billCount?: number;
		filter?: VerbondenFilter;
		proposedRow?: Row | null;
		onCloseProposed?: () => void;
	} = $props();

	type View =
		| { kind: 'empty' }
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| { kind: 'loaded'; data: Schema<'ArticleDetailResponse'> };

	let view = $state<View>({ kind: 'empty' });
	let versions = $state<Schema<'ArticleVersionDTO'>[]>([]);
	let versionKey = $state<string | null>(null);
	let versionMenu = $state(false);
	let citeMenu = $state(false);
	let copied = $state(false);

	// The toelichting (MvT) that explains this article, if any: a quick popup here, so
	// the panel on the right can stay reserved for verwijzingen (Verbonden). Its own
	// full reading view is still the existing "open naast het artikel" (`?naast=`).
	type Explanatory = { key: string; title: string | null; kind: string | null; at: string | null };
	let explanatory = $state<Explanatory | null>(null);
	let explanatoryMenu = $state(false);
	type ExplanatoryText =
		| { kind: 'loading' }
		| { kind: 'error' }
		| { kind: 'loaded'; heading: string | null; passage: string };
	let explanatoryText = $state<ExplanatoryText | null>(null);

	// Primitives, so that a new selection object for the same article does not reload it.
	const selected = $derived(selection !== null);
	const identity = $derived(
		selection ? articleIdentity(selection.raw?.props ?? undefined, selection.key) : null
	);
	const bwbId = $derived(identity?.lawId ?? '');
	const articleNumber = $derived(identity?.articleNumber ?? '');

	// The position in the URL, once the text is on the page and again when it changes.
	let root = $state<HTMLElement | null>(null);
	const anchor = $derived(anchorOfHash(page.url.hash));
	$effect(() => {
		if (view.kind !== 'loaded' || !anchor || !root) return;
		const container = root;
		void tick().then(() => landOn(container, anchor));
	});

	$effect(() => {
		versions = [];
		versionKey = null;
		if (!selected) {
			view = { kind: 'empty' };
			return;
		}
		if (!bwbId || !articleNumber) {
			view = { kind: 'error', message: 'Artikel kon niet geladen worden.' };
			return;
		}

		let stale = false;
		const controller = new AbortController();
		view = { kind: 'loading' };
		getArticleDetail(bwbId, articleNumber)
			.then((data) => {
				if (stale) return;
				// The status bar and the citation panel read the law name from this cache.
				if (data.instrument) {
					recordInstrument({ bwb_id: bwbId, display_name: data.instrument.display_name });
				}
				view = { kind: 'loaded', data };
			})
			.catch(() => {
				if (!stale) view = { kind: 'error', message: 'Artikel kon niet geladen worden.' };
			});
		// The versions of the text, for the picker. Empty until the pipeline has run.
		unwrap(
			api.GET('/api/articles/{bwb_id}/{article_number}/history', {
				params: { path: { bwb_id: bwbId, article_number: articleNumber } },
				signal: controller.signal
			})
		)
			.then((r) => {
				if (!stale) versions = r.versions ?? [];
			})
			.catch(() => {
				// Without versions the picker shows the current text alone.
			});
		return () => {
			stale = true;
			controller.abort();
		};
	});

	// Whether a toelichting names this article, for the header button. Only the
	// existence and identity — its text loads lazily, when the popup opens.
	$effect(() => {
		explanatory = null;
		explanatoryMenu = false;
		explanatoryText = null;
		const bwb = bwbId;
		const num = articleNumber;
		if (!bwb || !num) return;
		const ac = new AbortController();
		api
			.GET('/api/articles/{bwb_id}/{article_number}/explained-by', {
				params: { path: { bwb_id: bwb, article_number: num }, query: { limit: 1 } },
				signal: ac.signal
			})
			.then(({ data, response }) => {
				if (ac.signal.aborted || !response.ok) return;
				const first = data?.items[0];
				if (!first) return;
				explanatory = {
					key: first.document.key,
					title: first.document.title ?? null,
					kind: first.document.kind ?? null,
					at: first.section_anchor ?? null
				};
			})
			.catch(() => {
				// No button without a confirmed toelichting.
			});
		return () => ac.abort();
	});

	function openExplanatoryMenu() {
		explanatoryMenu = !explanatoryMenu;
		if (!explanatoryMenu || explanatoryText || !explanatory) return;
		explanatoryText = { kind: 'loading' };
		const doc = explanatory;
		const num = articleNumber;
		unwrap(api.GET('/api/documents/{key}', { params: { path: { key: doc.key } } }))
			.then((d) => {
				const text = d.text ?? '';
				const found = findPassage(text, num);
				if (!found) {
					explanatoryText = { kind: 'error' };
					return;
				}
				const section = (d.sections ?? [])
					.filter((s) => s.char_start <= found.start && found.start < s.char_end)
					.sort((a, b) => b.char_start - a.char_start)[0];
				const from = Math.max(0, found.start - 40);
				const to = Math.min(text.length, found.end + 500);
				const passage = `${from > 0 ? '… ' : ''}${text.slice(from, to).trim()}${to < text.length ? ' …' : ''}`;
				explanatoryText = { kind: 'loaded', heading: section?.heading ?? null, passage };
			})
			.catch(() => {
				explanatoryText = { kind: 'error' };
			});
	}

	const explanatoryHref = $derived.by(() => {
		if (!explanatory) return null;
		const url = new URL(page.url);
		url.searchParams.set('naast', refId({ collection: 'documents', key: explanatory.key }));
		url.hash = explanatory.at ?? '';
		return `${url.pathname}?${url.searchParams.toString().replaceAll('%2F', '/').replaceAll('%2C', ',')}${url.hash}`;
	});

	const current = $derived(versions.find((v) => v.current) ?? null);
	const shownVersion = $derived(
		versionKey ? (versions.find((v) => v.key === versionKey) ?? null) : null
	);
	const validFrom = $derived(
		shownVersion?.valid_from ??
			current?.valid_from ??
			(typeof selection?.raw?.props?.valid_from === 'string'
				? selection.raw.props.valid_from
				: null)
	);
	const versionLabel = $derived.by(() => {
		if (shownVersion && !shownVersion.current) {
			const from = longDate(shownVersion.valid_from ?? null);
			const until = longDate(shownVersion.valid_until ?? null);
			return `Eerdere tekst${from ? `, sinds ${from}` : ''}${until ? ` tot ${until}` : ''}`;
		}
		const from = longDate(validFrom);
		return from ? `Geldend recht, tekst sinds ${from}` : 'Geldend recht';
	});

	// The dossier(s) whose wetgeving the version on screen made: the fastest way to its
	// memorie van toelichting and to the behandeling it was in.
	// TODO(backend B13): a version from before the dossier collection's coverage names a
	// dossier the API 404s on (e.g. a pre-1990s Kamerstuknummer); the link still renders.
	const versionDossiers = $derived((shownVersion ?? current)?.amended_by?.dossiers ?? []);

	// The law's names for the citation forms.
	const law = $derived($instrumentMetaStore.get(bwbId) ?? null);
	const citation = $derived.by(() => {
		if (view.kind !== 'loaded' || !view.data.article.article_number) return null;
		const title = law?.citationTitle ?? law?.title ?? view.data.instrument?.display_name ?? null;
		if (!title) return null;
		return {
			articleNumber: view.data.article.article_number,
			shortTitle: law?.shortTitle ?? null,
			citationTitle: title
		};
	});
	const forms = $derived(citation ? citeArticle(citation) : null);

	async function copy(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 1000);
		} catch {
			// The clipboard is unavailable in some contexts.
		}
		citeMenu = false;
	}

	const withParams = (params: Record<string, string | null>) => {
		const url = new URL(page.url);
		for (const [k, v] of Object.entries(params)) {
			if (v === null) url.searchParams.delete(k);
			else url.searchParams.set(k, v);
		}
		url.hash = '';
		return `${url.pathname}?${url.searchParams.toString().replaceAll('%2F', '/').replaceAll('%2C', ',')}`;
	};
	const billsHref = $derived(
		withParams({
			...filterParams(filter ?? ({} as VerbondenFilter)),
			bronnen: 'wetsvoorstellen',
			lid: null
		})
	);
	const lidHref = (lid: string) => withParams({ lid: filter?.lid === lid ? null : lid });

	// The proposed wording of a lid, from the mutations of the dossier of the wetsvoorstel.
	let proposed = $state<ProposedText | null>(null);
	let proposedMissing = $state(false);
	$effect(() => {
		proposed = null;
		proposedMissing = false;
		const row = proposedRow;
		if (!row || view.kind !== 'loaded') return;
		const ac = new AbortController();
		proposedTextOf(row, view.data.article.id, ac.signal)
			.then((p) => {
				if (ac.signal.aborted) return;
				proposed = p;
				proposedMissing = p === null;
			})
			.catch(() => {
				if (!ac.signal.aborted) proposedMissing = true;
			});
		return () => ac.abort();
	});

	const title = (a: Schema<'ArticleSummaryDTO'>) =>
		a.article_number ? `Artikel ${a.article_number}` : (a.display_name ?? 'Artikel');
</script>

<svelte:window
	onclick={() => {
		versionMenu = false;
		citeMenu = false;
		explanatoryMenu = false;
	}}
/>

<ReaderFrame
	status={view.kind === 'loaded' ? 'ready' : view.kind}
	message={view.kind === 'error' ? view.message : ''}
>
	{#if view.kind === 'loaded'}
		{@const d = view.data}
		{@const a = d.article}
		<ReaderHead
			collection="articles"
			juris={d.instrument?.display_name}
			title={title(a)}
			place={[d.instrument?.display_name ?? law?.citationTitle ?? '', ...place].filter(Boolean)}
		>
			<div class="line">
				<span class="menu" onclick={(e) => e.stopPropagation()} role="presentation">
					<button
						type="button"
						class="line__btn"
						aria-haspopup={versions.length > 1 ? 'menu' : undefined}
						aria-expanded={versions.length > 1 ? versionMenu : undefined}
						disabled={versions.length <= 1}
						onclick={() => (versionMenu = !versionMenu)}
						>{versionLabel}{#if versions.length > 1}
							<span class="caret" aria-hidden="true">▾</span>{/if}</button
					>
					{#if versionMenu}
						<div class="pop" role="menu" aria-label="Versies">
							{#each versions as v (v.key)}
								{@const dossier = v.amended_by?.dossiers?.[0]}
								<button
									type="button"
									role="menuitemradio"
									aria-checked={(versionKey ?? current?.key) === v.key}
									class="pop__item"
									onclick={() => {
										versionKey = v.current ? null : v.key;
										versionMenu = false;
									}}
									><span
										>{v.current ? 'Geldend recht' : 'Eerdere tekst'}{v.valid_from
											? `, sinds ${longDate(v.valid_from)}`
											: ''}{dossier ? ` · Kamerstuk ${dossier.number}` : ''}</span
									>{#if v.valid_until}<span class="pop__k">tot {longDate(v.valid_until)}</span
										>{/if}</button
								>
							{/each}
						</div>
					{/if}
				</span>
				{#each versionDossiers as dossier (dossier.key)}
					<span class="line__sep" aria-hidden="true">·</span>
					<a
						href={bronHref({ collection: 'dossiers', key: dossier.key, number: dossier.number })}
						data-sveltekit-noscroll
						title={dossier.title ?? undefined}>Kamerstuk {dossier.number}</a
					>
				{/each}
				{#if billCount > 0}
					<span class="line__sep" aria-hidden="true">·</span>
					<a href={billsHref} data-sveltekit-noscroll
						>{billCount}
						{billCount === 1 ? 'wetsvoorstel raakt' : 'wetsvoorstellen raken'} dit artikel</a
					>
				{/if}
				{#if forms}
					<span class="line__sep" aria-hidden="true">·</span>
					<span class="menu" onclick={(e) => e.stopPropagation()} role="presentation">
						<button
							type="button"
							class="line__btn"
							aria-haspopup="menu"
							aria-expanded={citeMenu}
							onclick={() => (citeMenu = !citeMenu)}
							>{copied ? 'Gekopieerd' : 'Citeer artikel'}</button
						>
						{#if citeMenu}
							<div class="pop" role="menu" aria-label="Citeer artikel">
								<div class="pop__label">Kopieer als</div>
								<button
									type="button"
									role="menuitem"
									class="pop__item"
									onclick={() => copy(forms.kort)}
									><span>{forms.kort}</span><span class="pop__k">kort</span></button
								>
								<button
									type="button"
									role="menuitem"
									class="pop__item"
									onclick={() => copy(forms.voluit)}
									><span>{forms.voluit}</span><span class="pop__k">voluit</span></button
								>
								<button
									type="button"
									role="menuitem"
									class="pop__item"
									onclick={() => copy(forms.metDatum)}
									><span>{forms.metDatum}</span><span class="pop__k">met datum</span></button
								>
								<button
									type="button"
									role="menuitem"
									class="pop__item"
									onclick={() => copy(page.url.toString())}
									><span class="pop__link">{page.url.toString()}</span><span class="pop__k"
										>link</span
									></button
								>
							</div>
						{/if}
					</span>
				{/if}
				{#if explanatory}
					<span class="line__sep" aria-hidden="true">·</span>
					<span class="menu" onclick={(e) => e.stopPropagation()} role="presentation">
						<button
							type="button"
							class="line__btn"
							aria-haspopup="dialog"
							aria-expanded={explanatoryMenu}
							onclick={openExplanatoryMenu}>Toelichting</button
						>
						{#if explanatoryMenu}
							<div class="pop pop--wide" role="dialog" aria-label="Toelichting">
								<div class="pop__label">
									{explanatory.kind ??
										'Toelichting'}{#if explanatoryText?.kind === 'loaded' && explanatoryText.heading}<span
											class="pop__k"
										>
											· {explanatoryText.heading}</span
										>{/if}
								</div>
								{#if explanatoryText?.kind === 'loading'}
									<p class="pop__passage pop__passage--note">Laden…</p>
								{:else if explanatoryText?.kind === 'error'}
									<p class="pop__passage pop__passage--note">
										De passage voor dit artikel is niet gevonden.
									</p>
								{:else if explanatoryText?.kind === 'loaded'}
									<p class="pop__passage">{explanatoryText.passage}</p>
								{/if}
								{#if explanatoryHref}
									<a class="pop__full" href={explanatoryHref} data-sveltekit-noscroll
										>Volledig lezen naast het artikel →</a
									>
								{/if}
							</div>
						{/if}
					</span>
				{/if}
			</div>
		</ReaderHead>

		{#if proposedMissing && proposedRow}
			<p class="note">
				De voorgestelde tekst van {proposedRow.title} is niet in de gegevens opgenomen.
				{#if onCloseProposed}<button type="button" class="note__close" onclick={onCloseProposed}
						>Sluiten</button
					>{/if}
			</p>
		{/if}

		<div class="reader-body" bind:this={root}>
			<ArticleText
				text={shownVersion?.text ?? a.text}
				parts={shownVersion?.parts ?? a.parts}
				citations={shownVersion ? [] : d.citations}
				counts={lidCounts}
				{lidHref}
				{citation}
				{proposed}
				{onCloseProposed}
			/>
		</div>

		{#if prevHref || nextHref}
			<nav class="reader-nav-footer" aria-label="Artikelen">
				{#if prevHref}
					<a class="reader-nav-link" href={prevHref} data-sveltekit-noscroll>← Vorig artikel</a>
				{/if}
				{#if nextHref}
					<a class="reader-nav-link reader-nav-link--next" href={nextHref} data-sveltekit-noscroll
						>Volgend artikel →</a
					>
				{/if}
			</nav>
		{/if}
	{/if}
</ReaderFrame>

<style>
	.line {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 14px;
		margin-bottom: 4px;
		font-family: var(--font-sans);
		font-size: 12.5px;
		color: var(--ink-2);
	}
	.line__sep {
		color: var(--ink-3);
	}
	.line__btn {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
	}
	.line__btn:hover:not(:disabled) {
		color: var(--accent);
	}
	.line__btn:disabled {
		cursor: default;
	}
	.caret {
		font-size: 9px;
		opacity: 0.7;
	}
	.menu {
		position: relative;
	}
	.pop {
		position: absolute;
		left: 0;
		top: calc(100% + 6px);
		z-index: var(--z-float);
		width: 340px;
		padding: 8px 0;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
		font-size: 12.5px;
	}
	.pop__label {
		padding: 2px 12px 6px;
		font-size: 11.5px;
		color: var(--ink-3);
	}
	.pop__item {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		width: 100%;
		padding: 6px 12px;
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	.pop__item:hover {
		background: var(--paper-2);
	}
	.pop__k {
		flex: none;
		font-size: 11.5px;
		color: var(--ink-3);
	}
	.pop__link {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pop--wide {
		width: 420px;
		max-width: calc(100vw - 40px);
	}

	.pop__passage {
		margin: 0;
		padding: 4px 12px 10px;
		font-family: var(--font-serif);
		font-size: 13.5px;
		line-height: var(--lh-body);
		color: var(--ink);
		max-height: 260px;
		overflow-y: auto;
	}

	.pop__passage--note {
		font-style: italic;
		color: var(--ink-3);
	}

	.pop__full {
		display: block;
		margin-top: 4px;
		padding: 8px 12px;
		border-top: 1px solid var(--rule);
		font-family: var(--font-sans);
		font-size: 12.5px;
		font-weight: 500;
		color: var(--ink-2);
	}

	.pop__full:hover {
		color: var(--accent);
	}

	.note {
		margin: 0 0 var(--s-4);
		font-family: var(--font-sans);
		font-size: 12.5px;
		color: var(--ink-3);
	}
	.note__close {
		margin-left: 8px;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: var(--ink-2);
		cursor: pointer;
	}

	.reader-body {
		margin-left: 46px;
	}

	.reader-nav-footer {
		display: flex;
		justify-content: space-between;
		gap: var(--s-3);
		margin-top: 40px;
		padding-top: 18px;
		border-top: 1px solid var(--rule);
		font-family: var(--font-sans);
		font-size: 12.5px;
	}

	.reader-nav-link {
		color: var(--ink-3);
	}

	.reader-nav-link--next {
		margin-left: auto;
	}

	@media (max-width: 900px) {
		.reader-body {
			margin-left: 0;
		}
	}
</style>

<script lang="ts">
	// Index: browse one category at a time with filters and sorting. A row
	// expands inline with its metadata and the three ways of opening it
	// (Lezen, Netwerk).
	//
	// Every filter and sort is in the URL, so a filtered view can be shared.
	// What the API can filter or sort is passed on as a query; the rest is done
	// on the rows loaded so far.
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import type { Collection } from '$lib/vocabulary';
	import {
		STAGES,
		dossierStatus,
		TRACK_LABEL,
		isStage
	} from '$lib/components/parliamentary/stages';
	import { partyColor } from '$lib/utils/party-color';
	import Hemicycle from './Hemicycle.svelte';
	import IndexToolbar, { type Facet } from './index/IndexToolbar.svelte';
	import IndexStageFilter from './index/IndexStageFilter.svelte';
	import IndexDetail from './index/IndexDetail.svelte';
	import { INDEX_CATEGORIES, type IndexCategory } from './index/categories';

	let {
		category,
		onSelectCategory,
		onSelectItem,
		onDiscoverItem,
		onReadItem,
		onResultCountChange
	}: {
		category: IndexCategory;
		onSelectCategory: (k: IndexCategory) => void;
		/** Opens the bron in Lezen. `name` is its key, and a dossier's number (`37020-XV`). */
		onSelectItem: (collection: Collection, name: string) => void;
		/** Opens the bron in Netwerk. */
		onDiscoverItem?: (collection: Collection, name: string) => void;
		/** Lezen: the full text. Only for laws and judgments. */
		onReadItem?: (collection: Collection, name: string) => void;
		/** Reports what is shown and how many there are, for the status bar. */
		onResultCountChange?: (info: {
			filtered: number;
			total: number;
			category: IndexCategory;
		}) => void;
	} = $props();

	const oneOf = <T extends string>(value: string | null, allowed: readonly T[]): T | undefined =>
		allowed.find((a) => a === value);

	// ── URL-driven filter state ─────────────────────────────────────────────
	const params = $derived(page.url.searchParams);
	const q = $derived(params.get('q') ?? '');
	const stage = $derived(oneOf(params.get('stage'), STAGES));
	// Stages a dossier must all have passed, comma-separated.
	const hasStage = $derived((params.get('has_stage') ?? '').split(',').filter(isStage).join(','));
	const track = $derived(params.get('track') ?? '');
	const passed = $derived(oneOf(params.get('passed'), ['true', 'false'] as const));
	const dateFrom = $derived(params.get('from') ?? '');
	const dateTo = $derived(params.get('to') ?? '');
	const dossierFilter = $derived(params.get('dossier') ?? '');
	const party = $derived(params.get('party') ?? '');
	const jurisdiction = $derived(oneOf(params.get('jurisdiction'), ['nl', 'eu'] as const));
	const court = $derived(params.get('court') ?? '');
	const tier = $derived(
		oneOf(params.get('tier'), ['hoge_raad', 'gerechtshof', 'rechtbank', 'bijzonder'] as const)
	);
	const sort = $derived(params.get('sort'));
	const dirParam = $derived(oneOf(params.get('dir'), ['asc', 'desc'] as const));
	const onlyActive = $derived(params.get('only_active') === '1');
	// Members and factions are the sitting ones unless historical ones are asked for.
	const includeInactive = $derived(params.get('include_inactive') === '1');

	const FILTER_PARAMS = [
		'q',
		'stage',
		'has_stage',
		'track',
		'passed',
		'from',
		'to',
		'dossier',
		'party',
		'jurisdiction',
		'court',
		'tier',
		'sort',
		'dir',
		'only_active',
		'include_inactive'
	];

	function patchUrl(patch: Record<string, string | null>) {
		const url = new URL(page.url);
		for (const [k, v] of Object.entries(patch)) {
			if (v === null || v === '') url.searchParams.delete(k);
			else url.searchParams.set(k, v);
		}
		goto(url.toString(), { replaceState: false, keepFocus: true, noScroll: true });
	}

	const toggleParam = (name: string, current: string | undefined, value: string) =>
		patchUrl({ [name]: current === value ? null : value });

	// Switching category drops the filters, so a stage filter of dossiers does not leak into decisions.
	async function switchCategory(k: IndexCategory) {
		const url = new URL(page.url);
		for (const p of FILTER_PARAMS) url.searchParams.delete(p);
		url.searchParams.set('kind', k);
		// The parent sets `kind` on the URL it then holds, so it must see the cleared filters.
		await goto(url.toString(), { replaceState: false, keepFocus: true, noScroll: true });
		onSelectCategory(k);
	}

	// ── Sorting ─────────────────────────────────────────────────────────────
	// The first option is the default. An option with `dir` is sorted here, with
	// that direction unless the URL says otherwise; the others are sorted by the API.
	type SortDef = { id: string; label: string; dir?: 'asc' | 'desc' };
	const SORTS: Record<IndexCategory, SortDef[]> = {
		instruments: [
			{ id: 'title', label: 'Citatietitel' },
			{ id: 'article_count', label: 'Aantal artikelen' }
		],
		judgments: [
			{ id: 'date_desc', label: 'Datum (nieuw → oud)' },
			{ id: 'date_asc', label: 'Datum (oud → nieuw)' },
			{ id: 'citation_count', label: 'Meest geciteerd' }
		],
		dossiers: [
			{ id: 'number', label: 'Kamerstuknummer', dir: 'desc' },
			{ id: 'title', label: 'Titel', dir: 'asc' },
			{ id: 'stage', label: 'Fase', dir: 'asc' }
		],
		committees: [
			{ id: 'dossiers', label: 'Actieve dossiers', dir: 'desc' },
			{ id: 'abbreviation', label: 'Afkorting', dir: 'asc' },
			{ id: 'name', label: 'Naam', dir: 'asc' }
		],
		members: [
			{ id: 'name', label: 'Naam', dir: 'asc' },
			{ id: 'party', label: 'Fractie', dir: 'asc' }
		],
		factions: [
			{ id: 'seats', label: 'Zetels', dir: 'desc' },
			{ id: 'abbreviation', label: 'Afkorting', dir: 'asc' },
			{ id: 'name', label: 'Naam', dir: 'asc' }
		],
		decisions: [
			{ id: 'date', label: 'Datum', dir: 'desc' },
			{ id: 'result', label: 'Uitslag', dir: 'asc' },
			{ id: 'subject', label: 'Onderwerp', dir: 'asc' }
		]
	};
	const sortDef = $derived(SORTS[category].find((s) => s.id === sort) ?? SORTS[category][0]);
	const dir = $derived(sortDef.dir && (dirParam ?? sortDef.dir));

	type Keys<T> = Record<string, (row: T) => string | number>;
	function sorted<T>(rows: T[], keys: Keys<T>): T[] {
		const key = keys[sortDef.id];
		const sign = dir === 'asc' ? 1 : -1;
		return [...rows].sort((a, b) => {
			const [x, y] = [key(a), key(b)];
			return (
				(typeof x === 'number' ? x - (y as number) : x.localeCompare(y as string, 'nl')) * sign
			);
		});
	}

	// ── Data ────────────────────────────────────────────────────────────────
	type Page<T> = { items: T[]; total: number; more: boolean };
	type AnyPage = Page<unknown>;
	type Pages = {
		instruments?: Page<Schema<'InstrumentListItemDTO'>>;
		judgments?: Page<Schema<'JudgmentListItemDTO'>>;
		dossiers?: Page<Schema<'DossierSummaryDTO'>>;
		committees?: Page<Schema<'CommitteeDTO'>>;
		members?: Page<Schema<'MemberDTO'>>;
		factions?: Page<Schema<'FactionDTO'>>;
		decisions?: Page<Schema<'DecisionSummaryDTO'>>;
	};

	const PAGE = 100;

	// A list without `total` (members) is over when a slice comes back short.
	function toPage<T>(
		previous: Page<T> | undefined,
		items: T[],
		offset: number,
		total?: number
	): Page<T> {
		const all = offset && previous ? [...previous.items, ...items] : items;
		return {
			items: all,
			total: total ?? all.length,
			more: total === undefined ? items.length === PAGE : all.length < total
		};
	}

	let pages = $state<Pages>({});
	let seats = $state<Schema<'ParliamentSeatsResponse'> | null>(null);
	let parties = $state<string[]>([]);
	let loading = $state(false);
	let loadingMore = $state(false);
	let error = $state<string | null>(null);

	// The request for the current category and filters. It is rebuilt only when
	// one of the values it reads changes, and that is what triggers a new load.
	type Fetcher = (offset: number, signal: AbortSignal) => Promise<void>;
	const fetchPage = $derived.by<Fetcher>(() => {
		const limit = PAGE;
		switch (category) {
			case 'instruments': {
				const query = {
					q: q || undefined,
					jurisdiction,
					sort: oneOf(sortDef.id, ['title', 'article_count'] as const),
					limit
				};
				return async (offset, signal) => {
					const r = await unwrap(
						api.GET('/api/instruments', { params: { query: { ...query, offset } }, signal })
					);
					pages.instruments = toPage(pages.instruments, r.items, offset, r.total);
				};
			}
			case 'judgments': {
				const query = {
					q: q || undefined,
					court: court || undefined,
					tier,
					from: dateFrom || undefined,
					to: dateTo || undefined,
					sort: oneOf(sortDef.id, ['date_desc', 'date_asc', 'citation_count'] as const),
					limit
				};
				return async (offset, signal) => {
					const r = await unwrap(
						api.GET('/api/judgments', { params: { query: { ...query, offset } }, signal })
					);
					pages.judgments = toPage(pages.judgments, r.items, offset, r.total);
				};
			}
			case 'dossiers': {
				const query = {
					subject: q || undefined,
					stage,
					has_stage: hasStage || undefined,
					limit
				};
				return async (offset, signal) => {
					const r = await unwrap(
						api.GET('/api/dossiers/open', { params: { query: { ...query, offset } }, signal })
					);
					pages.dossiers = toPage(pages.dossiers, r.items, offset, r.total);
				};
			}
			case 'committees':
				return async (_offset, signal) => {
					const items = await unwrap(api.GET('/api/committees', { signal }));
					pages.committees = toPage(undefined, items, 0, items.length);
				};
			case 'members': {
				const query = {
					q: q || undefined,
					party: party || undefined,
					active: includeInactive ? undefined : true,
					include_all: includeInactive,
					limit
				};
				return async (offset, signal) => {
					const items = await unwrap(
						api.GET('/api/members', { params: { query: { ...query, offset } }, signal })
					);
					pages.members = toPage(pages.members, items, offset);
				};
			}
			case 'factions': {
				const query = { q: q || undefined, active: includeInactive ? undefined : true };
				return async (_offset, signal) => {
					const items = await unwrap(api.GET('/api/factions', { params: { query }, signal }));
					pages.factions = toPage(undefined, items, 0, items.length);
				};
			}
			case 'decisions': {
				const query = {
					passed: passed === undefined ? undefined : passed === 'true',
					party: party || undefined,
					limit
				};
				return async (offset, signal) => {
					const r = await unwrap(
						api.GET('/api/decisions', { params: { query: { ...query, offset } }, signal })
					);
					pages.decisions = toPage(pages.decisions, r.items, offset, r.total);
				};
			}
		}
	});

	let loadMoreAbort: AbortController | null = null;

	$effect(() => {
		const load = fetchPage;
		const ac = new AbortController();
		loading = true;
		error = null;
		load(0, ac.signal)
			.catch(() => {
				if (!ac.signal.aborted) error = `${labelOf(category)} konden niet worden geladen.`;
			})
			.finally(() => {
				if (!ac.signal.aborted) loading = false;
			});
		return () => {
			ac.abort();
			loadMoreAbort?.abort();
		};
	});

	async function loadMore() {
		const offset = pages[category]?.items.length;
		if (loadingMore || !offset) return;
		loadingMore = true;
		loadMoreAbort = new AbortController();
		try {
			await fetchPage(offset, loadMoreAbort.signal);
		} catch {
			/* the rows loaded so far stay */
		} finally {
			loadingMore = false;
		}
	}

	// Seats for the hemicycle, once, when the factions are opened.
	$effect(() => {
		if (category !== 'factions' || seats) return;
		const ac = new AbortController();
		unwrap(api.GET('/api/parliament/seats', { signal: ac.signal }))
			.then((r) => (seats = r))
			.catch(() => {});
		return () => ac.abort();
	});

	// The factions to filter members by; the member list itself is filtered by the API.
	$effect(() => {
		if (category !== 'members' || parties.length) return;
		const ac = new AbortController();
		unwrap(api.GET('/api/factions', { params: { query: { active: true } }, signal: ac.signal }))
			.then((r) => (parties = r.flatMap((f) => f.abbreviation ?? []).sort()))
			.catch(() => {});
		return () => ac.abort();
	});

	// ── What the API cannot filter or sort ──────────────────────────────────
	const includes = (text: string | null | undefined) =>
		(text ?? '').toLowerCase().includes(q.toLowerCase());

	const dossiersShown = $derived.by(() => {
		const rows = pages.dossiers?.items.filter((d) => !track || (d.track ?? 'overig') === track);
		return (
			rows &&
			sorted(rows, {
				number: (d) => Number.parseInt(d.number),
				title: (d) => d.title ?? '',
				stage: (d) => (d.current_stage ? STAGES.indexOf(d.current_stage) : -1)
			})
		);
	});

	const committeesShown = $derived.by(() => {
		const rows = pages.committees?.items.filter(
			(c) =>
				(!onlyActive || (c.active_dossier_count ?? 0) > 0) &&
				(!q || includes(c.name) || includes(c.abbreviation) || includes(c.slug))
		);
		return (
			rows &&
			sorted(rows, {
				dossiers: (c) => c.active_dossier_count ?? 0,
				abbreviation: (c) => c.abbreviation ?? '',
				name: (c) => c.name ?? ''
			})
		);
	});

	const membersShown = $derived(
		pages.members &&
			sorted(pages.members.items, { name: (m) => m.name ?? '', party: (m) => m.party ?? '' })
	);

	const factionsShown = $derived(
		pages.factions &&
			sorted(pages.factions.items, {
				seats: (f) => f.seats ?? 0,
				abbreviation: (f) => f.abbreviation ?? '',
				name: (f) => f.name ?? ''
			})
	);

	const decisionsShown = $derived.by(() => {
		const rows = pages.decisions?.items.filter(
			(s) =>
				(!dossierFilter || s.dossier_numbers?.includes(dossierFilter)) &&
				(!dateFrom || (s.date ?? '') >= dateFrom) &&
				(!dateTo || (s.date ?? '') <= dateTo) &&
				(!q || includes(s.subject))
		);
		return (
			rows &&
			sorted(rows, {
				date: (s) => s.date ?? '',
				result: (s) => Number(s.passed),
				subject: (s) => s.subject ?? ''
			})
		);
	});

	const totalSeats = $derived(factionsShown?.reduce((sum, f) => sum + (f.seats ?? 0), 0) ?? 0);

	// ── Toolbar ─────────────────────────────────────────────────────────────
	const TIERS = [
		['hoge_raad', 'Hoge Raad'],
		['gerechtshof', 'Gerechtshof'],
		['rechtbank', 'Rechtbank'],
		['bijzonder', 'Bijzonder']
	] as const;

	const PLACEHOLDER: Record<IndexCategory, string> = {
		instruments: 'Zoek in titel, BWB of citatie',
		judgments: 'Zoek in zaaknaam of ECLI',
		dossiers: 'Zoek in titel',
		committees: 'Zoek op afkorting of naam',
		members: 'Zoek op naam',
		factions: 'Zoek op naam of afkorting',
		decisions: 'Zoek in onderwerp'
	};

	const labelOf = (c: IndexCategory) =>
		INDEX_CATEGORIES.find((cat) => cat.key === c)!.label.toLowerCase();

	// Dossiers have the stage filter instead (see the snippet at the end).
	const facets = $derived.by<Facet[] | null>(() => {
		switch (category) {
			case 'instruments':
				return [
					{
						id: 'nl',
						label: 'Nederland',
						on: jurisdiction === 'nl',
						onClick: () => toggleParam('jurisdiction', jurisdiction, 'nl')
					},
					{
						id: 'eu',
						label: 'Europese Unie',
						on: jurisdiction === 'eu',
						onClick: () => toggleParam('jurisdiction', jurisdiction, 'eu')
					}
				];
			case 'judgments':
				return TIERS.map(([value, label]) => ({
					id: value,
					label,
					on: tier === value,
					onClick: () => toggleParam('tier', tier, value)
				}));
			case 'committees':
				return [
					{
						id: 'hide',
						label: 'Verberg commissies zonder dossiers',
						on: onlyActive,
						onClick: () => patchUrl({ only_active: onlyActive ? null : '1' })
					}
				];
			case 'members':
				return [
					...parties.map((p) => ({
						id: p,
						label: p,
						on: party === p,
						swatch: partyColor(p),
						onClick: () => toggleParam('party', party, p)
					})),
					{ sep: true },
					{
						id: 'include_inactive',
						label: 'Toon ook historische leden',
						on: includeInactive,
						onClick: () => patchUrl({ include_inactive: includeInactive ? null : '1' })
					}
				];
			case 'factions':
				return [
					{
						id: 'include_inactive',
						label: 'Toon ook inactieve fracties',
						on: includeInactive,
						onClick: () => patchUrl({ include_inactive: includeInactive ? null : '1' })
					}
				];
			case 'decisions':
				return [
					{
						id: 'passed',
						label: 'Aangenomen',
						on: passed === 'true',
						onClick: () => toggleParam('passed', passed, 'true')
					},
					{
						id: 'failed',
						label: 'Verworpen',
						on: passed === 'false',
						onClick: () => toggleParam('passed', passed, 'false')
					}
				];
			default:
				return null;
		}
	});

	// ── Open row, Esc ───────────────────────────────────────────────────────
	let openId = $state<string | null>(null);
	const toggleOpen = (id: string) => (openId = openId === id ? null : id);
	$effect(() => {
		void category;
		openId = null;
	});

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && openId) openId = null;
	}

	// ── Result count for the status bar ─────────────────────────────────────
	$effect(() => {
		const rows = {
			instruments: pages.instruments?.items,
			judgments: pages.judgments?.items,
			dossiers: dossiersShown,
			committees: committeesShown,
			members: membersShown,
			factions: factionsShown,
			decisions: decisionsShown
		}[category];
		if (!rows) return;
		onResultCountChange?.({
			filtered: rows.length,
			total: pages[category]?.total ?? rows.length,
			category
		});
	});

	// ── Opening a source ────────────────────────────────────────────────────
	const discover = (collection: Collection, key: string) =>
		(onDiscoverItem ?? onSelectItem)(collection, key);
	const read = (collection: Collection, key: string) =>
		(onReadItem ?? onSelectItem)(collection, key);

	const fmtDateShort = (iso: string | null | undefined) =>
		iso
			? new Intl.DateTimeFormat('nl-NL', {
					day: 'numeric',
					month: 'short',
					year: 'numeric'
				}).format(new Date(iso))
			: '—';
</script>

<svelte:window onkeydown={handleKey} />

<div class="index-view">
	<nav class="catbar" aria-label="Categorieën">
		{#each INDEX_CATEGORIES as cat (cat.key)}
			<button
				type="button"
				class="cat"
				class:cat--on={cat.key === category}
				onclick={() => switchCategory(cat.key)}
			>
				<span class="cat-name">{cat.label}</span>
			</button>
		{/each}
	</nav>

	<div class="stage">
		<div class="stage-scroll">
			<div class={category === 'factions' || category === 'decisions' ? 'page page--wide' : 'page'}>
				{#if category === 'factions' && seats}
					<div class="hemi-card">
						<div class="hemi-svg-wrap">
							<Hemicycle data={seats} onSelect={(k) => onSelectItem('factions', k)} />
						</div>
					</div>
				{/if}

				<IndexToolbar
					query={q}
					onQueryChange={(v) => {
						patchUrl({ q: v || null });
						openId = null;
					}}
					searchPlaceholder={PLACEHOLDER[category]}
					sortOptions={SORTS[category]}
					sort={sortDef.id}
					onSortChange={(v) => patchUrl({ sort: v || null })}
					{dir}
					onDirToggle={() => patchUrl({ dir: dir === 'asc' ? 'desc' : 'asc' })}
					{facets}
					customFilter={category === 'dossiers' ? stageFilter : null}
				/>

				{#if loading}
					<p class="status-line">Laden…</p>
				{:else if error}
					<p class="status-line status-line--error">{error}</p>
				{:else if category === 'instruments' && pages.instruments}
					{#if pages.instruments.items.length === 0}
						<div class="empty">Geen wetten met deze filters.</div>
					{:else}
						<ul class="list">
							{#each pages.instruments.items as w (w.id)}
								{@const isOpen = openId === w.id}
								<li class="row-wrap">
									<button
										type="button"
										class="row"
										class:row--on={isOpen}
										onclick={() => toggleOpen(w.id)}
									>
										<div class="row-id">
											<span class="row-id-main">{(w.bwb_id ?? w.celex ?? '').toUpperCase()}</span>
											{#if w.short_title && w.short_title !== w.title}
												<span class="row-id-sub">{w.short_title}</span>
											{/if}
										</div>
										<div class="row-body">
											<div class="row-title">
												{w.citation_title ?? w.short_title ?? w.title ?? w.key}
											</div>
											<span class="row-sub"
												>{w.article_count > 0
													? `${w.article_count} artikelen`
													: 'geen artikelen geïndexeerd'}</span
											>
										</div>
										<div class="row-aside">
											<span class="tag tag--outline" class:tag--eu={w.jurisdiction === 'eu'}>
												{w.jurisdiction === 'eu' ? 'EU' : 'NL'}
											</span>
										</div>
									</button>
									{#if isOpen}
										<div class="detail">
											<IndexDetail
												category="instruments"
												record={w}
												onDiscover={() => discover('instruments', w.key)}
												onSplit={() => onSelectItem('instruments', w.key)}
												onRead={() => read('instruments', w.key)}
											/>
										</div>
									{/if}
								</li>
							{/each}
						</ul>
						{@render loadMoreButton(pages.instruments, 'wetten')}
					{/if}
				{:else if category === 'judgments' && pages.judgments}
					{#if pages.judgments.items.length === 0}
						<div class="empty">Geen arresten met deze filters.</div>
					{:else}
						<ul class="list">
							{#each pages.judgments.items as j (j.id)}
								{@const isOpen = openId === j.id}
								<li class="row-wrap">
									<button
										type="button"
										class="row"
										class:row--on={isOpen}
										onclick={() => toggleOpen(j.id)}
									>
										<div class="row-id">
											<span class="row-id-main">{fmtDateShort(j.date)}</span>
											{#if j.court}
												<span class="row-id-sub">{j.court}</span>
											{/if}
										</div>
										<div class="row-body">
											<div class="row-title">{j.display_name ?? j.ecli ?? j.key}</div>
											<span class="row-sub row-sub--mono">{j.ecli ?? ''}</span>
										</div>
										<div class="row-aside">
											{#if j.inbound_citation_count}
												<span class="num-strong"
													>{j.inbound_citation_count}<span class="num-lbl">citaties</span></span
												>
											{/if}
										</div>
									</button>
									{#if isOpen}
										<div class="detail">
											<IndexDetail
												category="judgments"
												record={j}
												onDiscover={() => discover('judgments', j.key)}
												onSplit={() => onSelectItem('judgments', j.key)}
												onRead={() => read('judgments', j.key)}
											/>
										</div>
									{/if}
								</li>
							{/each}
						</ul>
						{@render loadMoreButton(pages.judgments, 'arresten')}
					{/if}
				{:else if category === 'dossiers' && dossiersShown}
					{#if dossiersShown.length === 0}
						<div class="empty">Geen dossiers met deze filters.</div>
					{:else}
						<ul class="list">
							{#each dossiersShown as d (d.id)}
								{@const isOpen = openId === d.id}
								<li class="row-wrap">
									<button
										type="button"
										class="row"
										class:row--on={isOpen}
										onclick={() => toggleOpen(d.id)}
									>
										<div class="row-id">
											<span class="row-id-main">{d.number}</span>
											{#if d.track}
												<span class="row-id-sub">{TRACK_LABEL[d.track]}</span>
											{/if}
										</div>
										<div class="row-body">
											<div class="row-title">{d.title ?? '—'}</div>
										</div>
										<div class="row-aside">
											{#if dossierStatus(d)}
												<span class="tag">
													<span class="tag-dot" aria-hidden="true"></span>{dossierStatus(d)}
												</span>
											{/if}
										</div>
									</button>
									{#if isOpen}
										<div class="detail">
											<IndexDetail
												category="dossiers"
												record={d}
												onDiscover={() => discover('dossiers', d.number)}
												onSplit={() => onSelectItem('dossiers', d.number)}
											/>
										</div>
									{/if}
								</li>
							{/each}
						</ul>
						{@render loadMoreButton(pages.dossiers, 'dossiers')}
					{/if}
				{:else if category === 'committees' && committeesShown}
					{#if committeesShown.length === 0}
						<div class="empty">Geen commissies met deze filters.</div>
					{:else}
						<ul class="list">
							{#each committeesShown as c, i (c.id)}
								{@const isOpen = openId === c.id}
								{@const count = c.active_dossier_count ?? 0}
								<!-- Under the default sort, a divider where the committees without dossiers begin. -->
								{#if !onlyActive && sortDef.id === 'dossiers' && dir === 'desc' && count === 0 && i > 0 && (committeesShown[i - 1].active_dossier_count ?? 0) > 0}
									<li class="group-divider" aria-hidden="true">
										<span>Zonder lopende dossiers</span>
									</li>
								{/if}
								<li class="row-wrap">
									<button
										type="button"
										class="row"
										class:row--on={isOpen}
										onclick={() => toggleOpen(c.id)}
									>
										<div class="row-id">
											<span class="row-id-main">{c.abbreviation ?? ''}</span>
										</div>
										<div class="row-body">
											<div class="row-title">{c.name ?? c.key}</div>
											<span class="row-sub">
												{count > 0
													? `${count} actief ${count === 1 ? 'dossier' : 'dossiers'}`
													: 'Geen actieve dossiers'}
											</span>
										</div>
										<div class="row-aside">
											{#if count > 0}
												<span class="num-strong">{count}</span>
											{:else}
												<span class="tag tag--outline">—</span>
											{/if}
										</div>
									</button>
									{#if isOpen}
										<div class="detail">
											<IndexDetail
												category="committees"
												record={c}
												onDiscover={() => discover('committees', c.key)}
												onSplit={() => onSelectItem('committees', c.key)}
											/>
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				{:else if category === 'members' && membersShown}
					{#if membersShown.length === 0}
						<div class="empty">Geen kamerleden met deze filters.</div>
					{:else}
						<ul class="list">
							{#each membersShown as m (m.id)}
								{@const isOpen = openId === m.id}
								<li class="row-wrap">
									<button
										type="button"
										class="row"
										class:row--on={isOpen}
										onclick={() => toggleOpen(m.id)}
									>
										<div class="row-id">
											<span class="row-id-main row-id-main--inline">
												<span class="party-dot" style:background={partyColor(m.party ?? '')}></span>
												{m.party ?? ''}
											</span>
										</div>
										<div class="row-body">
											<div class="row-title">{m.name ?? m.key}</div>
										</div>
										<div class="row-aside"></div>
									</button>
									{#if isOpen}
										<div class="detail">
											<IndexDetail
												category="members"
												record={m}
												onDiscover={() => discover('members', m.key)}
												onSplit={() => onSelectItem('members', m.key)}
											/>
										</div>
									{/if}
								</li>
							{/each}
						</ul>
						{@render loadMoreButton(pages.members, 'kamerleden')}
					{/if}
				{:else if category === 'factions' && factionsShown}
					{#if factionsShown.length === 0}
						<div class="empty">Geen fracties met deze filters.</div>
					{:else}
						<ul class="list">
							{#each factionsShown as f (f.id)}
								{@const isOpen = openId === f.id}
								<li class="row-wrap">
									<button
										type="button"
										class="row"
										class:row--on={isOpen}
										onclick={() => toggleOpen(f.id)}
									>
										<div class="row-id">
											<span class="row-id-main row-id-main--inline">
												<span class="party-dot" style:background={partyColor(f.abbreviation ?? '')}
												></span>
												{f.abbreviation ?? ''}
											</span>
										</div>
										<div class="row-body">
											<div class="row-title">{f.name ?? f.key}</div>
											{#if f.seats != null && totalSeats > 0}
												<span class="row-sub"
													>{((f.seats / totalSeats) * 100).toFixed(1)}% van de zetels</span
												>
											{/if}
										</div>
										<div class="row-aside">
											{#if f.seats != null}
												<span class="num-strong">{f.seats}<span class="num-lbl">zetels</span></span>
											{/if}
										</div>
									</button>
									{#if isOpen}
										<div class="detail">
											<IndexDetail
												category="factions"
												record={f}
												onDiscover={() => discover('factions', f.key)}
												onSplit={() => onSelectItem('factions', f.key)}
											/>
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				{:else if category === 'decisions' && decisionsShown}
					{#if decisionsShown.length === 0}
						<div class="empty">Geen stemmingen met deze filters.</div>
					{:else}
						<ul class="list">
							{#each decisionsShown as s (s.id)}
								{@const isOpen = openId === s.id}
								{@const inFavour = s.tally?.['Voor'] ?? 0}
								{@const against = s.tally?.['Tegen'] ?? 0}
								{@const inFavourPct = (inFavour / (inFavour + against)) * 100}
								<li class="row-wrap">
									<button
										type="button"
										class="row"
										class:row--on={isOpen}
										onclick={() => toggleOpen(s.id)}
									>
										<div class="row-id">
											<span class="row-id-main">{fmtDateShort(s.date)}</span>
											{#if s.dossier_numbers?.[0]}
												<span class="row-id-sub">{s.dossier_numbers[0]}</span>
											{/if}
										</div>
										<div class="row-body">
											<div class="row-title">{s.subject ?? '—'}</div>
											{#if inFavour + against > 0}
												<span
													class="stem-mini"
													title="Zetelverdeling: {s.voters?.['Voor'] ?? 0} voor, {s.voters?.[
														'Tegen'
													] ?? 0} tegen ({s.vote_kind === 'member' ? 'leden' : 'fracties'})"
												>
													<span class="stem-mini__v">{inFavour}</span>
													<span class="stem-mini__bar">
														<span class="stem-mini__bar-v" style:width="{inFavourPct}%"></span>
														<span class="stem-mini__bar-t" style:width="{100 - inFavourPct}%"
														></span>
													</span>
													<span class="stem-mini__t">{against}</span>
													<span class="stem-mini__unit">zetels</span>
												</span>
											{/if}
										</div>
										<div class="row-aside">
											{#if s.passed != null}
												<span
													class="tag"
													class:tag--passed={s.passed}
													class:tag--rejected={!s.passed}
												>
													<span class="tag-dot" aria-hidden="true"></span>
													{s.passed ? 'Aangenomen' : 'Verworpen'}
												</span>
											{/if}
										</div>
									</button>
									{#if isOpen}
										<div class="detail">
											<IndexDetail
												category="decisions"
												record={s}
												onDiscover={() => discover('decisions', s.key)}
												onSplit={() => onSelectItem('decisions', s.key)}
											/>
										</div>
									{/if}
								</li>
							{/each}
						</ul>
						{@render loadMoreButton(pages.decisions, 'stemmingen')}
					{/if}
				{/if}
			</div>
		</div>
	</div>
</div>

{#snippet stageFilter()}
	<IndexStageFilter selected={stage ?? null} onSelect={(s) => toggleParam('stage', stage, s)} />
{/snippet}

{#snippet loadMoreButton(loaded: AnyPage | undefined, noun: string)}
	{#if loaded?.more}
		{@const remaining = loaded.total - loaded.items.length}
		<div class="load-more">
			<button type="button" class="load-more-btn" onclick={loadMore} disabled={loadingMore}>
				{loadingMore
					? 'Laden…'
					: `Meer ${noun} laden${remaining > 0 ? ` (${remaining.toLocaleString('nl-NL')} resterend)` : ''}`}
			</button>
		</div>
	{/if}
{/snippet}

<style>
	.index-view {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	/* ── Category bar ─────────────────────────────────────────────────── */
	.catbar {
		display: flex;
		align-items: stretch;
		gap: 0;
		padding: 0 32px;
		border-bottom: 1px solid var(--rule);
		background: var(--paper);
		flex-shrink: 0;
		overflow-x: auto;
	}
	.cat {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 16px 20px 14px;
		background: transparent;
		border: 0;
		cursor: pointer;
		border-bottom: 2px solid transparent;
		white-space: nowrap;
	}
	.cat-name {
		font-family: var(--font-serif);
		font-size: 17px;
		color: var(--ink-3);
		line-height: 1;
		transition: color var(--dur-1) var(--ease);
	}
	.cat:hover .cat-name {
		color: var(--ink-2);
	}
	.cat--on {
		border-bottom-color: var(--ink);
	}
	.cat--on .cat-name {
		color: var(--ink);
		font-weight: 500;
	}

	/* ── Stage container ─────────────────────────────────────────────── */
	.stage {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	.stage-scroll {
		flex: 1;
		overflow-y: auto;
	}
	.page {
		max-width: 1320px;
		margin: 0 auto;
		padding: 28px 32px 80px;
	}
	.page--wide {
		max-width: 1480px;
	}

	/* ── Hemicycle card (factions only) ──────────────────────────────── */
	.hemi-card {
		margin-bottom: 28px;
		padding: 22px 28px;
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
	}
	.hemi-svg-wrap :global(.hemicycle) {
		background: transparent;
	}

	/* ── Status and empty states ─────────────────────────────────────── */
	.status-line {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--t-body-2);
		color: var(--ink-3);
		margin: 12px 0;
	}
	.status-line--error {
		color: var(--ink-2);
	}
	.empty {
		padding: 80px 40px;
		text-align: center;
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 16px;
		color: var(--ink-3);
	}

	/* ── List and row ────────────────────────────────────────────────── */
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.row-wrap {
		display: flex;
		flex-direction: column;
	}
	/* Rows keep apart by padding and the hover field; no rule between them. */
	.row {
		display: grid;
		grid-template-columns: 200px minmax(0, 1fr) 200px;
		gap: 28px;
		width: 100%;
		padding: 16px 8px;
		border: 0;
		border-radius: var(--r-1);
		cursor: pointer;
		background: transparent;
		text-align: left;
		align-items: baseline;
		transition: background var(--dur-1) var(--ease);
		color: inherit;
		font: inherit;
	}
	.row:hover {
		background: var(--paper-2);
	}
	.row--on {
		background: var(--paper-2);
	}
	.row--on .row-title {
		color: var(--accent);
	}
	.row:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: -2px;
	}

	.row-id {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
		line-height: 1.4;
		padding-top: 3px;
	}
	.row-id-main {
		display: block;
	}
	.row-id-main--inline {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.row-id-sub {
		display: block;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
		margin-top: 2px;
	}

	.row-body {
		min-width: 0;
	}
	.row-title {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
		line-height: var(--lh-snug);
		text-wrap: pretty;
		transition: color var(--dur-1) var(--ease);
		/* Two lines at most; the full title is in the inline detail. */
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}
	.row-sub {
		display: block;
		margin-top: 5px;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.row-sub--mono {
		font-variant-numeric: tabular-nums;
	}

	.row-aside {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		text-align: right;
		flex-wrap: wrap;
		padding-top: 2px;
	}

	/* Qualities on a row are words: the outcome of a vote in ink-2, the rest in ink-3. */
	.tag {
		display: inline-flex;
		align-items: baseline;
		gap: 5px;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
		white-space: nowrap;
		line-height: 22px;
	}
	.tag-dot {
		display: none;
	}
	.tag--passed,
	.tag--rejected {
		color: var(--ink-2);
		font-weight: 500;
	}

	.num-strong {
		font-family: var(--font-serif);
		font-size: 17px;
		color: var(--ink);
		font-feature-settings: 'lnum';
		line-height: 1;
	}
	.num-lbl {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
		margin-left: 4px;
	}

	.party-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
		vertical-align: middle;
	}

	/* Seats for and against on a decision row; the numbers say which is which. */
	.stem-mini {
		display: inline-grid;
		grid-template-columns: 32px 140px 32px auto;
		gap: 8px;
		align-items: center;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		margin-top: 6px;
	}
	.stem-mini__v {
		color: var(--ink-2);
		text-align: right;
		font-weight: 500;
	}
	.stem-mini__t {
		color: var(--ink-2);
		text-align: left;
		font-weight: 500;
	}
	.stem-mini__unit {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.stem-mini__bar {
		height: 8px;
		background: var(--paper-2);
		border-radius: var(--r-1);
		overflow: hidden;
		display: flex;
	}
	.stem-mini__bar-v {
		background: var(--ink-2);
	}
	.stem-mini__bar-t {
		background: var(--rule-strong);
	}

	/* Inline detail */
	.detail {
		background: var(--paper-2);
		border-radius: 0 0 var(--r-1) var(--r-1);
		padding: 0 8px 0 200px;
	}

	/* Committees: where the ones without dossiers begin */
	.group-divider {
		list-style: none;
		padding: 18px 8px 10px;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		border-bottom: 1px solid var(--rule);
	}

	/* Load more */
	.load-more {
		display: flex;
		justify-content: center;
		padding: 24px 0 12px;
	}
	.load-more-btn {
		height: 32px;
		padding: 0 16px;
		background: transparent;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-2);
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease);
	}
	.load-more-btn:hover:not(:disabled) {
		background: var(--paper-2);
		color: var(--ink);
	}
	.load-more-btn:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	/* Narrow viewports: the columns stack. */
	@media (max-width: 768px) {
		.row {
			grid-template-columns: 1fr;
			gap: 4px;
			padding: 14px 8px;
		}
		.row-aside {
			justify-content: flex-start;
			padding-top: 6px;
		}
		.detail {
			padding-left: 0;
		}
		.catbar {
			padding: 0 16px;
		}
		.cat {
			padding: 12px 14px;
		}
		.page {
			padding: 18px 16px 60px;
		}
	}
</style>

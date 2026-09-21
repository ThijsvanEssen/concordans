<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import { judgmentTier, formatEcliLabel } from '$lib/graph/types';

	type Hit = Schema<'SearchResultItem'>;

	const query = $derived($page.url.searchParams.get('q') ?? '');
	let results = $state<Record<string, Hit[]>>({});
	let loading = $state(false);
	let error = $state<string | null>(null);
	let searchInput = $state('');
	let submitting = $state(false);

	// Domain visibility chips. Default: all on.
	let showWet = $state(true);
	let showRecht = $state(true);
	let showTk = $state(true);

	$effect(() => {
		const q = query;
		searchInput = q;
		error = null;
		if (!q) {
			results = {};
			return;
		}
		const controller = new AbortController();
		loading = true;
		unwrap(
			api.GET('/api/search', { params: { query: { q, limit: 50 } }, signal: controller.signal })
		)
			.then((r) => {
				results = r.results;
				loading = false;
			})
			.catch(() => {
				if (controller.signal.aborted) return;
				error = 'Zoeken mislukt. Controleer de verbinding.';
				loading = false;
			});
		return () => controller.abort();
	});

	function handleSearch(e: Event) {
		e.preventDefault();
		const q = searchInput.trim();
		if (!q) return;
		submitting = true;
		goto(`/search?q=${encodeURIComponent(q)}`, { replaceState: true }).finally(() => {
			submitting = false;
		});
	}

	// Wetgeving: instruments and articles (articles grouped by law).
	// Rechtspraak: judgments (grouped by court tier).
	// Parlementair: dossiers, committees, factions, members and documents.

	const hits = (group: string): Hit[] => results[group] ?? [];
	const extra = (item: Hit, name: string): string => String(item.extra?.[name] ?? '');

	type ArticleGroup = { bwbId: string; lawName: string; items: Hit[] };
	const articleGroups = $derived.by<ArticleGroup[]>(() => {
		const groups = new Map<string, ArticleGroup>();
		for (const a of hits('articles')) {
			const bwbId = extra(a, 'bwb_id');
			let g = groups.get(bwbId);
			if (!g) {
				g = { bwbId, lawName: extra(a, 'citation_title') || bwbId, items: [] };
				groups.set(bwbId, g);
			}
			g.items.push(a);
		}
		return [...groups.values()].sort((a, b) => b.items.length - a.items.length);
	});

	const TIER_LABEL: Record<string, string> = {
		cassation: 'Hoge Raad',
		appeal: 'Hoven & RvS',
		first: 'Rechtbanken',
		unknown: 'Overig'
	};
	type JudgmentGroup = { tier: string; label: string; items: Hit[] };
	const judgmentGroups = $derived.by<JudgmentGroup[]>(() => {
		const buckets: Record<string, Hit[]> = { cassation: [], appeal: [], first: [], unknown: [] };
		for (const j of hits('judgments')) buckets[judgmentTier(extra(j, 'ecli'))].push(j);
		return Object.entries(buckets)
			.filter(([, items]) => items.length > 0)
			.map(([tier, items]) => ({ tier, label: TIER_LABEL[tier], items }));
	});

	// Sub-groups of the parliamentary domain, in display order.
	const TK_GROUPS: { name: string; title: string; glyph: string; cite: (item: Hit) => string }[] = [
		{ name: 'dossiers', title: 'Wetgevingsdossiers', glyph: '∮', cite: (i) => extra(i, 'number') },
		{ name: 'committees', title: 'Commissies', glyph: '‡', cite: (i) => extra(i, 'abbreviation') },
		{ name: 'factions', title: 'Fracties', glyph: '※', cite: (i) => extra(i, 'abbreviation') },
		{ name: 'members', title: 'Kamerleden', glyph: '◉', cite: (i) => extra(i, 'party') },
		{ name: 'documents', title: 'Documenten', glyph: '▤', cite: (i) => extra(i, 'kind') }
	];

	const wetCount = $derived(hits('articles').length + hits('instruments').length);
	const rechtCount = $derived(hits('judgments').length);
	const tkCount = $derived(TK_GROUPS.reduce((n, g) => n + hits(g.name).length, 0));
	const totalCount = $derived(wetCount + rechtCount + tkCount);

	function exploreHref(item: Hit): string {
		return `/explore?mode=split&focus=${encodeURIComponent(item.id)}`;
	}
	function ecliLabel(item: Hit): string {
		const ecli = extra(item, 'ecli');
		return ecli ? formatEcliLabel(ecli) : (item.display_name ?? item.key);
	}
</script>

<svelte:head>
	<title>{query ? `"${query}", zoekresultaten` : 'Zoeken'}. Concordans</title>
</svelte:head>

<div class="search-page">
	<header class="search-header">
		<form class="search-form" onsubmit={handleSearch} role="search">
			<input
				type="search"
				bind:value={searchInput}
				placeholder="Zoek op artikel, ECLI, kamerstuk of begrip"
				class="search-form__input"
				aria-label="Zoeken"
				autofocus
			/>
			<button
				type="submit"
				class="search-form__btn"
				disabled={submitting || !searchInput.trim()}
				aria-busy={submitting}
			>
				{submitting ? 'Zoeken…' : 'Zoeken'}
			</button>
		</form>
	</header>

	<div class="search-results">
		{#if loading}
			<div class="search-status">Zoeken…</div>
		{:else if error}
			<div class="search-status search-status--error">{error}</div>
		{:else if !query}
			<div class="search-status">Zoek in artikelen, uitspraken en dossiers.</div>
		{:else if totalCount === 0}
			<div class="search-status">Geen resultaten voor <strong>"{query}"</strong>.</div>
			<p class="no-results-hint">
				Probeer een ECLI-nummer (ECLI:NL:HR:…), BWB-code (BWBR…) of trefwoord.
			</p>
		{:else}
			<div class="results-header">
				<p class="results-meta">{totalCount} resultaten voor <strong>"{query}"</strong></p>
				<div class="domain-chips" role="group" aria-label="Filter op domein">
					<button
						type="button"
						class="chip chip--wet"
						class:chip--off={!showWet}
						aria-pressed={showWet}
						onclick={() => (showWet = !showWet)}
					>
						<span class="chip__glyph">§</span> Wetgeving <span class="chip__count">{wetCount}</span>
					</button>
					<button
						type="button"
						class="chip chip--recht"
						class:chip--off={!showRecht}
						aria-pressed={showRecht}
						onclick={() => (showRecht = !showRecht)}
					>
						<span class="chip__glyph">¶</span> Rechtspraak
						<span class="chip__count">{rechtCount}</span>
					</button>
					<button
						type="button"
						class="chip chip--tk"
						class:chip--off={!showTk}
						aria-pressed={showTk}
						onclick={() => (showTk = !showTk)}
					>
						<span class="chip__glyph">∮</span> Parlementair
						<span class="chip__count">{tkCount}</span>
					</button>
				</div>
			</div>

			<!-- ── Wetgeving ──────────────────────────────────────────────────── -->
			{#if showWet && wetCount > 0}
				<section class="domain domain--wet">
					<header class="domain__head">
						<span class="domain__glyph">§</span>
						<h2 class="domain__title">Wetgeving</h2>
						<span class="domain__count">{wetCount}</span>
					</header>

					{#if hits('instruments').length > 0}
						<div class="subgroup" id="instruments">
							<h3 class="subgroup__title">
								Instrumenten <span>{hits('instruments').length}</span>
							</h3>
							<ul class="result-list">
								{#each hits('instruments') as item (item.id)}
									<li class="result-item">
										<a href={exploreHref(item)} class="result-item__link">
											<span class="leg-glyph leg-glyph--wet" aria-hidden="true">§</span>
											<span class="result-item__body">
												<span class="result-item__title">{item.display_name ?? item.key}</span>
												{#if item.snippet}<p class="result-item__snippet">{item.snippet}</p>{/if}
											</span>
											<span class="result-item__cite mono">{extra(item, 'bwb_id')}</span>
										</a>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if articleGroups.length > 0}
						<div class="subgroup" id="articles">
							<h3 class="subgroup__title">Artikelen <span>{hits('articles').length}</span></h3>
							{#each articleGroups as g (g.bwbId)}
								<div class="article-group">
									<h4 class="article-group__law">
										{g.lawName}
										<span class="article-group__count">{g.items.length}</span>
									</h4>
									<ul class="result-list">
										{#each g.items as item (item.id)}
											<li class="result-item">
												<a href={exploreHref(item)} class="result-item__link">
													<span class="leg-glyph leg-glyph--wet" aria-hidden="true">❡</span>
													<span class="result-item__body">
														<span class="result-item__title">{item.display_name ?? item.key}</span>
														{#if item.snippet}<p class="result-item__snippet">
																{item.snippet}
															</p>{/if}
													</span>
													<span class="result-item__cite mono">{extra(item, 'article_number')}</span
													>
												</a>
											</li>
										{/each}
									</ul>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{/if}

			<!-- ── Rechtspraak ────────────────────────────────────────────────── -->
			{#if showRecht && rechtCount > 0}
				<section class="domain domain--recht">
					<header class="domain__head">
						<span class="domain__glyph">¶</span>
						<h2 class="domain__title">Rechtspraak</h2>
						<span class="domain__count">{rechtCount}</span>
					</header>

					{#each judgmentGroups as g, gi (g.tier)}
						<div class="subgroup" id={gi === 0 ? 'judgments' : undefined}>
							<h3 class="subgroup__title">{g.label} <span>{g.items.length}</span></h3>
							<ul class="result-list">
								{#each g.items as item (item.id)}
									<li class="result-item">
										<a href={exploreHref(item)} class="result-item__link">
											<span class="leg-glyph leg-glyph--recht" aria-hidden="true">¶</span>
											<span class="result-item__body">
												<span class="result-item__title">{ecliLabel(item)}</span>
												{#if item.snippet}<p class="result-item__snippet">{item.snippet}</p>{/if}
											</span>
											<span class="result-item__cite mono">{extra(item, 'ecli')}</span>
										</a>
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</section>
			{/if}

			<!-- ── Parlementair ───────────────────────────────────────────────── -->
			{#if showTk && tkCount > 0}
				<section class="domain domain--tk">
					<header class="domain__head">
						<span class="domain__glyph">∮</span>
						<h2 class="domain__title">Parlementair</h2>
						<span class="domain__count">{tkCount}</span>
					</header>

					{#each TK_GROUPS as g (g.name)}
						{#if hits(g.name).length > 0}
							<div class="subgroup" id={g.name}>
								<h3 class="subgroup__title">{g.title} <span>{hits(g.name).length}</span></h3>
								<ul class="result-list">
									{#each hits(g.name) as item (item.id)}
										<li class="result-item">
											<a href={exploreHref(item)} class="result-item__link">
												<span class="leg-glyph leg-glyph--tk" aria-hidden="true">{g.glyph}</span>
												<span class="result-item__body">
													<span class="result-item__title">{item.display_name ?? item.key}</span>
													{#if item.snippet}<p class="result-item__snippet">{item.snippet}</p>{/if}
												</span>
												<span class="result-item__cite mono">{g.cite(item)}</span>
											</a>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
					{/each}
				</section>
			{/if}
		{/if}
	</div>
</div>

<style>
	.search-page {
		width: 100%;
		max-width: 760px;
		margin: 0 auto;
		padding: var(--s-6) var(--s-5) var(--s-8);
		display: flex;
		flex-direction: column;
		gap: var(--s-5);
	}

	/* ── Search form ─────────────────────────────────────────────────────── */
	.search-form {
		display: flex;
		gap: var(--s-2);
		border-bottom: 1px solid var(--rule);
		padding-bottom: var(--s-4);
	}
	.search-form__input {
		flex: 1;
		height: 40px;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		padding: 0 var(--s-4);
		font-family: var(--font-serif);
		font-size: 18px;
		background: var(--paper);
		color: var(--ink);
	}
	.search-form__input:focus {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
		border-color: var(--accent);
	}
	.search-form__btn {
		height: 40px;
		padding: 0 var(--s-4);
		border: none;
		border-radius: var(--r-1);
		background: var(--ink);
		color: var(--paper);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-weight: 500;
		cursor: pointer;
		transition: background var(--dur-1) var(--ease);
	}
	.search-form__btn:hover:not(:disabled) {
		background: var(--ink-2);
	}
	.search-form__btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	/* ── Status / header row ─────────────────────────────────────────────── */
	.search-results {
		display: flex;
		flex-direction: column;
		gap: var(--s-6);
	}
	.search-status {
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--fg-3);
		font-size: 18px;
		padding: var(--s-6) 0;
		text-align: center;
	}
	.search-status--error {
		color: var(--accent);
		font-style: normal;
	}
	.no-results-hint {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 13px;
		color: var(--ink-4);
		text-align: center;
		margin: 0 0 var(--s-4);
	}

	.results-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-3);
	}
	.results-meta {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--fg-3);
	}

	/* ── Domain chips ────────────────────────────────────────────────────── */
	.domain-chips {
		display: flex;
		gap: var(--s-2);
		flex-wrap: wrap;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: 999px;
		border: 1px solid var(--rule-strong);
		background: var(--paper);
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-2);
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease),
			opacity var(--dur-1) var(--ease);
	}
	.chip__glyph {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 14px;
		line-height: 1;
	}
	.chip__count {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--fg-3);
	}
	.chip:hover {
		background: var(--paper-3);
	}
	.chip--wet .chip__glyph {
		color: var(--ink);
	}
	.chip--recht .chip__glyph {
		color: var(--indigo);
	}
	.chip--tk .chip__glyph {
		color: var(--spine);
	}
	.chip--off {
		opacity: 0.45;
		text-decoration: line-through;
	}
	.chip--off .chip__glyph {
		color: var(--ink-4);
	}

	/* ── Domain section ──────────────────────────────────────────────────── */
	.domain {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}
	.domain__head {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding-bottom: var(--s-2);
		border-bottom: 1px solid var(--rule-strong);
	}
	.domain__glyph {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 22px;
		line-height: 1;
	}
	.domain--wet .domain__glyph {
		color: var(--ink);
	}
	.domain--recht .domain__glyph {
		color: var(--indigo);
	}
	.domain--tk .domain__glyph {
		color: var(--spine);
	}
	.domain__title {
		margin: 0;
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 18px;
		color: var(--ink);
	}
	.domain__count {
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--fg-3);
	}

	/* ── Sub-group (Instrumenten, Artikelen, Hoge Raad, Dossiers, ...) ───── */
	.subgroup {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.subgroup + .subgroup {
		margin-top: var(--s-3);
	}
	.subgroup__title {
		margin: 0;
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.subgroup__title span {
		font-family: var(--font-mono);
		font-weight: 400;
		color: var(--fg-4);
	}

	/* ── Article group within Wetgeving ──────────────────────────────────── */
	.article-group {
		margin-top: var(--s-2);
	}
	.article-group + .article-group {
		margin-top: var(--s-3);
	}
	.article-group__law {
		margin: 0 0 4px;
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--fg-2);
		display: flex;
		align-items: baseline;
		gap: 6px;
	}
	.article-group__count {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--fg-4);
	}

	/* ── Result list ─────────────────────────────────────────────────────── */
	.result-list {
		list-style: none;
		padding: 0;
		margin: 0;
		border-top: 1px solid var(--rule);
	}
	.result-item {
		border-bottom: 1px solid var(--rule);
	}
	.result-item__link {
		display: flex;
		align-items: baseline;
		gap: var(--s-3);
		padding: var(--s-3) 0;
		text-decoration: none;
		color: inherit;
		transition: background var(--dur-1) var(--ease);
	}
	.result-item__link:hover {
		background: var(--paper-3);
	}

	.leg-glyph {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 16px;
		line-height: 1;
		width: 14px;
		text-align: center;
		flex-shrink: 0;
		margin-top: 2px;
	}
	.leg-glyph--wet {
		color: var(--ink);
	}
	.leg-glyph--recht {
		color: var(--indigo);
	}
	.leg-glyph--tk {
		color: var(--spine);
	}

	.result-item__body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.result-item__title {
		font-family: var(--font-serif);
		font-size: 16px;
		color: var(--ink);
		line-height: 1.25;
	}
	.result-item__snippet {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--fg-3);
		line-height: 1.5;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	.result-item__cite {
		font-size: 11px;
		color: var(--fg-3);
		white-space: nowrap;
		flex-shrink: 0;
	}
	.mono {
		font-family: var(--font-mono);
	}
</style>

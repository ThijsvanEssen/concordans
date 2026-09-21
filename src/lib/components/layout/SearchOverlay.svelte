<script lang="ts">
	import { goto } from '$app/navigation';
	import { track } from '$lib/analytics';
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import { judgmentTier, formatEcliLabel } from '$lib/graph/types';

	type Hit = Schema<'SearchResultItem'>;

	let { open, onClose }: { open: boolean; onClose: () => void } = $props();

	// Sections per domain, in display order. `cap` is how many hits the overlay shows;
	// the request asks for one more to know whether the full results page has more.
	const DOMAINS = {
		wet: ['instruments', 'articles'],
		recht: ['judgments'],
		tk: ['dossiers', 'committees', 'factions', 'members', 'documents']
	} as const;
	const CAP = {
		articles: 10,
		instruments: 6,
		judgments: 8,
		dossiers: 8,
		committees: 6,
		factions: 6,
		members: 6,
		documents: 8
	} as const;
	type Group = keyof typeof CAP;
	const FETCH_LIMIT = Math.max(...Object.values(CAP)) + 1;

	// Parliamentary sections share one layout: label, glyph and the short reference on the right.
	const TK_SECTIONS: {
		name: Group;
		title: string;
		glyph: string;
		more: string;
		cite: (item: Hit) => string;
	}[] = [
		{
			name: 'dossiers',
			title: 'Wetgevingsdossiers',
			glyph: 'Dos.',
			more: 'dossiers',
			cite: (i) => extra(i, 'number')
		},
		{ name: 'committees', title: 'Commissies', glyph: 'Com.', more: 'commissies', cite: () => '' },
		{ name: 'factions', title: 'Fracties', glyph: 'Fra.', more: 'fracties', cite: () => '' },
		{
			name: 'members',
			title: 'Kamerleden',
			glyph: 'Lid',
			more: 'kamerleden',
			cite: (i) => extra(i, 'party')
		},
		{ name: 'documents', title: 'Documenten', glyph: 'Doc.', more: 'documenten', cite: () => '' }
	];

	// Veelgebruikte ingangen: directe links naar de verkenner.
	const SUGGESTIONS = [
		{
			href: '/explore?focus=articles%2Fbwbr0005289_162&from=search',
			query: 'Art. 6:162 BW',
			label: 'Art. 6:162 BW',
			desc: 'Onrechtmatige daad'
		},
		{
			href: '/explore?focus=articles%2Fbwbr0001840_1&from=search',
			query: 'Art. 1 Grondwet',
			label: 'Art. 1 Grondwet',
			desc: 'Gelijkheidsbeginsel'
		},
		{
			href: '/explore?focus=judgments%2Fecli_nl_hr_1965_ab7079&from=search',
			query: 'ECLI:NL:HR:1965:AB7079',
			label: 'ECLI:NL:HR:1965:AB7079',
			desc: 'Kelderluik'
		},
		{
			href: '/explore?focus=articles%2Fbwbr0001854_287&from=search',
			query: 'Art. 287 Sr',
			label: 'Art. 287 Sr',
			desc: 'Doodslag'
		},
		{
			href: '/explore?focus=dossiers%2F36600&from=search',
			query: 'Dossier 36600',
			label: 'Dossier 36600',
			desc: 'Belastingdienst'
		}
	];

	let query = $state('');
	let results = $state<Partial<Record<Group, Hit[]>>>({});
	let loading = $state(false);
	let inputEl = $state<HTMLInputElement | null>(null);
	let modalEl = $state<HTMLDivElement | null>(null);
	let focusedIndex = $state(-1);
	let previousFocus: HTMLElement | null = null;

	const extra = (item: Hit, name: string): string => String(item.extra?.[name] ?? '');

	// What the overlay shows; the surplus hit only feeds the "+ meer" link.
	const vis = $derived(
		Object.fromEntries(
			(Object.keys(CAP) as Group[]).map((g) => [g, (results[g] ?? []).slice(0, CAP[g])])
		) as Record<Group, Hit[]>
	);
	const hasMore = (g: Group) => (results[g]?.length ?? 0) > CAP[g];

	// Domain visibility chips. Default: all on.
	let showWet = $state(true);
	let showRecht = $state(true);
	let showTk = $state(true);
	const shown = $derived({ wet: showWet, recht: showRecht, tk: showTk });

	type ArticleGroup = { bwbId: string; lawName: string; items: Hit[] };
	const articleGroups = $derived.by<ArticleGroup[]>(() => {
		const groups = new Map<string, ArticleGroup>();
		for (const a of vis.articles) {
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
		for (const j of vis.judgments) buckets[judgmentTier(extra(j, 'ecli'))].push(j);
		return Object.entries(buckets)
			.filter(([, items]) => items.length > 0)
			.map(([tier, items]) => ({ tier, label: TIER_LABEL[tier], items }));
	});

	const count = (groups: readonly Group[]) => groups.reduce((n, g) => n + vis[g].length, 0);
	const wetCount = $derived(count(DOMAINS.wet));
	const rechtCount = $derived(count(DOMAINS.recht));
	const tkCount = $derived(count(DOMAINS.tk));
	const totalCount = $derived(wetCount + rechtCount + tkCount);

	// Keyboard order: the hits of every visible domain, section after section. `offset`
	// is where each section starts in that list.
	const flat = $derived.by(() => {
		const items: Hit[] = [];
		const offset = {} as Record<Group, number>;
		for (const domain of ['wet', 'recht', 'tk'] as const) {
			if (!shown[domain]) continue;
			for (const g of DOMAINS[domain]) {
				offset[g] = items.length;
				items.push(...vis[g]);
			}
		}
		return { items, offset };
	});
	const hasResults = $derived(flat.items.length > 0);

	function trapFocus(e: KeyboardEvent) {
		if (e.key !== 'Tab' || !modalEl) return;
		const focusable = modalEl.querySelectorAll<HTMLElement>(
			'button, input, a[href], [tabindex]:not([tabindex="-1"])'
		);
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (e.shiftKey) {
			if (document.activeElement === first) {
				e.preventDefault();
				last.focus();
			}
		} else {
			if (document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	// Boek van het Burgerlijk Wetboek naar BWB-id, en de wetboeken met doorlopende artikelnummers.
	const BW_BOOK: Record<string, string> = {
		'1': 'BWBR0002656',
		'2': 'BWBR0003045',
		'3': 'BWBR0005291',
		'4': 'BWBR0002761',
		'5': 'BWBR0005288',
		'6': 'BWBR0005289',
		'7': 'BWBR0005290'
	};
	const WETBOEK_BWB: Record<string, string> = {
		sr: 'BWBR0001854',
		sv: 'BWBR0001903',
		awb: 'BWBR0005537',
		gw: 'BWBR0001840',
		awr: 'BWBR0002320',
		rv: 'BWBR0001827'
	};

	// "Art. 6:162 BW", "ECLI:NL:HR:1965:AB7079" en "Dossier 36600" leveren een directe
	// focus-link op, zonder dat de zoekopdracht daarvoor hoeft te ranken.
	type DirectHit = { href: string; label: string; desc: string };
	function directHitFor(q: string): DirectHit | null {
		const trimmed = q.trim();

		const art = trimmed.match(
			/^(?:art(?:ikel)?\.?\s*)?(?:(\d):)?(\d+[a-z]?)\s+(BW|Sr|Sv|Awb|Gw|AWR|Rv)\b/i
		);
		if (art) {
			const [, book, number, wetboek] = art;
			const bwb =
				wetboek.toLowerCase() === 'bw'
					? book && BW_BOOK[book]
					: !book && WETBOEK_BWB[wetboek.toLowerCase()];
			if (bwb) {
				return {
					href: `/explore?focus=articles%2F${bwb.toLowerCase()}_${number.toLowerCase()}&from=search`,
					label: `Art. ${book ? `${book}:` : ''}${number} ${wetboek.toUpperCase()}`,
					desc: 'Open direct in de verkenner'
				};
			}
		}

		if (/^ECLI:NL:[A-Z]+:\d+:\w+$/i.test(trimmed)) {
			return {
				href: `/explore?focus=judgments%2F${trimmed.toLowerCase().replaceAll(':', '_')}&from=search`,
				label: trimmed.toUpperCase(),
				desc: 'Open uitspraak direct'
			};
		}

		const dossier = trimmed.match(/^(?:dossier\s+)?(\d{4,6})$/i);
		if (dossier) {
			return {
				href: `/explore?focus=dossiers%2F${dossier[1]}&from=search`,
				label: `Dossier ${dossier[1]}`,
				desc: 'Open dossier direct'
			};
		}

		return null;
	}

	const directHit = $derived<DirectHit | null>(directHitFor(query));

	$effect(() => {
		if (open) {
			previousFocus = document.activeElement as HTMLElement;
			requestAnimationFrame(() => inputEl?.focus());
		} else {
			query = '';
			results = {};
			focusedIndex = -1;
			previousFocus?.focus();
			previousFocus = null;
		}
	});

	$effect(() => {
		void flat;
		focusedIndex = -1;
	});

	// Search as you type: a short debounce, and the request of the previous keystroke is
	// aborted so a late answer cannot overwrite a newer one. Earlier results stay on screen
	// while the next request runs.
	$effect(() => {
		const q = query.trim();
		if (!q) {
			loading = false;
			results = {};
			return;
		}
		const controller = new AbortController();
		const timer = setTimeout(() => {
			loading = true;
			unwrap(
				api.GET('/api/search', {
					params: { query: { q, limit: FETCH_LIMIT } },
					signal: controller.signal
				})
			)
				.then((r) => {
					results = r.results;
					loading = false;
				})
				.catch(() => {
					if (controller.signal.aborted) return;
					results = {};
					loading = false;
				});
		}, 60);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	// A picked result opens in the split view; `from=search` makes the explore page clear
	// the canvas first, since a search is a jump and not an accumulation.
	function exploreHrefFor(item: Hit): string {
		return `/explore?mode=split&from=search&focus=${encodeURIComponent(item.id)}`;
	}

	function pick(item: Hit) {
		track('search_resolved', { type: item.collection });
		onClose();
		goto(exploreHrefFor(item));
	}

	function ecliLabel(item: Hit): string {
		const ecli = extra(item, 'ecli');
		return ecli ? formatEcliLabel(ecli) : (item.display_name ?? item.key);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (open) trapFocus(e);
		if (e.key === 'Escape' && open) {
			onClose();
			return;
		}
		if (!open || !hasResults) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			focusedIndex = Math.min(focusedIndex + 1, flat.items.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			focusedIndex = Math.max(focusedIndex - 1, -1);
			if (focusedIndex === -1) inputEl?.focus();
		} else if (e.key === 'Enter' && focusedIndex >= 0) {
			e.preventDefault();
			pick(flat.items[focusedIndex]);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet directHitRow(hit: DirectHit)}
	<a
		class="direct-hit"
		href={hit.href}
		onclick={() => {
			track('search_direct_pick', { query });
			onClose();
		}}
	>
		<span class="direct-hit__icon" aria-hidden="true">↳</span>
		<span class="direct-hit__label">{hit.label}</span>
		<span class="direct-hit__desc">{hit.desc}</span>
	</a>
{/snippet}

{#snippet moreRow(g: Group, anchor: string, label: string)}
	{#if hasMore(g)}
		<a class="more-row" href="/search?q={encodeURIComponent(query)}#{anchor}" onclick={onClose}
			>+ meer {label} →</a
		>
	{/if}
{/snippet}

{#if open}
	<div class="overlay" onclick={onClose}>
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-label="Zoeken"
			onclick={(e) => e.stopPropagation()}
			bind:this={modalEl}
		>
			<div class="input-row">
				{#if loading}
					<span class="search-spinner" aria-hidden="true"></span>
				{:else}
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						aria-hidden="true"
					>
						<circle cx="11" cy="11" r="7" />
						<path d="m20 20-3.5-3.5" />
					</svg>
				{/if}
				<input
					bind:this={inputEl}
					bind:value={query}
					placeholder="Zoek een artikel, arrest of wet…"
					type="text"
					autocomplete="off"
					spellcheck="false"
				/>
				<span class="kbd">esc</span>
			</div>

			{#if query.trim() && totalCount > 0}
				<div class="chip-row">
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
			{/if}

			<span class="sr-only" aria-live="polite" aria-atomic="true"
				>{totalCount > 0 ? `${totalCount} resultaten` : ''}</span
			>
			<div class="results-list" aria-live="polite" aria-atomic="false">
				{#if !query.trim()}
					<div class="suggestions">
						<p class="suggestions__label">Veelgebruikte ingangen:</p>
						{#each SUGGESTIONS as s, i (i)}
							<a
								class="suggestion-row"
								href={s.href}
								onclick={() => {
									track('search_suggestion_pick', { query: s.query });
									onClose();
								}}
							>
								<span class="suggestion__label">{s.label}</span>
								<span class="suggestion__desc">{s.desc}</span>
							</a>
						{/each}
					</div>
				{:else}
					{#if directHit}{@render directHitRow(directHit)}{/if}

					{#if totalCount === 0}
						{#if loading}
							<div class="group-label">Zoeken…</div>
						{:else if !directHit}
							<div class="empty">Geen resultaten voor <strong>"{query}"</strong>.</div>
							<p class="no-results-hint">
								Probeer een ECLI-nummer (ECLI:NL:HR:…), BWB-code (BWBR…) of trefwoord. Kamerleden:
								<a href="/explore?mode=index&kind=members" onclick={onClose} class="leden-hint-link"
									>index →</a
								>
							</p>
						{/if}
					{:else}
						<!-- Wetgeving -->
						{#if showWet && wetCount > 0}
							<div class="domain domain--wet">
								<div class="domain__head">
									<span class="domain__glyph">§</span><span class="domain__title">Wetgeving</span>
								</div>

								{#if vis.instruments.length > 0}
									<div class="subgroup-label">Instrumenten</div>
									{#each vis.instruments as item, i (item.id)}
										{@const idx = flat.offset.instruments + i}
										<button
											class="result-row"
											class:result-row--focused={idx === focusedIndex}
											onclick={() => pick(item)}
											onmouseenter={() => (focusedIndex = idx)}
										>
											<span class="leg-glyph leg-glyph--wet" aria-hidden="true">Wet.</span>
											<span class="result-title">{item.display_name ?? item.key}</span>
											<span class="result-cite mono">{extra(item, 'bwb_id')}</span>
										</button>
									{/each}
									{@render moreRow('instruments', 'instruments', 'instrumenten')}
								{/if}

								{#each articleGroups as g (g.bwbId)}
									<div class="subgroup-label subgroup-label--law">
										{g.lawName} <span>{g.items.length}</span>
									</div>
									{#each g.items as item (item.id)}
										{@const idx = flat.offset.articles + vis.articles.indexOf(item)}
										<button
											class="result-row"
											class:result-row--focused={idx === focusedIndex}
											onclick={() => pick(item)}
											onmouseenter={() => (focusedIndex = idx)}
										>
											<span class="leg-glyph leg-glyph--wet" aria-hidden="true">Art.</span>
											<span class="result-title">{item.display_name ?? item.key}</span>
											<span class="result-cite mono">{extra(item, 'article_number')}</span>
										</button>
									{/each}
								{/each}
								{@render moreRow('articles', 'articles', 'wetsartikelen')}
							</div>
						{/if}

						<!-- Rechtspraak -->
						{#if showRecht && rechtCount > 0}
							<div class="domain domain--recht">
								<div class="domain__head">
									<span class="domain__glyph">¶</span><span class="domain__title">Rechtspraak</span>
								</div>

								{#each judgmentGroups as g (g.tier)}
									<div class="subgroup-label">{g.label} <span>{g.items.length}</span></div>
									{#each g.items as item (item.id)}
										{@const idx = flat.offset.judgments + vis.judgments.indexOf(item)}
										<button
											class="result-row"
											class:result-row--focused={idx === focusedIndex}
											onclick={() => pick(item)}
											onmouseenter={() => (focusedIndex = idx)}
										>
											<span class="leg-glyph leg-glyph--recht" aria-hidden="true">Arr.</span>
											<span class="result-title">{ecliLabel(item)}</span>
											<span class="result-cite mono">{extra(item, 'ecli')}</span>
										</button>
									{/each}
								{/each}
								{@render moreRow('judgments', 'judgments', 'uitspraken')}
							</div>
						{/if}

						<!-- Parlementair -->
						{#if showTk && tkCount > 0}
							<div class="domain domain--tk">
								<div class="domain__head">
									<span class="domain__glyph">∮</span><span class="domain__title">Parlementair</span
									>
								</div>

								{#each TK_SECTIONS as sec (sec.name)}
									{#if vis[sec.name].length > 0}
										<div class="subgroup-label">{sec.title}</div>
										{#each vis[sec.name] as item, i (item.id)}
											{@const idx = flat.offset[sec.name] + i}
											{@const cite = sec.cite(item)}
											<a
												href={exploreHrefFor(item)}
												class="result-row result-row--link"
												class:result-row--focused={idx === focusedIndex}
												onclick={onClose}
												onmouseenter={() => (focusedIndex = idx)}
											>
												<span class="leg-glyph leg-glyph--tk" aria-hidden="true">{sec.glyph}</span>
												<span class="result-title">{item.display_name ?? item.key}</span>
												{#if cite}<span class="result-cite mono">{cite}</span>{/if}
											</a>
										{/each}
										{@render moreRow(sec.name, sec.name, sec.more)}
									{/if}
								{/each}
							</div>
						{/if}

						<div class="results-footer">
							<a href="/search?q={encodeURIComponent(query)}" onclick={onClose} class="more-link">
								Alle resultaten voor "{query}" →
							</a>
							<a href="/explore?mode=index&kind=members" onclick={onClose} class="more-link">
								Zoek kamerleden →
							</a>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}

	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(26, 24, 20, 0.18);
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding-top: 96px;
		z-index: var(--z-modal);
	}

	.modal {
		width: 640px;
		max-width: calc(100% - 48px);
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		max-height: calc(100vh - 160px);
	}

	.input-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px 18px;
		border-bottom: 1px solid var(--rule);
		color: var(--fg-3);
	}
	.input-row input {
		flex: 1;
		border: 0;
		outline: none;
		background: transparent;
		font-family: var(--font-serif);
		font-size: 19px;
		color: var(--ink);
	}
	.input-row input::placeholder {
		color: var(--fg-4);
		font-style: italic;
	}
	.kbd {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--fg-3);
		border: 1px solid var(--rule);
		padding: 1px 6px;
		border-radius: var(--r-1);
	}

	/* Inline loading spinner — replaces the search icon while a request is in
     flight. Same footprint, no layout shift; signals "still working" without
     blanking out the previous results below. */
	.search-spinner {
		width: 14px;
		height: 14px;
		border: 1.5px solid var(--rule-strong);
		border-top-color: var(--ink-3);
		border-radius: 50%;
		display: inline-block;
		animation: search-spin 0.7s linear infinite;
		flex-shrink: 0;
	}
	@keyframes search-spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* ── Domain filter chips ─────────────────────────────────────────────── */
	.chip-row {
		display: flex;
		gap: 6px;
		padding: 8px 18px;
		border-bottom: 1px solid var(--rule);
		flex-wrap: wrap;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 3px 9px;
		border-radius: 999px;
		border: 1px solid var(--rule-strong);
		background: var(--paper);
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-2);
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease),
			opacity var(--dur-1) var(--ease);
	}
	.chip__glyph {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 13px;
		line-height: 1;
	}
	.chip__count {
		font-family: var(--font-mono);
		font-size: 10px;
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

	/* ── Results list ────────────────────────────────────────────────────── */
	.results-list {
		flex: 1;
		overflow-y: auto;
		padding: 4px 0 0;
	}

	.domain {
		padding: 6px 0;
	}
	.domain + .domain {
		border-top: 1px solid var(--rule);
		margin-top: 4px;
	}
	.domain__head {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 8px 18px 4px;
	}
	.domain__glyph {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 18px;
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
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 14px;
		color: var(--ink);
	}

	.group-label,
	.subgroup-label {
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-4);
		padding: 8px 18px 4px;
	}
	.subgroup-label--law {
		text-transform: none;
		letter-spacing: 0;
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 12px;
		color: var(--fg-3);
		padding: 6px 18px 2px;
	}
	.subgroup-label span {
		font-family: var(--font-mono);
		font-weight: 400;
		color: var(--fg-4);
		margin-left: 4px;
	}

	.result-row {
		display: flex;
		align-items: baseline;
		gap: 10px;
		width: 100%;
		padding: 7px 18px;
		background: transparent;
		border: 0;
		cursor: pointer;
		text-align: left;
		font-family: var(--font-serif);
		font-size: 15px;
		color: var(--ink);
		transition: background var(--dur-1) var(--ease);
	}
	.result-row--link {
		text-decoration: none;
		color: inherit;
	}
	.result-row:hover,
	.result-row--focused {
		background: var(--paper-2);
	}

	.leg-glyph {
		font-family: var(--font-mono);
		font-style: normal;
		font-size: 9px;
		font-weight: 600;
		line-height: 1;
		width: auto;
		min-width: 22px;
		text-align: right;
		flex-shrink: 0;
		letter-spacing: 0.01em;
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

	.result-title {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.result-cite {
		font-size: 11px;
		color: var(--fg-3);
		white-space: nowrap;
		flex-shrink: 0;
	}
	.mono {
		font-family: var(--font-mono);
	}

	.empty {
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--fg-3);
		padding: 20px 18px;
	}

	.suggestions {
		padding: 14px 18px 8px;
	}

	.suggestions__label {
		margin: 0 0 10px;
		font-family: var(--font-sans);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--fg-3);
	}

	.suggestion-row {
		display: flex;
		align-items: baseline;
		gap: 10px;
		width: 100%;
		padding: 8px 10px;
		background: none;
		border: none;
		border-radius: var(--r-1, 2px);
		cursor: pointer;
		text-align: left;
		text-decoration: none;
		color: inherit;
		transition: background var(--dur-1) var(--ease);
	}

	/* Direct-hit boven de fuzzy resultaten: bewaakt dat patronen als
     "Art. 6:162 BW" altijd als eerste optie verschijnen, ook al rankt
     het search-endpoint EU-richtlijnen hoger. */
	.direct-hit {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 10px 12px;
		margin: 4px 0 8px;
		background: var(--paper-2);
		border: 1px solid var(--accent);
		border-radius: var(--r-1, 2px);
		text-decoration: none;
		color: inherit;
		transition: background var(--dur-1) var(--ease);
	}
	.direct-hit:hover {
		background: var(--accent);
		color: var(--paper);
	}
	.direct-hit:hover .direct-hit__desc {
		color: var(--paper-2);
	}
	.direct-hit__icon {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--accent);
		flex-shrink: 0;
	}
	.direct-hit:hover .direct-hit__icon {
		color: var(--paper);
	}
	.direct-hit__label {
		font-family: var(--font-mono);
		font-size: 13px;
		font-weight: 500;
		color: var(--ink);
		flex-shrink: 0;
	}
	.direct-hit:hover .direct-hit__label {
		color: var(--paper);
	}
	.direct-hit__desc {
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--fg-2);
		flex: 1;
		text-align: right;
	}

	.suggestion-row:hover {
		background: var(--paper-2);
	}

	.suggestion__label {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--ink);
		flex-shrink: 0;
	}

	.suggestion__desc {
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--fg-3);
		font-style: italic;
	}

	.results-footer {
		border-top: 1px solid var(--rule);
		padding: 10px 18px;
		display: flex;
		gap: 18px;
		flex-wrap: wrap;
	}
	.more-link {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--fg-3);
		text-decoration: none;
	}
	.more-link:hover {
		color: var(--ink);
		text-decoration: underline;
	}

	/* "+ N more →" row appended to a subgroup that's been capped. Sits flush
     with the result rows so it reads as an extension of the group, not a
     separate section. Click deep-links into /search anchored to the type. */
	.more-row {
		display: block;
		padding: 6px 18px 8px;
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--fg-3);
		text-decoration: none;
		letter-spacing: 0.02em;
	}
	.more-row:hover {
		color: var(--ink);
		background: var(--paper-2);
	}

	.no-results-hint {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 12px;
		color: var(--ink-4);
		padding: 0 18px;
		margin: var(--s-2) 0 0;
	}
	.leden-hint-link {
		color: var(--fg-3);
		text-decoration: none;
	}
	.leden-hint-link:hover {
		color: var(--ink);
		text-decoration: underline;
	}
</style>

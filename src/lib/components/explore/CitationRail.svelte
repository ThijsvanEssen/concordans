<script lang="ts">
	import { getArticleDetail } from '$lib/api/articles';
	import { getJudgmentDetail } from '$lib/api/judgments';
	import type {
		ArticleDetailResponse,
		JudgmentDetailResponse,
		ArticleCitationTarget,
		ArticleRelation
	} from '$lib/api/types';
	import { formatEcliLabel } from '$lib/graph/types';
	import type { GraphNode } from '$lib/graph/types';
	import DossierRail from './readers/rail/DossierRail.svelte';
	import CommissieRail from './readers/rail/CommissieRail.svelte';
	import LidRail from './readers/rail/LidRail.svelte';
	import FractieRail from './readers/rail/FractieRail.svelte';
	import CitationCopy from './CitationCopy.svelte';
	import { instrumentMetaStore, recordInstrument } from '$lib/api/instrument-cache';
	import { compareArticleNumbers } from '$lib/util/sort';
	import { getLawIdFromProps, getLawIdFromRecord } from '$lib/util/law-id';

	let {
		selection,
		onNavigate
	}: {
		selection: GraphNode | null;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	const currentBwb = $derived.by(() => {
		if (!selection || selection.collection !== 'instrument_articles') return null;
		const p = selection.raw?.props as Record<string, unknown> | undefined;
		return getLawIdFromProps(p, selection.key);
	});

	type State =
		| { kind: 'empty' }
		| { kind: 'loading' }
		| { kind: 'article'; data: ArticleDetailResponse }
		| { kind: 'judgment'; data: JudgmentDetailResponse }
		| { kind: 'none' };

	let view = $state<State>({ kind: 'empty' });

	// Which law groups are collapsed — keyed by bwb_id.
	let collapsed = $state(new Set<string>());

	function toggleGroup(bwb: string) {
		const next = new Set(collapsed);
		if (next.has(bwb)) next.delete(bwb);
		else next.add(bwb);
		collapsed = next;
	}

	$effect(() => {
		const node = selection;
		collapsed = new Set();
		if (!node) {
			view = { kind: 'empty' };
			return;
		}

		view = { kind: 'loading' };
		const props = node.raw?.props as Record<string, unknown> | undefined;

		if (node.collection === 'instrument_articles') {
			const bwb = getLawIdFromProps(props, node.key) ?? '';
			const art = String(props?.['article_number'] ?? '');
			if (bwb && art) {
				getArticleDetail(bwb, art)
					.then((data) => {
						// Seed the store with the current article's instrument so
						// the law group header renders the friendly name immediately.
						if (data.instrument) {
							recordInstrument({
								bwb_id: data.instrument.bwb_id,
								key: data.instrument.key,
								citation_title: data.instrument.citation_title,
								title: data.instrument.title
							});
						}
						view = { kind: 'article', data };
					})
					.catch(() => {
						view = { kind: 'none' };
					});
				return;
			}
		}

		if (node.collection === 'judgments') {
			const ecli = String(props?.['ecli'] ?? node.key);
			const fullEcli = ecli.startsWith('ECLI:') ? ecli : `ECLI:${ecli}`;
			getJudgmentDetail(fullEcli)
				.then((data) => {
					// Seed the instrument store for every cited law so law group
					// headings show friendly names without needing ArticleReader loaded first.
					for (const a of data.articles) {
						if (a.instrument) {
							recordInstrument({
								bwb_id: a.instrument.bwb_id ?? a.bwb_id,
								key: a.instrument.key,
								citation_title: a.instrument.citation_title,
								title: a.instrument.title
							});
						} else if (a.bwb_id) {
							recordInstrument({ bwb_id: a.bwb_id });
						}
					}
					view = { kind: 'judgment', data };
				})
				.catch(() => {
					view = { kind: 'none' };
				});
			return;
		}

		view = { kind: 'none' };
	});

	// Resolve a display name for a law by bwb_id.
	function lawName(bwb: string): string {
		if (bwb === '__unknown__') return 'Onbekend';
		const m = $instrumentMetaStore.get(bwb);
		return m?.citationTitle ?? m?.shortTitle ?? m?.title ?? bwb;
	}

	/**
	 * Shorten a law title for display in a compact header.
	 * When the title ends with a parenthetical acronym — e.g.
	 * "Verdrag tot bescherming … (EVRM)" — return just the acronym.
	 */
	function shortLawName(name: string): string {
		const m = name.match(/\(([A-Z][A-Z0-9]{1,12})\)\s*$/);
		return m ? m[1] : name;
	}

	// Group and deduplicate citation targets by bwb_id, sorted within each group.
	// Returns [bwb_id, instrument_citation_title_or_null, targets[]]
	function groupCitationTargets(
		citations: { target: ArticleCitationTarget }[]
	): [string, string | null, ArticleCitationTarget[]][] {
		const seen = new Set<string>();
		const groups = new Map<string, { name: string | null; targets: ArticleCitationTarget[] }>();
		for (const span of citations) {
			const t = span.target;
			if (seen.has(t.key)) continue;
			seen.add(t.key);
			const bwb = getLawIdFromRecord(t);
			if (!groups.has(bwb)) {
				groups.set(bwb, { name: t.instrument_citation_title ?? null, targets: [] });
			}
			groups.get(bwb)!.targets.push(t);
		}
		for (const g of groups.values()) {
			g.targets.sort((a, b) => compareArticleNumbers(a.article_number, b.article_number));
		}
		return [...groups.entries()].map(([bwb, g]) => [bwb, g.name, g.targets]);
	}

	// Group article relations by bwb_id, sorted within each group.
	function groupArticleRelations(articles: ArticleRelation[]): [string, ArticleRelation[]][] {
		const groups = new Map<string, ArticleRelation[]>();
		for (const a of articles) {
			const bwb = getLawIdFromRecord(a);
			if (!groups.has(bwb)) groups.set(bwb, []);
			groups.get(bwb)!.push(a);
		}
		for (const arr of groups.values()) {
			arr.sort((a, b) => compareArticleNumbers(a.article_number, b.article_number));
		}
		return [...groups.entries()];
	}
</script>

<aside class="citation-rail">
	{#if selection?.kind === 'dossier'}
		<DossierRail node={selection} {onNavigate} />
	{:else if selection?.kind === 'commissie'}
		<CommissieRail node={selection} {onNavigate} />
	{:else if selection?.kind === 'lid'}
		<LidRail node={selection} {onNavigate} />
	{:else if selection?.kind === 'fractie'}
		<FractieRail node={selection} {onNavigate} />
	{:else if view.kind === 'empty'}
		<div class="rail-empty">
			<p>Selecteer een artikel of arrest om verwijzingen te zien.</p>
		</div>
	{:else if view.kind === 'loading'}
		<div class="rail-loading">
			{#each Array(4) as _, i (i)}
				<div class="skeleton-row">
					<div class="skeleton-cite"></div>
					<div class="skeleton-name"></div>
				</div>
			{/each}
		</div>
	{:else if view.kind === 'none'}
		<div class="rail-empty">
			<p>Geen verwijzingen beschikbaar.</p>
		</div>
	{:else if view.kind === 'article'}
		{@const d = view.data}
		{@const citationGroups =
			d.citations && d.citations.length > 0 ? groupCitationTargets(d.citations) : []}
		{@const hasJudgments = d.judgments && d.judgments.length > 0}

		<p class="rail-lede">
			Verbindingen tonen welke artikelen naar dit artikel verwijzen en welke uitspraken het citeren.
		</p>

		{#if citationGroups.length > 0}
			<section class="rail-section">
				<h3 class="rail-section-title rail-section-title--outgoing">Verwijst naar</h3>

				{#each citationGroups as [bwb, instName, targets], i (i)}
					{@const isCurrentLaw = bwb === (currentBwb ?? '__never__')}
					{@const displayName = isCurrentLaw ? 'Deze wet' : shortLawName(instName ?? lawName(bwb))}
					<div class="law-group">
						{#if !isCurrentLaw}
							<button
								type="button"
								class="law-heading"
								onclick={() => toggleGroup(bwb)}
								aria-expanded={!collapsed.has(bwb)}
							>
								<span class="law-chevron" class:law-chevron--closed={collapsed.has(bwb)}>›</span>
								<span class="law-heading-name">{displayName}</span>
								<span class="law-count">{targets.length}</span>
							</button>
						{:else}
							<div class="law-heading law-heading--current">
								<span class="law-chevron" class:law-chevron--closed={collapsed.has(bwb)}>›</span>
								<span class="law-heading-name">{displayName}</span>
								<span class="law-count">{targets.length}</span>
							</div>
						{/if}

						{#if !collapsed.has(bwb)}
							<ul class="rail-list">
								{#each targets as t, i (i)}
									<li class="rail-item">
										<button
											type="button"
											class="rail-row"
											onclick={() => onNavigate?.(t.collection, t.key)}
										>
											<span class="rail-sigil" aria-hidden="true">§</span>
											<span class="rail-content">
												<span class="rail-name"
													>{t.display_name ?? `Art. ${t.article_number ?? '—'}`}</span
												>
												{#if t.article_number}
													<span class="rail-cite">Art. {t.article_number}</span>
												{/if}
											</span>
										</button>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/each}
			</section>
		{/if}

		{#if hasJudgments}
			<section class="rail-section">
				<h3 class="rail-section-title rail-section-title--incoming">Aangehaald door</h3>
				<ul class="rail-list">
					{#each d.judgments as j, i (i)}
						{@const jMeta = (j as Record)['judgment_metadata'] as Record | undefined}
						{@const jStub = Boolean((j as Record)['stub'])}
						<li class="rail-item" class:rail-item--stub={jStub}>
							<button
								type="button"
								class="rail-row"
								onclick={() => onNavigate?.('judgments', j.key)}
							>
								<span class="rail-sigil rail-sigil--judgment" aria-hidden="true">¶</span>
								<span class="rail-content">
									<span class="rail-name">
										{j.shorthand ?? j.display_name ?? 'Uitspraak'}
										{#if jStub}<span class="rail-stub-tag">niet geladen</span>{/if}
									</span>
									{#if jMeta?.['court'] || j.ecli}
										<span class="rail-cite">
											{#if jMeta?.['court']}
												{jMeta['court']}{jMeta['date']
													? ` · ${new Date(jMeta['date']).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}`
													: ''}
											{:else if j.ecli}
												{@const m = j.ecli.match(/(?:ECLI:)?(?:NL:)?([^:]+):(\d{4})/)}
												{#if m}{m[1]} · {m[2]}{/if}
											{/if}
										</span>
									{/if}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if citationGroups.length === 0 && !hasJudgments}
			<div class="rail-empty"><p>Geen verwijzingen gevonden.</p></div>
		{/if}
	{:else if view.kind === 'judgment'}
		{@const d = view.data}
		{@const articleGroups =
			d.articles && d.articles.length > 0 ? groupArticleRelations(d.articles) : []}
		{@const citedJudgments = d.cited_judgments ?? []}
		{@const instNames = (() => {
			const m = new Map();
			for (const a of d.articles) {
				const bwb = getLawIdFromRecord(a);
				if (!m.has(bwb)) {
					const inst = a.instrument;
					const name =
						inst?.citation_title ?? inst?.title ?? inst?.shorthand ?? inst?.display_name ?? null;
					if (name) m.set(bwb, name);
				}
			}
			return m;
		})()}

		<p class="rail-lede">
			Verbindingen tonen welke artikelen dit arrest aanhaalt en welke andere uitspraken het citeren.
		</p>

		{#if articleGroups.length > 0}
			<section class="rail-section">
				<h3 class="rail-section-title">Geciteerde artikelen</h3>

				{#each articleGroups as [bwb, articles], i (i)}
					<div class="law-group">
						<button
							type="button"
							class="law-heading"
							onclick={() => toggleGroup(bwb)}
							aria-expanded={!collapsed.has(bwb)}
						>
							<span class="law-chevron" class:law-chevron--closed={collapsed.has(bwb)}>›</span>
							<span class="law-heading-name"
								>{shortLawName(instNames.get(bwb) ?? lawName(bwb))}</span
							>
							<span class="law-count">{articles.length}</span>
						</button>

						{#if !collapsed.has(bwb)}
							<ul class="rail-list">
								{#each articles as a, i (i)}
									<li class="rail-item">
										<button
											type="button"
											class="rail-row"
											onclick={() => onNavigate?.('instrument_articles', a.key)}
										>
											<span class="rail-sigil" aria-hidden="true">§</span>
											<span class="rail-content">
												<span class="rail-name"
													>{a.display_name ?? `Art. ${a.article_number ?? '—'}`}</span
												>
												{#if a.article_number}
													<span class="rail-cite">Art. {a.article_number}</span>
												{/if}
											</span>
										</button>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/each}
			</section>
		{/if}

		{#if citedJudgments.length > 0}
			<section class="rail-section">
				<h3 class="rail-section-title">Citeert uitspraken</h3>
				<ul class="rail-list">
					{#each citedJudgments as cj, idx (idx)}
						{@const cjLabel =
							cj.shorthand ??
							(cj.ecli ? formatEcliLabel(cj.ecli) : null) ??
							cj.display_name ??
							'Uitspraak'}
						{@const cjEcliShort = cj.ecli
							? (() => {
									const m = cj.ecli.replace(/^ECLI:/i, '').match(/^NL:([^:]+):(\d{4})/);
									return m ? `${m[1]} ${m[2]}` : null;
								})()
							: null}
						<li class="rail-item">
							<button
								type="button"
								class="rail-row"
								onclick={() => onNavigate?.('judgments', cj.key)}
							>
								<span class="rail-sigil rail-sigil--judgment" aria-hidden="true">¶</span>
								<span class="rail-content">
									<span class="rail-name">{cjLabel}</span>
									{#if cjEcliShort && cjEcliShort !== cjLabel}
										<span class="rail-cite">{cjEcliShort}</span>
									{/if}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if articleGroups.length === 0 && citedJudgments.length === 0}
			<div class="rail-empty"><p>Geen geciteerde artikelen of uitspraken.</p></div>
		{/if}
	{/if}

	{#if selection}
		<CitationCopy node={selection} />
	{/if}

	<details class="rail-legend">
		<summary class="rail-legend__toggle">Verbindingstypen</summary>
		<dl class="rail-legend__list">
			<div class="rail-legend__row">
				<dt>Citaat</dt>
				<dd>de bron haalt de andere letterlijk aan</dd>
			</div>
			<div class="rail-legend__row">
				<dt>Interpretatie</dt>
				<dd>een arrest legt een artikel uit</dd>
			</div>
			<div class="rail-legend__row">
				<dt>Wijziging</dt>
				<dd>de bron heeft de tekst gewijzigd</dd>
			</div>
			<div class="rail-legend__row">
				<dt>Vermelding</dt>
				<dd>een zwakke verwijzing zonder citaat</dd>
			</div>
		</dl>
	</details>
</aside>

<style>
	.citation-rail {
		height: 100%;
		overflow-y: auto;
		border-left: 1px solid var(--rule);
		background: var(--paper-2);
		display: flex;
		flex-direction: column;
	}

	.rail-lede {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 12px;
		color: var(--ink-4);
		margin: 0 0 var(--s-3);
		padding: var(--s-3) var(--s-4) 0;
		line-height: 1.5;
	}

	.rail-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: var(--s-6);
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 14px;
		color: var(--fg-3);
		text-align: center;
	}

	.rail-empty-inline {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 12px;
		color: var(--ink-4);
		margin: 4px 0 0;
	}

	.rail-loading {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		padding: var(--s-5);
	}

	.skeleton-row {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.skeleton-cite {
		height: 10px;
		width: 55%;
		border-radius: var(--r-1);
		background: linear-gradient(90deg, var(--paper-3) 25%, var(--paper-4) 50%, var(--paper-3) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.4s infinite;
	}

	.skeleton-name {
		height: 13px;
		border-radius: var(--r-1);
		background: linear-gradient(90deg, var(--paper-3) 25%, var(--paper-4) 50%, var(--paper-3) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.4s infinite;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	.rail-section {
		padding: var(--s-5) 0 var(--s-3);
	}

	.rail-section + .rail-section {
		border-top: 1px solid var(--rule);
	}

	.rail-section-title {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--fg-3);
		margin: 0 0 var(--s-2);
		padding: 0 var(--s-5);
	}
	.rail-section-title--outgoing {
		color: var(--accent);
		opacity: 0.8;
	}
	.rail-section-title--incoming {
		color: var(--indigo);
		opacity: 0.8;
	}

	/* Law group collapsible heading */
	.law-group {
		margin-bottom: 2px;
	}

	.law-heading {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		width: 100%;
		padding: 5px var(--s-5);
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: background var(--dur-1) var(--ease);
	}

	.law-heading:hover {
		background: var(--paper-3);
	}

	.law-heading--current {
		cursor: default;
	}

	.law-heading--current:hover {
		background: none;
	}

	.law-chevron {
		font-size: 14px;
		color: var(--fg-3);
		line-height: 1;
		display: inline-block;
		transform: rotate(90deg);
		transition: transform var(--dur-1) var(--ease);
		flex-shrink: 0;
	}

	.law-chevron--closed {
		transform: rotate(0deg);
	}

	.law-heading-name {
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 500;
		color: var(--fg-2);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.law-count {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--fg-3);
		flex-shrink: 0;
	}

	.rail-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.rail-item {
		display: block;
	}

	.rail-row {
		display: flex;
		align-items: flex-start;
		gap: var(--s-2);
		width: 100%;
		padding: 6px var(--s-5) 6px calc(var(--s-5) + 18px);
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: background var(--dur-1) var(--ease);
	}

	.rail-row:hover {
		background: var(--paper-3);
	}

	.rail-sigil {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 15px;
		color: var(--accent);
		flex-shrink: 0;
		line-height: 1.3;
		margin-top: 1px;
	}

	.rail-sigil--judgment {
		color: var(--indigo);
	}

	.rail-item--stub .rail-sigil--judgment {
		opacity: 0.45;
	}

	.rail-item--stub .rail-name {
		color: var(--fg-3);
	}

	.rail-stub-tag {
		display: inline-block;
		margin-left: 5px;
		font-family: var(--font-sans);
		font-size: 9px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--fg-4);
		vertical-align: middle;
	}

	.rail-content {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.rail-name {
		font-family: var(--font-serif);
		font-size: 14px;
		line-height: 1.35;
		color: var(--ink);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.rail-cite {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--fg-3);
	}

	.rail-legend {
		margin-top: auto;
		border-top: 1px solid var(--rule);
		padding: 10px 14px 12px;
	}

	.rail-legend__toggle {
		font-family: var(--font-sans);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--fg-3);
		cursor: pointer;
		list-style: none;
		user-select: none;
	}
	.rail-legend__toggle::-webkit-details-marker {
		display: none;
	}
	.rail-legend__toggle::before {
		content: '?  ';
		color: var(--fg-4);
	}

	.rail-legend__list {
		margin: 8px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.rail-legend__row {
		display: grid;
		grid-template-columns: 80px 1fr;
		gap: 6px;
		align-items: baseline;
	}

	.rail-legend__row dt {
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-2);
		font-weight: 500;
	}

	.rail-legend__row dd {
		margin: 0;
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--fg-3);
	}
</style>

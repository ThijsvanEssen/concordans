<script lang="ts">
	import { getArticleDetail } from '$lib/api/articles';
	import { getJudgmentDetail } from '$lib/api/judgments';
	import type { Schema } from '$lib/api/types';
	import { formatEcliLabel } from '$lib/graph/types';
	import type { GraphNode } from '$lib/graph/types';
	import DossierRail from './readers/rail/DossierRail.svelte';
	import CommitteeRail from './readers/rail/CommitteeRail.svelte';
	import MemberRail from './readers/rail/MemberRail.svelte';
	import FactionRail from './readers/rail/FactionRail.svelte';
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

	type CitationTarget = Schema<'ArticleCitationTarget'>;
	type ArticleRelation = Schema<'ArticleRelationDTO'>;

	const currentBwb = $derived(
		selection?.collection === 'articles'
			? getLawIdFromProps(selection.raw?.props ?? undefined, selection.key)
			: null
	);

	type State =
		| { kind: 'empty' }
		| { kind: 'loading' }
		| { kind: 'article'; data: Schema<'ArticleDetailResponse'> }
		| { kind: 'judgment'; data: Schema<'JudgmentDetailResponse'> }
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
		const props = node.raw?.props ?? {};

		if (node.collection === 'articles') {
			const bwb = getLawIdFromProps(props, node.key) ?? '';
			const art = String(props.article_number ?? '');
			if (bwb && art) {
				getArticleDetail(bwb, art)
					.then((data) => {
						// Seed the store so the law group header shows the name at once.
						if (data.instrument) {
							recordInstrument({
								bwb_id: bwb,
								key: data.instrument.key,
								display_name: data.instrument.display_name
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
			const ecli = String(props.ecli ?? node.key);
			const fullEcli = ecli.startsWith('ECLI:') ? ecli : `ECLI:${ecli}`;
			getJudgmentDetail(fullEcli)
				.then((data) => {
					// Seed the store for every cited law so the group headings show names.
					for (const a of data.articles) {
						if (a.bwb_id) {
							recordInstrument({
								bwb_id: a.bwb_id,
								key: a.instrument?.key,
								display_name: a.instrument?.display_name
							});
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

	// Citation targets once each, grouped by law and sorted within a group.
	function groupCitationTargets(
		citations: { target: CitationTarget }[]
	): [string, CitationTarget[]][] {
		const targets = new Map(citations.map(({ target }) => [target.key, target]));
		const groups = Map.groupBy(targets.values(), getLawIdFromRecord);
		return [...groups].map(([bwb, rows]) => [
			bwb,
			rows.sort((a, b) => compareArticleNumbers(a.article_number, b.article_number))
		]);
	}

	// Group article relations by bwb_id, sorted within each group.
	function groupArticleRelations(articles: ArticleRelation[]): [string, ArticleRelation[]][] {
		return [...Map.groupBy(articles, getLawIdFromRecord)].map(([bwb, rows]) => [
			bwb,
			rows.sort((a, b) => compareArticleNumbers(a.article_number, b.article_number))
		]);
	}
</script>

<aside class="citation-rail">
	{#if selection?.kind === 'dossier'}
		<DossierRail node={selection} {onNavigate} />
	{:else if selection?.kind === 'committee'}
		<CommitteeRail node={selection} {onNavigate} />
	{:else if selection?.kind === 'member'}
		<MemberRail node={selection} {onNavigate} />
	{:else if selection?.kind === 'faction'}
		<FactionRail node={selection} {onNavigate} />
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

				{#each citationGroups as [bwb, targets] (bwb)}
					{@const isCurrentLaw = bwb === currentBwb}
					{@const displayName = isCurrentLaw ? 'Deze wet' : shortLawName(lawName(bwb))}
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
								{#each targets as t (t.key)}
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
					{#each d.judgments as j (j.key)}
						<li class="rail-item">
							<button
								type="button"
								class="rail-row"
								onclick={() => onNavigate?.('judgments', j.key)}
							>
								<span class="rail-sigil rail-sigil--judgment" aria-hidden="true">¶</span>
								<span class="rail-content">
									<span class="rail-name">{j.display_name ?? 'Uitspraak'}</span>
									{#if j.ecli}<span class="rail-cite">{formatEcliLabel(j.ecli)}</span>{/if}
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

		<p class="rail-lede">
			Verbindingen tonen welke artikelen dit arrest aanhaalt en welke andere uitspraken het citeren.
		</p>

		{#if articleGroups.length > 0}
			<section class="rail-section">
				<h3 class="rail-section-title">Geciteerde artikelen</h3>

				{#each articleGroups as [bwb, articles] (bwb)}
					<div class="law-group">
						<button
							type="button"
							class="law-heading"
							onclick={() => toggleGroup(bwb)}
							aria-expanded={!collapsed.has(bwb)}
						>
							<span class="law-chevron" class:law-chevron--closed={collapsed.has(bwb)}>›</span>
							<span class="law-heading-name">{shortLawName(lawName(bwb))}</span>
							<span class="law-count">{articles.length}</span>
						</button>

						{#if !collapsed.has(bwb)}
							<ul class="rail-list">
								{#each articles as a (a.key)}
									<li class="rail-item">
										<button
											type="button"
											class="rail-row"
											onclick={() => onNavigate?.('articles', a.key)}
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
					{#each citedJudgments as cj (cj.key)}
						<li class="rail-item">
							<button
								type="button"
								class="rail-row"
								onclick={() => onNavigate?.('judgments', cj.key)}
							>
								<span class="rail-sigil rail-sigil--judgment" aria-hidden="true">¶</span>
								<span class="rail-content">
									<span class="rail-name"
										>{cj.ecli ? formatEcliLabel(cj.ecli) : (cj.display_name ?? 'Uitspraak')}</span
									>
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
</style>

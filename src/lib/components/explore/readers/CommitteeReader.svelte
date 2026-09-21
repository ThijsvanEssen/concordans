<script lang="ts">
	import type { GraphNode } from '$lib/graph/types';
	import type { Schema } from '$lib/api/types';
	import { committeeSlug, getCommittee } from '$lib/components/parliamentary/data';
	import { STAGE_LABEL, TRACK_LABEL } from '$lib/components/parliamentary/stages';
	import { initials } from '$lib/util/initials';

	let { node }: { node: GraphNode } = $props();

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| { kind: 'loaded'; committee: Schema<'CommitteeDetailDTO'> };

	let view = $state<State>({ kind: 'loading' });

	$effect(() => {
		const slug = committeeSlug(node);
		let stale = false;
		view = { kind: 'loading' };
		if (!slug) {
			view = { kind: 'error', message: 'Commissie kon niet geladen worden.' };
			return;
		}
		getCommittee(slug)
			.then((committee) => {
				if (!stale) view = { kind: 'loaded', committee };
			})
			.catch(() => {
				if (!stale) view = { kind: 'error', message: 'Commissie kon niet geladen worden.' };
			});
		return () => (stale = true);
	});
</script>

<div class="r-committee">
	{#if view.kind === 'loading'}
		<p class="loading">Laden…</p>
	{:else if view.kind === 'error'}
		<p class="error">{view.message}</p>
	{:else}
		{@const c = view.committee}
		{@const members = c.members ?? []}
		{@const dossiers = c.dossiers ?? []}
		{@const openDossiers = dossiers.filter((d) => !d.closed)}
		{@const closedDossiers = dossiers.filter((d) => d.closed)}

		<header class="head">
			<div class="kicker-row">
				<span class="kicker">Commissie</span>
				<a class="graph-link" href="/explore?focus=committees/{c.key}">Toon in netwerk →</a>
			</div>
			<h2 class="title">{c.name ?? c.abbreviation ?? c.key}</h2>
			{#if c.abbreviation && c.name}
				<div class="chips"><span class="afk-chip">{c.abbreviation}</span></div>
			{/if}
		</header>

		<ul class="stats">
			<li><span class="stat-num">{members.length}</span><span class="stat-label">Leden</span></li>
			<li>
				<span class="stat-num">{openDossiers.length}</span><span class="stat-label"
					>Open dossiers</span
				>
			</li>
			<li>
				<span class="stat-num">{closedDossiers.length}</span><span class="stat-label">Afgedaan</span
				>
			</li>
		</ul>

		{#if members.length > 0}
			<section class="sec">
				<h3 class="sec-title">
					Huidige leden ({members.length})
					<span class="status-dot status-dot--actief" aria-hidden="true"></span>
				</h3>
				<ul class="member-list">
					{#each members as m (m.key)}
						<li class="member-row">
							<span class="member-avatar" aria-hidden="true">{initials(m.name)}</span>
							<a class="member-name" href="/explore?focus=members/{m.key}">{m.name ?? m.key}</a>
							{#if m.party}<span class="member-party">{m.party}</span>{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if openDossiers.length > 0}
			<section class="sec">
				<h3 class="sec-title">Actieve dossiers ({openDossiers.length})</h3>
				<ul class="dossier-list">
					{#each openDossiers as d (d.key)}
						<li class="dossier-item">
							<a class="dossier-name" href="/explore?focus=dossiers/{d.key}">
								<span class="dossier-num">{d.number}</span>
								<span class="dossier-title">{d.title ?? d.number}</span>
							</a>
							{#if d.current_stage}
								<span class="dossier-stage">{STAGE_LABEL[d.current_stage]}</span>
							{:else if d.track}
								<span class="dossier-stage">{TRACK_LABEL[d.track]}</span>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if closedDossiers.length > 0}
			<section class="sec">
				<h3 class="sec-title">Afgedane dossiers ({closedDossiers.length})</h3>
				<ul class="dossier-list">
					{#each closedDossiers as d (d.key)}
						<li class="dossier-item is-closed">
							<a class="dossier-name" href="/explore?focus=dossiers/{d.key}">
								<span class="dossier-num">{d.number}</span>
								<span class="dossier-title">{d.title ?? d.number}</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</div>

<style>
	.r-committee {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		padding: var(--s-5) var(--s-5) var(--s-6);
		color: var(--ink-2);
		height: 100%;
		overflow-y: auto;
	}
	.loading,
	.error {
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--ink-4);
		margin: 0;
	}

	.head {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.kicker-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-3);
	}
	.graph-link {
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 500;
		color: var(--ink-3);
		text-decoration: none;
		white-space: nowrap;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		padding: 2px 8px;
	}
	.graph-link:hover {
		color: var(--ink);
		border-color: var(--ink-3);
	}
	.kicker {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-4);
	}
	.title {
		font-family: var(--font-serif);
		font-size: 19px;
		font-weight: 400;
		color: var(--ink);
		margin: 0;
		line-height: 1.25;
	}
	.chips {
		display: flex;
		gap: 4px;
	}
	.afk-chip {
		display: inline-flex;
		align-items: center;
		height: 18px;
		padding: 0 7px;
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		border: 1px solid var(--rule);
		background: var(--paper-2);
		color: var(--ink-2);
	}

	.stats {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
		gap: var(--s-2);
	}
	.stats li {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: var(--s-2);
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
	}
	.stat-num {
		font-family: var(--font-mono);
		font-size: 17px;
		font-weight: 600;
		color: var(--ink);
	}
	.stat-label {
		font-family: var(--font-sans);
		font-size: 9px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-4);
	}

	.sec {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.sec-title {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-4);
		margin: 0;
	}

	.status-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		margin-left: 5px;
		vertical-align: middle;
	}
	.status-dot--actief {
		background: var(--moss);
	}

	.sec-title--former {
		color: var(--ink-4);
	}
	.empty-note {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 12px;
		color: var(--ink-4);
		margin: 0;
	}

	.member-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.member-row {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		padding: 4px 0;
		border-bottom: 1px dotted var(--rule);
	}
	.member-avatar {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--paper-3);
		border: 1px solid var(--rule);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-serif);
		font-size: 11px;
		color: var(--ink-3);
		flex-shrink: 0;
	}
	.member-name {
		flex: 1;
		min-width: 0;
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--ink-2);
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	.member-name:hover {
		color: var(--spine);
	}
	.member-name--former {
		color: var(--ink-3);
	}
	.member-party {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-3);
	}

	.dossier-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.dossier-item {
		display: flex;
		gap: var(--s-2);
		align-items: baseline;
		padding: 5px 0;
		border-bottom: 1px dotted var(--rule);
		font-size: 12px;
		flex-wrap: wrap;
	}
	.dossier-name {
		display: flex;
		gap: 6px;
		flex: 1;
		min-width: 0;
		text-decoration: none;
	}
	.dossier-num {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-3);
		flex-shrink: 0;
	}
	.dossier-title {
		font-family: var(--font-serif);
		color: var(--ink-2);
		overflow-wrap: anywhere;
		line-height: 1.4;
	}
	.dossier-name:hover .dossier-title {
		color: var(--spine);
	}
	.dossier-item.is-closed {
		opacity: 0.65;
	}
	.dossier-stage {
		font-family: var(--font-sans);
		font-size: 9px;
		color: var(--spine);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		flex-shrink: 0;
	}
</style>

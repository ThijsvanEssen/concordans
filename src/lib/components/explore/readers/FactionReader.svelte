<script lang="ts">
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import { getFactionMembers, isCurrentMember, str } from '$lib/components/parliamentary/data';
	import { initials } from '$lib/util/initials';

	let {
		node,
		onNavigate
	}: {
		node: GraphNode;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| {
				kind: 'loaded';
				faction: Schema<'FactionDetailDTO'>;
				touched: Schema<'TouchedInstrumentsResponse'> | null;
				members: Schema<'NeighborDTO'>[];
		  };

	const TOUCHED_PREVIEW = 6;

	let view = $state<State>({ kind: 'loading' });
	let showAllTouched = $state(false);

	$effect(() => {
		const key = node.key;
		const ac = new AbortController();
		view = { kind: 'loading' };
		showAllTouched = false;
		Promise.all([
			unwrap(api.GET('/api/factions/{key}', { params: { path: { key } }, signal: ac.signal })),
			unwrap(
				api.GET('/api/factions/{key}/touched-instruments', {
					params: { path: { key }, query: { limit: 20 } },
					signal: ac.signal
				})
			).catch(() => null),
			getFactionMembers(key).catch(() => [])
		])
			.then(([faction, touched, members]) => {
				if (!ac.signal.aborted) view = { kind: 'loaded', faction, touched, members };
			})
			.catch(() => {
				if (!ac.signal.aborted)
					view = { kind: 'error', message: 'Fractie kon niet geladen worden.' };
			});
		return () => ac.abort();
	});
</script>

<div class="r-faction">
	{#if view.kind === 'loading'}
		<p class="loading">Laden…</p>
	{:else if view.kind === 'error'}
		<p class="error">{view.message}</p>
	{:else}
		{@const f = view.faction}
		{@const name = str(f.props?.name)}
		{@const abbreviation = str(f.props?.abbreviation)}
		{@const seats = f.props?.seats}
		{@const current = view.members.filter((m) => isCurrentMember(m, f.key))}
		{@const former = view.members.filter((m) => !isCurrentMember(m, f.key))}
		<header class="head">
			<div class="kicker-row">
				<span class="kicker">Fractie</span>
				<a class="graph-link" href="/explore?focus=factions/{f.key}">Toon in netwerk →</a>
			</div>
			<h2 class="title">{abbreviation ?? name ?? f.key}</h2>
			{#if name && abbreviation && name !== abbreviation}
				<p class="sub">{name}</p>
			{/if}
			{#if typeof seats === 'number'}
				<div class="chips">
					<span class="seats-chip">{seats} zetels</span>
				</div>
			{/if}
		</header>

		{#if view.members.length > 0}
			<section class="sec">
				<h3 class="sec-title">
					Huidige leden ({current.length})
					<span class="status-dot" aria-hidden="true"></span>
				</h3>
				{#if current.length > 0}
					<ul class="member-list">
						{#each current as m (m.id)}
							<li class="member-row">
								<span class="member-avatar" aria-hidden="true">{initials(str(m.props?.name))}</span>
								<button
									type="button"
									class="member-name"
									onclick={() => onNavigate?.(m.collection, m.key)}
								>
									{str(m.props?.name) ?? m.key}
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="empty-note">Geen actieve leden geregistreerd.</p>
				{/if}
			</section>
			{#if former.length > 0}
				<section class="sec">
					<h3 class="sec-title sec-title--former">Voormalige leden ({former.length})</h3>
					<ul class="member-list member-list--former">
						{#each former as m (m.id)}
							<li class="member-row">
								<span class="member-avatar member-avatar--former" aria-hidden="true"
									>{initials(str(m.props?.name))}</span
								>
								<button
									type="button"
									class="member-name member-name--former"
									onclick={() => onNavigate?.(m.collection, m.key)}
								>
									{str(m.props?.name) ?? m.key}
								</button>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		{/if}

		{#if view.touched && view.touched.items.length > 0}
			<section class="sec">
				<h3 class="sec-title">Bijgedragen aan ({view.touched.count})</h3>
				<ul class="touched-list">
					{#each showAllTouched ? view.touched.items : view.touched.items.slice(0, TOUCHED_PREVIEW) as inst (inst.id)}
						<li class="touched-item">
							<a class="touched-name" href="/explore?focus=instruments/{inst.key}">
								{inst.display_name ?? inst.title ?? inst.bwb_id ?? inst.key}
							</a>
							<span class="touched-count">{inst.count} bijdragen</span>
						</li>
					{/each}
				</ul>
				{#if view.touched.items.length > TOUCHED_PREVIEW && !showAllTouched}
					<button type="button" class="more-btn" onclick={() => (showAllTouched = true)}>
						+{view.touched.items.length - TOUCHED_PREVIEW} meer
					</button>
				{/if}
			</section>
		{/if}
	{/if}
</div>

<style>
	.r-faction {
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
	.sub {
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--ink-3);
		margin: 0;
	}
	.chips {
		display: flex;
		gap: 4px;
	}
	.seats-chip {
		display: inline-flex;
		align-items: center;
		height: 18px;
		padding: 0 7px;
		border-radius: var(--r-1);
		font-family: var(--font-mono);
		font-size: 10px;
		border: 1px solid var(--rule);
		background: var(--paper-2);
		color: var(--ink-2);
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

	.touched-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.touched-item {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		padding: 4px 0;
		border-bottom: 1px dotted var(--rule);
	}
	.touched-name {
		flex: 1;
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--ink-2);
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.touched-name:hover {
		color: var(--spine);
	}
	.touched-count {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		color: var(--spine);
		flex-shrink: 0;
	}

	.status-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--green, #16a34a);
		margin-left: 5px;
		vertical-align: middle;
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
	.member-list--former {
		opacity: 0.75;
	}
	.member-row {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		padding: 3px 0;
		border-bottom: 1px dotted var(--rule);
	}
	.member-avatar {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--paper-3);
		border: 1px solid var(--rule);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-serif);
		font-size: 10px;
		color: var(--ink-3);
		flex-shrink: 0;
	}
	.member-avatar--former {
		background: var(--paper-2);
	}
	.member-name {
		flex: 1;
		min-width: 0;
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--ink-2);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
		overflow-wrap: anywhere;
	}
	.member-name:hover {
		color: var(--spine);
	}
	.member-name--former {
		color: var(--ink-3);
	}

	.more-btn {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 11px;
		color: var(--spine);
		background: none;
		border: none;
		padding: 3px 0;
		cursor: pointer;
		text-align: left;
	}
	.more-btn:hover {
		color: var(--ink);
	}
</style>

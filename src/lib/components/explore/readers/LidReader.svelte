<script lang="ts">
	// Phase 4 reader for kamerlid. Renders the same data as /leden/[key]:
	//   • profile header
	//   • fractielidmaatschappen (chronological — handles fractie switches)
	//   • wetten bijgedragen
	//   • stemgeschiedenis grouped by partij-at-time, then Voor/Tegen/Onthouden
	//
	// Type augmentation: the backend returns fractielidmaatschappen on the lid
	// and partij_at_time + fractie_key per vote, but our generated LidDTO and
	// LidStemDTO don't include those yet. We type-cast at the access site rather
	// than patching parliamentary.ts (which would drift from the generator).
	import type { GraphNode } from '$lib/graph/types';
	import {
		fetchLid,
		fetchLidVotes,
		fetchLidTouchedInstruments
	} from '$lib/api/parliamentary-client';
	import type {
		LidDTO,
		LidStemDTO,
		LidVotesResponse,
		LidTouchedInstrumentsResponse
	} from '$lib/api/parliamentary';
	import { initials } from '$lib/util/initials';
	import { formatDate } from './_shared';

	let {
		node,
		onNavigate
	}: {
		node: GraphNode;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	// Augmented shapes — backend has these fields, types don't yet.
	type Fractielidmaatschap = {
		fractie_id: string;
		fractie_key: string;
		naam: string | null;
		afkorting: string | null;
		aliases: string[];
		van: string | null;
		tot_en_met: string | null;
		functie: string | null;
	};
	type LidWithFracties = LidDTO & { fractielidmaatschappen?: Fractielidmaatschap[] };
	type VoteWithFractie = LidStemDTO & {
		partij_at_time?: string | null;
		fractie_key?: string | null;
	};

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| {
				kind: 'loaded';
				l: LidWithFracties;
				votes: LidVotesResponse | null;
				touched: LidTouchedInstrumentsResponse | null;
		  };

	let view = $state<State>({ kind: 'loading' });
	let token = 0;

	$effect(() => {
		const n = node;
		const t = ++token;
		view = { kind: 'loading' };
		showAllTouched = false;
		showAllVotes = false;
		Promise.all([
			fetchLid(n.key) as Promise<LidWithFracties>,
			fetchLidVotes(n.key, { limit: 500 }).catch(() => null),
			fetchLidTouchedInstruments(n.key, { limit: 50 }).catch(() => null)
		])
			.then(([l, votes, touched]) => {
				if (t !== token) return;
				view = { kind: 'loaded', l, votes, touched };
			})
			.catch(() => {
				if (t === token) view = { kind: 'error', message: 'Kamerlid kon niet geladen worden.' };
			});
	});

	let showAllTouched = $state(false);
	let showAllVotes = $state(false);

	function stemmingKey(v: VoteWithFractie): string {
		return v.stemming_key ?? v.stemming_id.split('/').pop() ?? '';
	}

	// Group votes first by partij_at_time (so historical fractie switches read
	// chronologically as separate blocks), then within each by stem.
	type StemBucket = { stem: string; items: VoteWithFractie[] };
	type PartyBucket = { partij: string; total: number; buckets: StemBucket[] };
	function groupVotes(rows: LidStemDTO[]): PartyBucket[] {
		const byParty = new Map<string, VoteWithFractie[]>();
		for (const raw of rows) {
			const v = raw as VoteWithFractie;
			const p = v.partij_at_time ?? '—';
			if (!byParty.has(p)) byParty.set(p, []);
			byParty.get(p)!.push(v);
		}

		const stemOrder = ['Voor', 'Tegen', 'Onthouden'];
		const result: PartyBucket[] = [];
		for (const [partij, items] of byParty) {
			const byStem = new Map<string, VoteWithFractie[]>();
			for (const v of items) {
				const k = v.soort ?? 'Onbekend';
				if (!byStem.has(k)) byStem.set(k, []);
				byStem.get(k)!.push(v);
			}
			const stems = [...byStem.keys()]
				.sort((a, b) => {
					const ia = stemOrder.indexOf(a),
						ib = stemOrder.indexOf(b);
					if (ia === -1 && ib === -1) return a.localeCompare(b);
					if (ia === -1) return 1;
					if (ib === -1) return -1;
					return ia - ib;
				})
				.map((k) => ({ stem: k, items: byStem.get(k)! }));
			result.push({ partij, total: items.length, buckets: stems });
		}
		// Sort party buckets so the largest (usually the current fractie) is first.
		result.sort((a, b) => b.total - a.total);
		return result;
	}

	function formatYear(d: string | null) {
		if (!d) return '?';
		return d.slice(0, 4);
	}
	function formatRange(van: string | null, tot: string | null) {
		return `${formatYear(van)} – ${tot ? formatYear(tot) : 'heden'}`;
	}
</script>

<div class="r-lid">
	{#if view.kind === 'loading'}
		<p class="loading">Laden…</p>
	{:else if view.kind === 'error'}
		<p class="error">{view.message}</p>
	{:else}
		{@const l = view.l}
		{@const fracties = l.fractielidmaatschappen ?? []}

		<header class="head">
			<div class="kicker-row">
				<span class="kicker">Kamerlid</span>
				<a class="graph-link" href="/explore?focus=leden/{l.key}">Toon op grafiek →</a>
			</div>
			<div class="lid-row">
				<span class="lid-avatar" aria-hidden="true">{initials(l.naam)}</span>
				<div class="lid-meta">
					<h2 class="title">{l.naam ?? l.key}</h2>
					<div class="chips">
						{#if l.partij}<span class="partij-chip">{l.partij}</span>{/if}
						<span class="status-chip" class:status-chip--inactive={!l.actief}>
							{l.actief ? 'Actief' : 'Inactief'}
						</span>
					</div>
				</div>
			</div>
		</header>

		{#if fracties.length > 0}
			{@const huidigeFrac = fracties.filter((f) => !f.tot_en_met)}
			{@const vorigeFrac = [...fracties.filter((f) => !!f.tot_en_met)].sort((a, b) => {
				const endCmp = (b.tot_en_met ?? '').localeCompare(a.tot_en_met ?? '');
				if (endCmp !== 0) return endCmp;
				return (b.van ?? '').localeCompare(a.van ?? '');
			})}
			{#if huidigeFrac.length > 0}
				<section class="sec">
					<h3 class="sec-title">
						Huidige fractie
						<span class="frac-active-dot" aria-hidden="true"></span>
					</h3>
					<ul class="frac-list">
						{#each huidigeFrac as f (f.fractie_id + (f.van ?? ''))}
							<li class="frac-row">
								<a class="frac-name" href="/explore?focus=fracties/{f.fractie_key}">
									{f.naam ?? f.afkorting ?? f.fractie_key}
								</a>
								<span class="frac-range">
									{#if f.van}Lid sinds {formatYear(f.van)}{:else}Huidig lid{/if}
								</span>
								{#if f.functie && f.functie !== 'Lid'}
									<span class="frac-functie">{f.functie}</span>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}
			{#if vorigeFrac.length > 0}
				<section class="sec">
					<h3 class="sec-title sec-title--former">
						Vorige fracties ({vorigeFrac.length})
					</h3>
					<ul class="frac-list frac-list--former">
						{#each vorigeFrac as f (f.fractie_id + (f.van ?? ''))}
							<li class="frac-row">
								<a class="frac-name" href="/explore?focus=fracties/{f.fractie_key}">
									{f.naam ?? f.afkorting ?? f.fractie_key}
								</a>
								<span class="frac-range">{formatRange(f.van, f.tot_en_met)}</span>
								{#if f.functie && f.functie !== 'Lid'}
									<span class="frac-functie">{f.functie}</span>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}
			{#if huidigeFrac.length === 0 && vorigeFrac.length === 0}
				<section class="sec">
					<h3 class="sec-title">Fractielidmaatschappen</h3>
					<p class="empty-note">Geen fractielidmaatschappen geregistreerd.</p>
				</section>
			{/if}
		{/if}

		{#if view.votes && view.votes.votes && view.votes.votes.length > 0}
			{@const allVotes = view.votes.votes}
			{@const visibleVotes = showAllVotes ? allVotes : allVotes.slice(0, 20)}
			{@const partyBuckets = groupVotes(visibleVotes)}
			<section class="sec">
				<h3 class="sec-title">Stemgeschiedenis ({view.votes.total})</h3>
				{#each partyBuckets as pb (pb.partij)}
					{#if partyBuckets.length > 1}
						<div class="party-head">
							<span class="party-name">{pb.partij}</span>
							<span class="party-total">{pb.total} stemmen</span>
						</div>
					{/if}
					{#each pb.buckets as group, i (i)}
						<div class="vote-group">
							<div class="vote-group-head">
								<span class="vote-stem vote-stem--{group.stem.toLowerCase()}">{group.stem}</span>
								<span class="vote-group-count">{group.items.length}</span>
							</div>
							<ul class="vote-list">
								{#each group.items as v (v.stemming_id)}
									<li class="vote-row">
										<button
											type="button"
											class="vote-btn"
											onclick={() => onNavigate?.('stemmingen', stemmingKey(v))}
										>
											<span class="vote-onderwerp">{v.onderwerp ?? '—'}</span>
											<span class="vote-meta">
												{#if v.aantal_zetels > 1}<span class="vote-zetels"
														>{v.aantal_zetels} zetels</span
													>{/if}
												<span
													class="vote-aangenomen"
													class:vote-aangenomen--ja={v.aangenomen}
													class:vote-aangenomen--nee={!v.aangenomen}
												>
													{v.aangenomen ? 'Aangenomen' : 'Verworpen'}
												</span>
												{#if v.datum}<span class="vote-datum">{formatDate(v.datum)}</span>{/if}
											</span>
										</button>
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				{/each}
				{#if allVotes.length > 20 && !showAllVotes}
					<button type="button" class="more-btn" onclick={() => (showAllVotes = true)}>
						+{allVotes.length - 20} meer stemmen
					</button>
				{/if}
			</section>
		{/if}

		{#if view.touched && view.touched.items.length > 0}
			{@const shownTouched = showAllTouched ? view.touched.items : view.touched.items.slice(0, 20)}
			{@const totalTouched = view.touched.count}
			<section class="sec">
				<h3 class="sec-title">
					Bijgedragen aan ({shownTouched.length}{totalTouched > view.touched.items.length
						? ` van ${totalTouched}`
						: totalTouched > shownTouched.length
							? ` van ${totalTouched}`
							: ''})
				</h3>
				<ul class="touched-list">
					{#each shownTouched as inst (inst.instrument_id)}
						<li class="touched-item">
							<a class="touched-name" href="/explore?focus=instruments/{inst.instrument_key}">
								{inst.short_title ??
									inst.citation_title ??
									inst.title ??
									inst.bwb_id ??
									inst.instrument_key}
							</a>
							<span class="touched-count">{inst.count} publ.</span>
						</li>
					{/each}
				</ul>
				{#if view.touched.items.length > 20 && !showAllTouched}
					<button type="button" class="more-btn" onclick={() => (showAllTouched = true)}>
						+{view.touched.items.length - 20} meer
					</button>
				{/if}
			</section>
		{/if}
	{/if}
</div>

<style>
	.r-lid {
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

	/* ── Header — avatar + name + chips, all on same baseline column ── */
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
	.kicker {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-4);
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
	.lid-row {
		display: flex;
		align-items: flex-start;
		gap: var(--s-3);
	}
	.lid-avatar {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--paper-3);
		border: 1px solid var(--rule);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-serif);
		font-size: 17px;
		color: var(--ink-3);
		flex-shrink: 0;
	}
	.lid-meta {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-top: 2px;
	}
	.title {
		font-family: var(--font-serif);
		font-size: 18px;
		font-weight: 400;
		color: var(--ink);
		margin: 0;
		line-height: 1.25;
		overflow-wrap: anywhere;
	}
	.chips {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.partij-chip,
	.status-chip {
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
	}
	.partij-chip {
		background: var(--paper-2);
		color: var(--ink-2);
	}
	.status-chip {
		color: var(--moss);
		border-color: color-mix(in srgb, var(--moss) 25%, transparent);
		background: color-mix(in srgb, var(--moss) 10%, var(--paper));
	}
	.status-chip--inactive {
		color: var(--ink-4);
		border-color: var(--rule);
		background: var(--paper-3);
	}

	/* ── Sections ── */
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
	.sec-title--former {
		color: var(--ink-4);
		opacity: 0.7;
	}
	.frac-active-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--moss);
		margin-left: 5px;
		vertical-align: middle;
	}
	.empty-note {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 12px;
		color: var(--ink-4);
		margin: 0;
	}

	/* ── Fractielidmaatschappen ── */
	.frac-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.frac-list--former {
		opacity: 0.6;
	}
	.frac-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 4px 0;
		border-bottom: 1px dotted var(--rule);
		flex-wrap: wrap;
	}
	.frac-name {
		flex: 1;
		min-width: 0;
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--ink-2);
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	.frac-name:hover {
		color: var(--spine);
	}
	.frac-range {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-4);
		flex-shrink: 0;
	}
	.frac-functie {
		font-family: var(--font-sans);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink-3);
		padding: 0 6px;
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
		background: var(--paper-2);
	}

	/* ── Touched instruments ── */
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
		min-width: 0;
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--ink-2);
		text-decoration: none;
		overflow-wrap: anywhere;
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

	/* ── Votes ── */
	.vote-stem {
		font-family: var(--font-sans);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: 1px 5px;
		border-radius: var(--r-1);
		border: 1px solid var(--rule);
		color: var(--ink-3);
		background: var(--paper-3);
	}
	.vote-stem--voor {
		color: var(--moss);
		border-color: color-mix(in srgb, var(--moss) 25%, transparent);
		background: color-mix(in srgb, var(--moss) 8%, var(--paper));
	}
	.vote-stem--tegen {
		color: var(--spine);
		border-color: color-mix(in srgb, var(--spine) 25%, transparent);
		background: color-mix(in srgb, var(--spine) 8%, var(--paper));
	}
	.vote-stem--onthouden {
		color: var(--ink-3);
	}

	.vote-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.vote-row {
		padding: 0;
		border-bottom: 1px dotted var(--rule);
	}
	.vote-btn {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 5px 0;
		width: 100%;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
	}
	.vote-btn:hover {
		background: var(--paper-2);
	}
	.vote-onderwerp {
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--ink-2);
		line-height: 1.4;
		overflow-wrap: anywhere;
	}
	.vote-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 8px;
		font-family: var(--font-sans);
		font-size: 10px;
		color: var(--ink-4);
	}
	.vote-zetels {
		font-family: var(--font-mono);
	}
	.vote-aangenomen {
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-weight: 600;
	}
	.vote-aangenomen--ja {
		color: var(--moss);
	}
	.vote-aangenomen--nee {
		color: var(--spine);
	}
	.vote-datum {
		font-family: var(--font-mono);
	}

	.vote-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 6px;
	}
	.vote-group-head {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 2px 0;
	}
	.vote-group-count {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-4);
	}

	.party-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-top: var(--s-3);
		padding-bottom: 4px;
		border-bottom: 1px solid var(--rule);
	}
	.party-name {
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 600;
		color: var(--ink-2);
		letter-spacing: 0.02em;
	}
	.party-total {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-4);
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

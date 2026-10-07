<script lang="ts">
	import { korteDatum, maandJaar } from '$lib/text/datum';
	import PostOpen from '$lib/components/open/PostOpen.svelte';
	// Who held which post in a cabinet, on the cabinet's term. Per ministry a line per seat;
	// a successor is the next block on the line, a stand-in has a dotted bar and a grey name.
	// The phases (demissionair and after) are dotted lines with their name on the axis. A
	// block opens its details beneath its line: by click, Enter or Space, and by `?open=`.
	// On a narrow screen the lines become text: per seat the holders one under the other.
	import { partyColor } from '$lib/utils/party-color.svelte';
	import { POST_LABEL, getPartyColors, laterPosts } from './government';
	import {
		actingReason,
		bandsOf,
		lanesOf,
		termOf,
		ticksOf,
		type CabinetDetail,
		type Seat,
		type SeatPost
	} from './occupancy';

	let {
		cabinet,
		openId = null,
		onToggle,
		commitmentsHref
	}: {
		cabinet: CabinetDetail;
		/** The post opened, as `?open=` holds it (see `postId`). */
		openId?: string | null;
		onToggle: (id: string) => void;
		/** Where the open toezeggingen of a person are listed. */
		commitmentsHref: (memberKey: string) => string;
	} = $props();

	let colors = $state<Record<string, string>>({});
	$effect(() => {
		getPartyColors()
			.then((c) => (colors = c))
			.catch(() => {});
	});
	const colorOf = (short: string | null | undefined) =>
		short ? (colors[short] ?? partyColor(short)) : 'var(--rule-strong)';

	// Text instead of a timeline below the width at which a line can hold names.
	let narrow = $state(false);
	$effect(() => {
		const query = window.matchMedia('(max-width: 767px)');
		narrow = query.matches;
		const change = () => (narrow = query.matches);
		query.addEventListener('change', change);
		return () => query.removeEventListener('change', change);
	});

	const term = $derived(termOf(cabinet));
	const ticks = $derived(term ? ticksOf(term) : []);
	const phases = $derived(term ? bandsOf(cabinet.phases ?? [], term) : []);
	const PHASE_LABEL: Record<string, string> = {
		demissionair: 'Demissionair',
		dubbel_demissionair: 'Dubbel demissionair',
		missionair: 'Weer missionair'
	};

	// Seats without a ministry are of two kinds: a post of none (the viceminister-president)
	// and a post whose ministry no source names or the sources dispute. The second stands
	// last, under its own head, and is not placed under a ministry by guess.
	const rows = $derived.by(() => {
		if (!term) return [];
		const t = term;
		const row = (name: string, seats: Seat[]) => ({
			name,
			seats: seats.map((seat) => ({ seat, lanes: lanesOf(seat, t) }))
		});
		const unknown = (s: Seat) => s.posts.some((p) => p.ministry_missing);
		const named = (cabinet.ministries ?? []).filter((m) => m.name && m.seats.length);
		const loose = (cabinet.ministries ?? []).filter((m) => !m.name).flatMap((m) => m.seats);
		return [
			...named.map((m) => row(m.name!, m.seats)),
			row(
				'Zonder ministerie',
				loose.filter((s) => !unknown(s))
			),
			row('Ministerie niet in de gegevens', loose.filter(unknown))
		].filter((r) => r.seats.length);
	});

	const MISSING: Record<NonNullable<SeatPost['ministry_missing']>, string> = {
		no_source: 'Geen officiële bron noemt het ministerie.',
		ambiguous: 'De bronnen noemen verschillende ministeries.'
	};

	// The API counts dossiers and toezeggingen per person over the cabinet: they belong with
	// the person's longest post, not with a short stand-in beside it.
	const counted = $derived.by(() => {
		const all = (cabinet.ministries ?? []).flatMap((m) => m.seats.flatMap((s) => s.posts));
		const later = laterPosts(all);
		return (p: SeatPost) => !later.has(p);
	});

	/** How a post is named in `?open=`: its seat, holder and start. */
	const postId = (seat: Seat, p: SeatPost) =>
		`posts/${seat.seat}/${p.member.key}/${p.from_date ?? ''}`;

	// A link names a seat by its slug, and seats are merged or renamed as the sources are
	// read better. A post whose seat is gone is found by its holder and start; a link that
	// names neither opens nothing.
	const openKey = $derived.by(() => {
		if (!openId?.startsWith('posts/')) return openId;
		const seats = (cabinet.ministries ?? []).flatMap((m) => m.seats);
		if (seats.some((s) => s.posts.some((p) => postId(s, p) === openId))) return openId;
		const [member, from] = openId.split('/').slice(-2);
		for (const s of seats)
			for (const p of s.posts)
				if (p.member.key === member && (p.from_date ?? '') === from) return postId(s, p);
		return null;
	});

	/** A post found through an old link closes by the link's own id. */
	const toggle = (id: string) => onToggle(openKey === id && openId && openId !== id ? openId : id);

	const day = (iso: string | null | undefined) => korteDatum(iso) || 'nu';
	const month = (iso: string | null | undefined) => maandJaar(iso) || 'nu';

	/** The seat's name: the post grey where it is the usual one, the portfolio in ink. */
	function seatName(seat: Seat): { post: string; portfolio: string } {
		if (seat.post === 'minister_zonder_portefeuille' && seat.portfolio)
			return { post: 'Minister voor', portfolio: seat.portfolio };
		return {
			post: seat.post ? POST_LABEL[seat.post] : (seat.function ?? 'Post'),
			portfolio: seat.portfolio ?? ''
		};
	}

	const nameOf = (p: SeatPost) => p.member.name ?? p.member.key;
	const label = (p: SeatPost) =>
		`${nameOf(p)}${p.party?.short ? `, ${p.party.short}` : ''}, ${day(p.from_date)} tot ${day(p.to_date)}${p.acting ? ', waarnemend' : ''}`;
</script>

{#if !term}
	<p class="occ-note">
		{rows.length === 0 && !(cabinet.ministries ?? []).length
			? 'Posten van dit kabinet staan niet in de gegevens.'
			: 'De periode van dit kabinet staat niet in de gegevens.'}
	</p>
{:else if rows.length === 0}
	<p class="occ-note">Posten van dit kabinet staan niet in de gegevens.</p>
{:else if narrow}
	<!-- Phone: per seat the holders one under the other, the phases in a line. -->
	<div class="occ-text">
		{#if phases.length}
			<p class="occ-phases">
				{#each phases as b, i (i)}{i ? ', ' : ''}{(
						PHASE_LABEL[b.phase.kind ?? ''] ??
						b.phase.label ??
						''
					).toLowerCase()} vanaf {day(b.phase.from_date)}{/each}
			</p>
		{/if}
		{#each rows as ministry (ministry.name)}
			<h3 class="occ-ministry">{ministry.name}</h3>
			{#each ministry.seats as { seat } (seat.seat)}
				{@const name = seatName(seat)}
				<p class="occ-seat">
					<span class="occ-post">{name.post}</span>{name.portfolio ? ` ${name.portfolio}` : ''}
				</p>
				<ul class="occ-holders">
					{#each seat.posts as p (postId(seat, p))}
						{@const id = postId(seat, p)}
						<li>
							<button
								type="button"
								class="holder"
								class:holder--acting={p.acting}
								style:--party={colorOf(p.party?.short)}
								aria-expanded={openKey === id}
								data-bron={id}
								onclick={() => toggle(id)}
							>
								<span class="holder-name"
									>{nameOf(p)}{#if p.acting}<span class="holder-note"> waarnemend</span>{/if}</span
								>
								<span class="holder-period">{month(p.from_date)} tot {month(p.to_date)}</span>
							</button>
							{#if openKey === id}
								{@render detail(p)}
							{/if}
						</li>
					{/each}
				</ul>
			{/each}
		{/each}
	</div>
{:else}
	<div class="occ" style:--phases={phases.length}>
		<!-- The axis: the years, and the phases named where they begin. -->
		<div class="occ-row occ-row--axis" aria-hidden="true">
			<span></span>
			<span class="occ-track">
				{#each phases as b, i (i)}
					<span class="phase-label" style:left="{b.from * 100}%"
						>{PHASE_LABEL[b.phase.kind ?? ''] ?? b.phase.label}</span
					>
				{/each}
				{#each ticks as t (t.at)}
					<span class="tick" style:left="{t.at * 100}%">{t.label}</span>
				{/each}
			</span>
		</div>

		{#each rows as ministry (ministry.name)}
			<h3 class="occ-ministry">{ministry.name}</h3>
			{#each ministry.seats as { seat, lanes } (seat.seat)}
				{@const name = seatName(seat)}
				{@const opened = seat.posts.find((p) => openKey === postId(seat, p))}
				<div class="occ-row" class:occ-row--open={!!opened}>
					<span class="occ-seat" title={seat.function ?? undefined}
						><span class="occ-post">{name.post}</span>{name.portfolio
							? ` ${name.portfolio}`
							: ''}</span
					>
					<span class="occ-track" style:--lanes={lanes.length}>
						{#each phases as b, i (i)}
							<span class="phase-line" style:left="{b.from * 100}%" aria-hidden="true"></span>
						{/each}
						{#each lanes as lane, li (li)}
							{#each lane as block (postId(seat, block.post))}
								{@const p = block.post}
								{@const id = postId(seat, p)}
								<button
									type="button"
									class="blk"
									class:blk--acting={p.acting}
									class:blk--open={openKey === id}
									style:left="{block.from * 100}%"
									style:width="max(4px, calc({(block.to - block.from) * 100}% - 2px))"
									style:top="calc({li} * var(--lane))"
									style:--party={colorOf(p.party?.short)}
									title={label(p)}
									aria-label={label(p)}
									aria-expanded={openKey === id}
									data-bron={id}
									onclick={() => toggle(id)}
								>
									<span class="blk-name">{nameOf(p)}</span>
								</button>
							{/each}
						{/each}
					</span>
				</div>
				{#if opened}
					<!-- As an opened row in Bladeren: the same ground, indented to where the bars begin. -->
					<div class="post-open">{@render detail(opened)}</div>
				{/if}
			{/each}
		{/each}
	</div>
{/if}

<!-- The details of a post: who, what, when, why a stand-in, and what they signed. -->
{#snippet detail(p: SeatPost)}
	<PostOpen
		memberKey={p.member.key}
		naam={nameOf(p)}
		partij={p.party?.short ?? null}
		functie={(p.function ?? '') + (p.acting ? ', waarnemend' : '')}
		van={p.from_date ?? null}
		tot={p.to_date ?? null}
		dossiers={p.dossiers ?? 0}
		wetsvoorstellen={p.bills ?? 0}
		geteld={counted(p)}
		toezeggingenHref={counted(p) && p.open_commitments ? commitmentsHref(p.member.key) : null}
		opmerkingen={[
			...(p.also_named?.length ? [`Ook genoemd: ${p.also_named.join(', ')}.`] : []),
			...(p.acting && actingReason(p) ? [`${actingReason(p)}.`] : []),
			...(p.ministry_missing ? [MISSING[p.ministry_missing]] : []),
			...(p.overlaps_with?.length
				? ['Volgens de bronnen tegelijk met een andere bekleder van deze post.']
				: [])
		]}
	/>
{/snippet}

<style>
	.occ {
		--label: 240px;
		--lane: 24px;
		margin: 0 0 var(--s-5);
		font-family: var(--font-sans);
	}
	.occ-row {
		display: grid;
		grid-template-columns: var(--label) minmax(0, 1fr);
		align-items: start;
	}
	.occ-row--open {
		background: var(--paper-2);
	}
	.post-open {
		padding-left: var(--label);
		margin-bottom: var(--s-3);
		background: var(--paper-2);
		border-bottom: 1px solid var(--rule);
	}
	.occ-row--axis {
		height: var(--s-7);
		border-bottom: 1px solid var(--rule-strong);
	}
	.occ-ministry {
		margin: 0;
		padding: var(--s-4) 0 var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 500;
		color: var(--ink);
	}
	.occ-seat {
		padding: var(--s-1) var(--s-3) 0 0;
		font-size: var(--t-micro);
		line-height: 16px;
		color: var(--ink-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* The post is the usual part of a seat's name, the portfolio what tells seats apart. */
	.occ-post {
		color: var(--ink-3);
	}
	.occ-track {
		position: relative;
		display: block;
		height: calc(var(--lanes, 1) * var(--lane));
	}
	.occ-row--axis .occ-track {
		height: 100%;
	}

	.tick {
		position: absolute;
		bottom: var(--s-1);
		transform: translateX(-50%);
		font-size: var(--t-label);
		color: var(--ink-3);
		white-space: nowrap;
	}
	/* A phase: a dotted line through the lines, its name once, on the axis. */
	.phase-label {
		position: absolute;
		top: 0;
		padding-left: var(--s-1);
		border-left: 1px dotted var(--accent);
		font-size: var(--t-label);
		font-weight: 500;
		color: var(--accent);
		white-space: nowrap;
	}
	.phase-line {
		position: absolute;
		top: 0;
		bottom: 0;
		border-left: 1px dotted var(--accent);
		opacity: 0.6;
	}

	/* A holder: light, the party a bar at the left; the one opened in ink. */
	.blk {
		position: absolute;
		height: calc(var(--lane) - var(--s-2));
		margin-top: var(--s-1);
		padding: 0;
		box-sizing: border-box;
		border: 0;
		border-left: 3px solid var(--party);
		background: var(--paper-2);
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
		overflow: hidden;
	}
	.blk:hover {
		background: var(--rule);
	}
	.blk:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.blk--acting {
		background: transparent;
		border-left-style: dotted;
		color: var(--ink-3);
		font-style: italic;
	}
	.blk--open,
	.blk--open:hover {
		background: var(--ink);
		color: var(--paper);
	}
	.blk-name {
		display: block;
		padding: 0 var(--s-1);
		font-size: var(--t-micro);
		line-height: var(--s-4);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Phone: text. */
	.occ-text {
		margin: 0 0 var(--s-5);
		font-family: var(--font-sans);
	}
	.occ-phases {
		margin: 0;
		font-size: var(--t-micro);
		color: var(--accent);
	}
	.occ-text .occ-seat {
		margin: var(--s-2) 0 0;
		padding: 0;
		white-space: normal;
	}
	.occ-holders {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.holder {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--s-2);
		width: 100%;
		min-height: 44px;
		margin: 0;
		padding: 0 0 0 var(--s-2);
		border: 0;
		border-left: 3px solid var(--party);
		background: transparent;
		font: inherit;
		text-align: left;
		color: var(--ink);
		cursor: pointer;
	}
	.holder--acting {
		border-left-style: dotted;
	}
	.holder:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.holder-name {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
	}
	.holder-note,
	.holder-period {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.holder-note {
		margin-left: var(--s-2);
		font-style: italic;
	}
	.holder-period {
		white-space: nowrap;
	}

	.occ-note {
		margin: 0 0 var(--s-4);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
</style>

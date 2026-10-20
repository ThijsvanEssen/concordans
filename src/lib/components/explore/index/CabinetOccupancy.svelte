<script lang="ts">
	import { lacks, NOT_IN_DATA, notHeld } from '$lib/text/coverage';
	import { naamVan } from '$lib/bron/menselijk';
	import { korteDatum, maandJaar } from '$lib/text/datum';
	import CabinetPostOpen from './CabinetPostOpen.svelte';
	// Who held which post in a cabinet, on the cabinet's term. Per ministry a line per seat;
	// a successor is the next block on the line, a stand-in has a dotted frame (not italic).
	// The axis is the shared Tijdas, with the phases (demissionair and after) as dotted lines
	// named above it. A block opens its details beneath its line: by click, Enter or Space,
	// and by `?open=`. On a narrow screen the lines become text: per seat the holders one under
	// the other, each with its Strookje on the same scale.
	import { partyColor } from '$lib/components/explore/party-color.svelte';
	import { smalScherm } from '$lib/util/smal.svelte';
	import { POST_LABEL, laterPosts } from './government';
	import {
		at,
		bandsOf,
		phaseLabel,
		lanesOf,
		termOf,
		type CabinetDetail,
		type CabinetPost,
		type SeatPost
	} from './occupancy';
	import Tijdas from '$lib/components/tijdlijn/Tijdas.svelte';
	import Strookje from '$lib/components/tijdlijn/Strookje.svelte';
	import { periodeZin, randen } from '$lib/components/tijdlijn/tijdas';

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

	const colorOf = (short: string | null | undefined) =>
		short ? partyColor(short) : 'var(--rule-strong)';

	// Text instead of a timeline below the width at which a line can hold names.
	const scherm = smalScherm();

	const term = $derived(termOf(cabinet));
	const as = $derived(
		term && cabinet.from_date
			? {
					periode: { van: term.start, tot: term.end, lopend: term.open },
					...randen(cabinet.from_date, cabinet.to_date ?? null, term.open)
				}
			: null
	);
	const phases = $derived(term ? bandsOf(cabinet.phases ?? [], term) : []);

	// Seats without a ministry are of two kinds: a post of none (the viceminister-president)
	// and a post whose ministry no source names or the sources dispute. The second stands
	// last, under its own head, and is not placed under a ministry by guess.
	const rows = $derived.by(() => {
		if (!term) return [];
		const t = term;
		const row = (name: string, seats: CabinetPost[]) => ({
			name,
			seats: seats.map((seat) => ({ seat, lanes: lanesOf(seat, t) }))
		});
		const unknown = (s: CabinetPost) => s.posts.some((p) => p.ministry_missing);
		const named = (cabinet.ministries ?? []).filter((m) => m.name && m.seats.length);
		const loose = (cabinet.ministries ?? []).filter((m) => !m.name).flatMap((m) => m.seats);
		return [
			...named.map((m) => row(m.name!, m.seats)),
			row(
				'Zonder ministerie',
				loose.filter((s) => !unknown(s))
			),
			row(lacks('ministerie'), loose.filter(unknown))
		].filter((r) => r.seats.length);
	});

	// The API counts dossiers and toezeggingen per person over the cabinet: they belong with
	// the person's longest post, not with a short stand-in beside it.
	const counted = $derived.by(() => {
		const all = (cabinet.ministries ?? []).flatMap((m) => m.seats.flatMap((s) => s.posts));
		const later = laterPosts(all);
		return (p: SeatPost) => !later.has(p);
	});

	/** How a post is named in `?open=`: its seat, holder and start. */
	const postId = (seat: CabinetPost, p: SeatPost) =>
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

	const month = (iso: string) => maandJaar(iso);
	/** On a phone: the post on the scale of the figure, as a Strookje. */
	const plek = (p: SeatPost) =>
		term ? { van: at(term, p.from_date, 'start'), tot: at(term, p.to_date, 'end') } : null;

	/** The seat's name: the post grey where it is the usual one, the portfolio in ink. */
	function seatName(seat: CabinetPost): { post: string; portfolio: string } {
		if (seat.post === 'minister_zonder_portefeuille' && seat.portfolio)
			return { post: 'Minister voor', portfolio: seat.portfolio };
		return {
			post: seat.post ? POST_LABEL[seat.post] : (seat.function ?? 'Post'),
			portfolio: seat.portfolio ?? ''
		};
	}

	const nameOf = (p: SeatPost) => p.member.name ?? naamVan('members', p.member);
	const label = (p: SeatPost) =>
		`${nameOf(p)}${p.party?.short ? `, ${p.party.short}` : ''}, ${periodeZin(p.from_date, p.to_date, korteDatum)}${p.acting ? ', waarnemend' : ''}`;
</script>

{#if !term}
	<p class="occ-note">
		{rows.length === 0 && !(cabinet.ministries ?? []).length
			? `Posten van dit kabinet staan ${NOT_IN_DATA}.`
			: `${notHeld('De periode van dit kabinet')}.`}
	</p>
{:else if rows.length === 0}
	<p class="occ-note">Posten van dit kabinet staan {NOT_IN_DATA}.</p>
{:else if scherm.smal}
	<!-- Phone: per seat the holders one under the other, the phases in a line. -->
	<div class="occ-text">
		{#if phases.length}
			<p class="occ-phases">
				{#each phases as b, i (i)}{i ? ', ' : ''}{phaseLabel(b.phase).toLowerCase()}{b.phase
						.from_date
						? ` vanaf ${korteDatum(b.phase.from_date)}`
						: ''}{/each}
			</p>
		{/if}
		{#if as}
			<div class="mini-as" aria-hidden="true">
				<span>{as.begin}</span><span>{as.eind}</span>
			</div>
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
									>{nameOf(p)}{#if p.acting}<span class="holder-note">, waarnemend</span>{/if}</span
								>
								<span class="holder-period">{periodeZin(p.from_date, p.to_date, month)}</span>
								{#if plek(p)}
									{@const b = plek(p)!}
									<span class="holder-strook"
										><Strookje
											from={b.van}
											to={b.tot}
											kleur={colorOf(p.party?.short)}
											open={openKey === id}
											waarnemend={p.acting}
										/></span
									>
								{/if}
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
	<div class="occ">
		<!-- The axis: the years, and the phases named where they begin. -->
		<div class="occ-row occ-row--axis" aria-hidden="true">
			<span></span>
			{#if as}
				<Tijdas
					periode={as.periode}
					from={as.begin}
					to={as.eind}
					plaats="boven"
					fasen={phases.map((b) => ({
						at: b.from,
						label: phaseLabel(b.phase)
					}))}
				/>
			{/if}
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

{#snippet detail(p: SeatPost)}
	<CabinetPostOpen post={p} counted={counted(p)} {commitmentsHref} />
{/snippet}

<style>
	.occ {
		--label: 240px;
		margin: 0 0 var(--s-5);
		font-family: var(--font-serif);
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
		align-items: end;
	}
	.occ-ministry {
		margin: 0;
		padding: var(--s-4) 0 var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-meta); /* rung 3: a group in a section (docs/typografie.md) */
		font-weight: 600;
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

	.phase-line {
		position: absolute;
		top: 0;
		bottom: 0;
		border-left: 1px dotted var(--rule-strong);
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
		outline: 2px solid var(--focus);
		outline-offset: 1px;
	}
	/* Waarnemend: a dotted frame of 1px, no fill, not italic; the party stays its cap. */
	.blk--acting {
		background: transparent;
		border: 1px dotted var(--ink-3);
		border-left: 3px solid var(--party);
		color: var(--ink-2);
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
		font-family: var(--font-serif);
	}
	/* The phases as words; ink-2, as the word that decides in a meta line. */
	.occ-phases {
		margin: 0;
		font-size: var(--t-micro);
		color: var(--ink-2);
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
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		column-gap: var(--s-2);
		width: 100%;
		min-height: 44px;
		margin: 0;
		padding: var(--s-2) 0 0;
		border: 0;
		background: transparent;
		font: inherit;
		text-align: left;
		color: var(--ink);
		cursor: pointer;
	}
	.holder:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 1px;
	}
	.holder-name {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
	}
	.holder-note,
	.holder-period {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.holder-strook {
		flex-basis: 100%;
		margin: var(--s-1) 0 var(--s-2);
	}
	.mini-as {
		display: flex;
		justify-content: space-between;
		margin: var(--s-3) 0 0;
		padding-bottom: var(--s-1);
		border-bottom: 1px solid var(--rule-strong);
		font-size: var(--t-label); /* a chart's own labels, below the ladder: docs/typografie.md */
		color: var(--ink-3);
	}
	.holder-period {
		white-space: nowrap;
	}

	.occ-note {
		margin: 0 0 var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
</style>

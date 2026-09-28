<script lang="ts">
	// Who held which post in a cabinet, on the cabinet's term. Per ministry a line per seat;
	// a successor is the next block on the line, a stand-in is hatched, two holders at once
	// (a doubt in the sources) are outlined. The demissionary phases lie behind as bands.
	// Compact: one line per ministry, the minister's seat, without names.
	import { bronHref } from '$lib/bron/href';
	import { partyColor } from '$lib/utils/party-color';
	import { getCabinet, getPartyColors } from './government';
	import {
		bandsOf,
		lanesOf,
		seatLabel,
		termOf,
		ticksOf,
		type CabinetDetail,
		type Seat,
		type SeatPost
	} from './occupancy';

	let {
		cabinet = null,
		cabinetKey = null,
		compact = false
	}: {
		/** The cabinet with its seats, when the page has it already. */
		cabinet?: CabinetDetail | null;
		/** Else the key of the cabinet, asked for here. */
		cabinetKey?: string | null;
		compact?: boolean;
	} = $props();

	let fetched = $state<CabinetDetail | null>(null);
	let failed = $state(false);
	$effect(() => {
		if (cabinet || !cabinetKey) return;
		let stale = false;
		failed = false;
		getCabinet(cabinetKey)
			.then((c) => !stale && (fetched = c))
			.catch(() => !stale && (failed = true));
		return () => {
			stale = true;
		};
	});
	const shown = $derived(cabinet ?? (fetched?.key === cabinetKey ? fetched : null));

	let colors = $state<Record<string, string>>({});
	$effect(() => {
		getPartyColors()
			.then((c) => (colors = c))
			.catch(() => {});
	});
	const colorOf = (short: string | null | undefined) =>
		short ? (colors[short] ?? partyColor(short)) : 'var(--ink-3)';

	const term = $derived(shown ? termOf(shown) : null);
	const ticks = $derived(term ? ticksOf(term) : []);
	const bands = $derived(term && shown ? bandsOf(shown.phases ?? [], term) : []);

	const BAND_LABEL: Record<string, string> = {
		demissionair: 'Demissionair',
		dubbel_demissionair: 'Dubbel demissionair',
		missionair: 'Weer missionair'
	};

	/** The ministries with their seats; compact, the first seat of each (its minister). */
	const rows = $derived.by(() => {
		if (!shown || !term) return [];
		return (shown.ministries ?? [])
			.filter((m) => m.seats.length)
			.map((m) => {
				const seats: Seat[] = compact ? [m.seats[0]] : m.seats;
				return {
					name: m.name ?? 'Zonder ministerie',
					seats: seats.map((seat) => ({ seat, lanes: lanesOf(seat, term) }))
				};
			});
	});

	const MONTHS = [
		'jan',
		'feb',
		'mrt',
		'apr',
		'mei',
		'jun',
		'jul',
		'aug',
		'sep',
		'okt',
		'nov',
		'dec'
	];
	const fmt = (iso: string | null | undefined) => {
		if (!iso) return 'nu';
		const [y, m, d] = iso.split('-').map(Number);
		return `${d} ${MONTHS[m - 1]} ${y}`;
	};

	function tooltip(p: SeatPost): string {
		const party = p.party?.short ? ` (${p.party.short})` : '';
		const lines = [
			`${p.member.name ?? p.member.key}${party}`,
			p.function ?? '',
			`${fmt(p.from_date)} tot ${fmt(p.to_date)}`
		];
		if (p.acting) lines.push(`Waarnemend${p.acting_basis ? `: ${p.acting_basis}` : ''}`);
		if (p.overlaps_with?.length)
			lines.push('Valt samen met een andere bekleder volgens de bronnen');
		return lines.filter(Boolean).join('\n');
	}
	const hrefOf = (p: SeatPost) =>
		bronHref(`members/${p.member.key}`, { keepMode: false, mode: 'read' });
</script>

{#if failed}
	<p class="occ-note">De bezetting van dit kabinet kon niet worden geladen.</p>
{:else if shown && !term}
	<p class="occ-note">De periode van dit kabinet is niet bekend.</p>
{:else if shown && term}
	{#if rows.length === 0}
		<p class="occ-note">Voor dit kabinet zijn geen posten bekend.</p>
	{:else}
		<figure class="occ" class:occ--compact={compact}>
			<div class="occ-scroll">
				<div class="occ-grid">
					<!-- The axis, with the phases named where they begin. -->
					<div class="occ-label occ-label--axis" aria-hidden="true"></div>
					<div class="occ-track occ-track--axis" aria-hidden="true">
						{#each bands as b, i (i)}
							<span
								class="band"
								class:band--double={b.phase.kind === 'dubbel_demissionair'}
								style:left="{b.from * 100}%"
								style:width="{(b.to - b.from) * 100}%"
							></span>
							<span
								class="band-label"
								style:left="{b.from * 100}%"
								style:max-width="{(b.to - b.from) * 100}%"
								title="{BAND_LABEL[b.phase.kind ?? ''] ?? b.phase.label} vanaf {fmt(
									b.phase.from_date
								)}{b.phase.label ? `. ${b.phase.label}` : ''}"
								>{BAND_LABEL[b.phase.kind ?? ''] ?? b.phase.label}</span
							>
						{/each}
						{#each ticks as t (t.at)}
							<span class="tick" style:left="{t.at * 100}%"><span>{t.label}</span></span>
						{/each}
					</div>

					{#each rows as ministry (ministry.name)}
						{#if !compact}
							<div class="occ-ministry">{ministry.name}</div>
						{/if}
						{#each ministry.seats as { seat, lanes } (seat.seat)}
							<div class="occ-label" title={seat.function ?? undefined}>
								{compact ? ministry.name : seatLabel(seat)}
							</div>
							<div class="occ-track" style:--lanes={lanes.length}>
								{#each bands as b, i (i)}
									<span
										class="band"
										class:band--double={b.phase.kind === 'dubbel_demissionair'}
										style:left="{b.from * 100}%"
										style:width="{(b.to - b.from) * 100}%"
										aria-hidden="true"
									></span>
								{/each}
								{#each ticks as t (t.at)}
									<span class="grid-line" style:left="{t.at * 100}%" aria-hidden="true"></span>
								{/each}
								{#each lanes as lane, li (li)}
									{#each lane as block, bi (block.post.member.key + (block.post.from_date ?? '') + bi)}
										{@const p = block.post}
										<a
											class="blk"
											class:blk--alt={bi % 2 === 1}
											class:blk--acting={p.acting}
											class:blk--doubt={(p.overlaps_with?.length ?? 0) > 0}
											href={hrefOf(p)}
											style:left="{block.from * 100}%"
											style:width="max(3px, calc({(block.to - block.from) * 100}% - 2px))"
											style:top="calc({li} * var(--lane))"
											style:--party={colorOf(p.party?.short)}
											title={tooltip(p)}
											aria-label={tooltip(p).replaceAll('\n', ', ')}
										>
											{#if !compact}
												<span class="blk-name"
													>{p.member.name ?? p.member.key}{p.acting ? ' (waarn.)' : ''}</span
												>
											{/if}
										</a>
									{/each}
								{/each}
							</div>
						{/each}
					{/each}
				</div>
			</div>
			{#if !compact}
				<figcaption class="occ-legend">
					<span><i class="sw"></i>Bekleder, de streep in de kleur van de partij</span>
					<span><i class="sw sw--acting"></i>Waarnemend</span>
					<span><i class="sw sw--doubt"></i>Twee bekleders tegelijk volgens de bronnen</span>
					{#if bands.length}<span><i class="sw sw--band"></i>Demissionair</span>{/if}
					{#if term.open}<span>Tot vandaag</span>{/if}
				</figcaption>
			{/if}
		</figure>
	{/if}
{:else if cabinetKey}
	<p class="occ-note">Laden…</p>
{/if}

<style>
	.occ {
		margin: 0 0 20px;
		font-family: var(--font-sans);
	}
	.occ-scroll {
		overflow-x: auto;
	}
	.occ-grid {
		--label: 240px;
		--lane: 22px;
		display: grid;
		grid-template-columns: var(--label) minmax(0, 1fr);
		min-width: 720px;
	}
	.occ--compact .occ-grid {
		--label: 200px;
		--lane: 12px;
		min-width: 520px;
	}

	.occ-ministry {
		grid-column: 1 / -1;
		padding: 12px 0 4px;
		border-bottom: 1px solid var(--rule-strong);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 500;
		color: var(--ink);
	}
	.occ-label {
		padding: 3px 12px 3px 0;
		font-size: var(--t-micro);
		color: var(--ink-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 16px;
	}
	.occ--compact .occ-label {
		padding: 1px 12px 1px 0;
		font-size: 11px;
		line-height: 12px;
	}
	.occ-track {
		position: relative;
		height: calc(var(--lanes, 1) * var(--lane) + 2px);
		border-bottom: 1px solid var(--rule);
	}
	.occ-track--axis {
		height: 44px;
		border-bottom: 1px solid var(--rule-strong);
	}

	.tick {
		position: absolute;
		bottom: 0;
		height: 8px;
		border-left: 1px solid var(--rule-strong);
	}
	.tick span {
		position: absolute;
		bottom: 10px;
		left: 0;
		transform: translateX(-50%);
		font-size: 11px;
		color: var(--ink-3);
		white-space: nowrap;
	}
	.grid-line {
		position: absolute;
		top: 0;
		bottom: 0;
		border-left: 1px solid var(--rule);
	}

	/* The demissionary phases: a tint behind, darker when the cabinet is a rump. */
	.band {
		position: absolute;
		top: 0;
		bottom: 0;
		background: color-mix(in srgb, var(--accent) 7%, transparent);
	}
	.band--double {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
	}
	.band-label {
		position: absolute;
		top: 0;
		box-sizing: border-box;
		overflow: hidden;
		text-overflow: ellipsis;
		padding-left: 4px;
		border-left: 1.5px solid var(--accent);
		font-size: 11px;
		font-weight: 500;
		color: var(--accent);
		white-space: nowrap;
	}

	/* A holder: ink, the party a stripe at the foot; a successor a shade lighter. */
	.blk {
		position: absolute;
		height: calc(var(--lane) - 4px);
		margin-top: 2px;
		box-sizing: border-box;
		background: var(--ink);
		border-bottom: 3px solid var(--party);
		color: var(--paper);
		text-decoration: none;
		overflow: hidden;
	}
	.blk--alt {
		background: var(--ink-2);
	}
	.blk--acting {
		background: repeating-linear-gradient(135deg, var(--ink-3) 0 3px, var(--rule-strong) 3px 6px);
		color: var(--ink);
	}
	.blk--doubt {
		outline: 1.5px dashed var(--accent);
		outline-offset: -1.5px;
	}
	.blk:hover,
	.blk:focus-visible {
		background: var(--accent);
		color: var(--paper);
	}
	.blk:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 1px;
	}
	.blk-name {
		display: block;
		padding: 0 6px;
		font-size: 11px;
		line-height: 15px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.blk--acting .blk-name {
		background: color-mix(in srgb, var(--paper) 80%, transparent);
	}

	.occ-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 18px;
		margin-top: 10px;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.occ-legend span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.sw {
		display: inline-block;
		width: 20px;
		height: 11px;
		box-sizing: border-box;
		background: var(--ink);
		border-bottom: 3px solid var(--ink-3);
	}
	.sw--acting {
		background: repeating-linear-gradient(135deg, var(--ink-3) 0 3px, var(--rule-strong) 3px 6px);
		border: 0;
	}
	.sw--doubt {
		background: transparent;
		border: 1.5px dashed var(--accent);
	}
	.sw--band {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		border: 0;
	}
	.occ-note {
		margin: 0 0 16px;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
</style>

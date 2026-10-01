<script lang="ts">
	import type { Schema } from '$lib/api/types';
	import { bronHref } from '$lib/bron/href';
	import { seatCount } from '$lib/verbonden/filter';
	import { formatLongDate } from './readers/_shared';
	import { chamberName } from '$lib/components/parliamentary/chamber';

	type Seats = Schema<'ParliamentSeatsResponse'>;
	type SeatFaction = Seats['factions'][number];

	let {
		data,
		hrefOf = (key: string) => bronHref(`factions/${key}`, { keepMode: false, mode: 'read' }),
		voteHighlight = null,
		colorOf = null,
		meubels = false
	}: {
		/** Ronde 4: de kleur van een stoel (fractie, volgnummer), zoals de Kamer haar tekent. */
		colorOf?: ((f: SeatFaction, i: number) => string) | null;
		/** Ronde 4: Voorzitter, griffier, kabinet (vak-K), verslag en spreekgestoelte tekenen. */
		meubels?: boolean;
		data: Seats;
		/** Where a fractie's sector links: its reader, unless the page says otherwise. */
		hrefOf?: (key: string) => string;
		/** Faction key → side on one stemming. Set to light up the seats by vote instead
		 * of by party; a faction with no entry did not take part. */
		voteHighlight?: Record<string, 'voor' | 'tegen' | 'other'> | null;
	} = $props();

	// The factions as they sit in the plenary hall, from the chair's left: the order of the
	// Kamer's own plan (`seating_plan`), which the API gives per faction.
	const seated = $derived([...data.factions].sort((a, b) => a.order - b.order));

	const voteTotals = $derived.by(() => {
		if (!voteHighlight) return null;
		let voor = 0;
		let tegen = 0;
		for (const f of seated) {
			if (voteHighlight[f.key] === 'voor') voor += f.seats;
			else if (voteHighlight[f.key] === 'tegen') tegen += f.seats;
		}
		return { voor, tegen };
	});

	// Fixed row capacities: 150 seats for the Tweede Kamer, 75 for the Eerste. Radii scale
	// linearly inner→outer.
	const ROWS_150 = [14, 17, 19, 21, 24, 26, 29];
	const ROWS_75 = [8, 10, 11, 13, 15, 18];
	const ROW_CAPS = $derived(data.total_seats <= 75 ? ROWS_75 : ROWS_150);
	const kamer = $derived(chamberName(data.chamber));
	const VIEW_W = 440;
	const VIEW_H = $derived(meubels ? 292 : 230);
	const CX = VIEW_W / 2;
	const CY = 210;
	const R_INNER = 90;
	const R_OUTER = 200;
	// SEAT_R 7 (was 6): aangrenzende stoelen raken elkaar net, zodat een
	// fractie als een aaneengesloten band leest in plaats van losse puntjes.
	const SEAT_R = $derived(data.total_seats <= 75 ? 9 : 7);
	// Hitbox per fractie: a wedge from the gap before its first seat to the gap after
	// its last, and from the inner to the outer row. Seats are dealt out by angle, so
	// every faction holds one angular band and the wedges tile without overlap.
	const HIT_R_PAD = $derived(SEAT_R + 2);

	type Seat = {
		x: number;
		y: number;
		angle: number;
		faction: SeatFaction;
	};

	const seats = $derived.by<Seat[]>(() => {
		// Build raw positions, ordered left→right across all rows.
		const raw: { x: number; y: number; angle: number }[] = [];
		for (let i = 0; i < ROW_CAPS.length; i++) {
			const cap = ROW_CAPS[i];
			const r = R_INNER + (i * (R_OUTER - R_INNER)) / (ROW_CAPS.length - 1);
			for (let j = 0; j < cap; j++) {
				const t = cap === 1 ? 0.5 : j / (cap - 1);
				const angle = Math.PI - t * Math.PI; // π → 0
				raw.push({
					x: CX + r * Math.cos(angle),
					y: CY - r * Math.sin(angle),
					angle
				});
			}
		}
		// Leftmost first.
		raw.sort((a, b) => b.angle - a.angle);

		// Assign factions in order.
		const out: Seat[] = [];
		let idx = 0;
		for (const f of seated) {
			for (let k = 0; k < f.seats && idx < raw.length; k++, idx++) {
				out.push({ ...raw[idx], faction: f });
			}
		}
		return out;
	});

	// One wedge per faction, bounded halfway between its outer seats and the
	// neighbouring faction's, so the hover area follows the seats themselves.
	type Sector = { faction: SeatFaction; path: string };
	const sectors = $derived.by<Sector[]>(() => {
		const bands: { faction: SeatFaction; hi: number; lo: number }[] = [];
		for (const s of seats) {
			const last = bands.at(-1);
			if (last && last.faction.id === s.faction.id) last.lo = s.angle;
			else bands.push({ faction: s.faction, hi: s.angle, lo: s.angle });
		}
		const rIn = R_INNER - HIT_R_PAD;
		const rOut = R_OUTER + HIT_R_PAD;
		const polar = (a: number, r: number): [number, number] => [
			CX + r * Math.cos(a),
			CY - r * Math.sin(a)
		];
		// The outer edges of the first and last band reach the floor of the chamber.
		const edgePad = HIT_R_PAD / R_INNER;
		return bands.map((band, i) => {
			const aMax = i === 0 ? band.hi + edgePad : (bands[i - 1].lo + band.hi) / 2;
			const aMin = i === bands.length - 1 ? band.lo - edgePad : (band.lo + bands[i + 1].hi) / 2;
			const [x1, y1] = polar(aMax, rIn);
			const [x2, y2] = polar(aMax, rOut);
			const [x3, y3] = polar(aMin, rOut);
			const [x4, y4] = polar(aMin, rIn);
			// Outer arc runs clockwise on screen (sweep 1), the inner arc back (sweep 0).
			const path = [
				`M ${x1} ${y1}`,
				`L ${x2} ${y2}`,
				`A ${rOut} ${rOut} 0 0 1 ${x3} ${y3}`,
				`L ${x4} ${y4}`,
				`A ${rIn} ${rIn} 0 0 0 ${x1} ${y1}`,
				'Z'
			].join(' ');
			return { faction: band.faction, path };
		});
	});

	let hovered = $state<SeatFaction | null>(null);
</script>

<figure class="hemicycle" aria-label="Zetelverdeling {kamer}">
	<svg viewBox="0 0 {VIEW_W} {VIEW_H}">
		<!-- Sectoren eerst (onder de stoelen) zodat ze de pointer-events
         opvangen zonder over de stoelen te tekenen. -->
		{#each sectors as sec (sec.faction.id)}
			<!-- A fractie is a bron: its sector is a link, as its name is everywhere else. -->
			<a
				href={hrefOf(sec.faction.key)}
				aria-label={`${sec.faction.abbreviation ?? sec.faction.key}, ${sec.faction.name ?? ''}, ${seatCount(sec.faction.seats)}`}
				data-sveltekit-noscroll
				onmouseenter={() => (hovered = sec.faction)}
				onmouseleave={() => (hovered = null)}
				onfocus={() => (hovered = sec.faction)}
				onblur={() => (hovered = null)}
			>
				<path d={sec.path} class="sector" />
			</a>
		{/each}
		{#each seats as s, i (s.faction.id + ':' + s.x + ':' + s.y)}
			{@const side = voteHighlight?.[s.faction.key]}
			{@const kleur = colorOf ? colorOf(s.faction, i) : s.faction.color}
			<circle
				aria-hidden="true"
				cx={s.x}
				cy={s.y}
				r={SEAT_R}
				fill={side === 'tegen' ? undefined : kleur}
				style:stroke={side === 'tegen' ? kleur : undefined}
				class="seat"
				class:seat--dim={hovered !== null && hovered.id !== s.faction.id}
				class:seat--hi={hovered?.id === s.faction.id}
				class:seat--vote-tegen={side === 'tegen'}
				class:seat--vote-other={voteHighlight != null && side == null}
			/>
		{/each}
		{#if hovered}
			<text
				x={CX}
				y={CY - 6}
				text-anchor="middle"
				class="center-num center-num--party"
				style:fill={hovered.color}
				aria-live="polite"
			>
				{hovered.abbreviation ?? hovered.key}
			</text>
			<text x={CX} y={CY + 10} text-anchor="middle" class="center-lbl">
				{hovered.seats}
				{hovered.seats === 1 ? 'zetel' : 'zetels'}
			</text>
		{:else if voteTotals}
			<text x={CX} y={CY - 6} text-anchor="middle" class="center-num" aria-live="polite">
				{voteTotals.voor}
			</text>
			<text x={CX} y={CY + 10} text-anchor="middle" class="center-lbl">
				voor · {voteTotals.tegen} tegen
			</text>
		{:else}
			<text x={CX} y={CY - 6} text-anchor="middle" class="center-num">
				{data.assigned_seats}
			</text>
			<text x={CX} y={CY + 8} text-anchor="middle" class="center-lbl">zetels</text>
		{/if}
		{#if meubels}
			{@const y = CY + 30}
			<!-- Zoals de zetelverdeling van de Tweede Kamer: 1 Voorzitter, 2 Griffier,
			     3 Kabinet (vak-K), 4 Verslag en redactie, 5 Spreekgestoelte. -->
			<g class="meubel">
				<rect x={CX - 118} y={y} width="56" height="14" rx="2" />
				<rect x={CX - 56} y={y} width="36" height="14" rx="2" />
				<rect x={CX - 12} y={y + 22} width="24" height="12" rx="2" />
				<rect x={CX + 22} y={y} width="96" height="14" rx="2" />
				<rect x={CX + 126} y={y} width="44" height="14" rx="2" />
			</g>
			{#each [[CX - 90, y + 7, '1'], [CX - 38, y + 7, '2'], [CX + 70, y + 7, '3'], [CX + 148, y + 7, '4'], [CX, y + 28, '5']] as [x, yy, n] (n)}
				<circle cx={x} cy={yy} r="7" class="nr" />
				<text x={x} y={Number(yy) + 3} text-anchor="middle" class="nr-t">{n}</text>
			{/each}
		{/if}
	</svg>

	<!-- Tekstfallback voor schermlezers: de SVG zelf is aria-hidden zodat
       de seat-circles geen ruis maken; deze lijst geeft het volledige
       overzicht in stemvolgorde. -->
	<ul class="hemicycle-sr-list">
		{#each seated as f (f.id)}
			<li>{f.abbreviation ?? f.key}, {f.name ?? ''}, {seatCount(f.seats)}</li>
		{/each}
	</ul>
	<figcaption class="hemicycle-caption">
		<!-- The count stands in the middle; only seats not yet assigned are worth a word. -->
		{kamer}, {data.chamber === 'EK' ? 'samenstelling' : 'stand'} op {formatLongDate(
			data.as_of ?? null
		)}{data.assigned_seats < data.total_seats
			? `, ${data.assigned_seats} van ${data.total_seats} zetels toegewezen`
			: ''}
		{#if data.seating_plan}
			{@const plan = data.seating_plan}
			<span class="hemicycle-source"
				>Zaalindeling volgens de Tweede Kamer: <a href={plan.page ?? plan.url} rel="external"
					>{plan.title}</a
				></span
			>
		{/if}
	</figcaption>
</figure>

<style>
	.meubel rect {
		fill: var(--paper-2);
		stroke: var(--rule-strong);
	}
	.nr {
		fill: var(--ink);
	}
	.nr-t {
		font: 600 var(--t-glyph) var(--font-sans);
		fill: var(--paper);
	}
	.hemicycle {
		/* `flex: 1` only has effect inside a flex parent; elsewhere the figure is a block. */
		flex: 1;
		margin: 0;
		padding: var(--s-4) var(--s-4) var(--s-3);
		border: 1px solid var(--rule);
		background: var(--paper-2);
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 6px;
	}
	.hemicycle svg {
		display: block;
		width: 100%;
		height: auto;
		max-height: 320px;
	}
	/* A seat is decorative; the pointer events are on the sector beneath it. The party
	   colour reads against paper-2 without a contour, and at r=7 the seats form groups.
	   On hover the other factions dim. */
	.seat {
		pointer-events: none;
		stroke: none;
		transition:
			opacity var(--dur-1) var(--ease),
			fill var(--dur-2) var(--ease),
			stroke var(--dur-2) var(--ease);
	}
	.seat--dim {
		opacity: 0.22;
	}
	.seat--hi {
		stroke: none;
	}
	/* Every seat keeps its party colour during a vote. Voor is a solid seat, tegen a
	   ring in the party colour, and a faction that did not vote fades out. */
	.seat--vote-tegen {
		fill: var(--paper-2);
		stroke-width: 2;
	}
	.seat--vote-other {
		opacity: 0.18;
	}
	/* Sector hitbox: a transparent wedge around a whole faction. */
	.sector {
		fill: transparent;
		cursor: pointer;
	}
	a {
		outline: none;
	}
	a:focus-visible .sector {
		fill: var(--accent-soft);
		stroke: var(--accent);
		stroke-width: 0.8;
		stroke-dasharray: 3 2;
	}
	.center-num {
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		fill: var(--ink);
	}
	/* On hover the centre shows the faction's abbreviation, in its own colour via the
	   inline style. */
	.center-num--party {
		font-size: var(--t-h3);
		font-weight: 500;
	}
	.center-lbl {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		fill: var(--ink-3);
	}
	.hemicycle-caption {
		margin: 0;
		padding-top: var(--s-1);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
		text-align: center;
	}
	/* Where the order comes from: a line of its own under the count. */
	.hemicycle-source {
		display: block;
	}
	.hemicycle-source a {
		color: inherit;
		text-decoration: none;
		border-bottom: 1px solid var(--rule-strong);
	}
	.hemicycle-source a:hover {
		color: var(--accent);
	}

	/* Visually hidden, but exposed to screen readers. */
	.hemicycle-sr-list {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>

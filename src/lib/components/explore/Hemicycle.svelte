<script lang="ts">
	import { langeDatum } from '$lib/text/datum';
	import { RIJEN_150, RIJEN_75, deelStoelen, stemVanStoel } from './stoel';
	import { fractieNaam } from '$lib/bron/menselijk';
	import type { Schema } from '$lib/api/types';
	import { bronHref } from '$lib/bron/href';
	import { seatCount } from '$lib/verbonden/filter';
	import { chamberName } from '$lib/components/parliamentary/chamber';
	import FractiePatronen from './FractiePatronen.svelte';
	import { patroonId, patroonVan } from './partijkleuren.svelte';

	type Seats = Schema<'ParliamentSeatsResponse'>;
	type SeatFaction = Seats['factions'][number];

	let {
		data,
		voteHighlight = null,
		woorden = ['voor', 'tegen'],
		telling = true,
		colorOf = null,
		meubels = false,
		vacant = 0
	}: {
		/** The vacant seats no fractie holds (UX #48): empty seats after all fracties. */
		vacant?: number;
		/** De kleur van een stoel (fractie, volgnummer), zoals de Kamer haar tekent. */
		colorOf?: ((f: SeatFaction, i: number) => string) | null;
		/** Voorzitter, griffier, kabinet (vak-K), verslag en spreekgestoelte tekenen. */
		meubels?: boolean;
		data: Seats;
		/** Faction key → side on one stemming. Set to light up the seats by vote instead
		 * of by party; a faction with no entry did not take part. */
		voteHighlight?: Record<string, 'voor' | 'tegen' | 'other'> | null;
		/** The two sides of `voteHighlight` as words: voor and tegen, or coalitie and oppositie. */
		woorden?: [string, string];
		/** The count of the two sides in the middle; off where a bar under the hall says it. */
		telling?: boolean;
	} = $props();

	/** Where a fractie's sector links: its reader. */
	const hrefOf = (key: string) => bronHref(`factions/${key}`, { keepMode: false, mode: 'read' });

	// The factions as they sit in the plenary hall, from the chair's left: the order of the
	// Kamer's own plan (`seating_plan`), which the API gives per faction.
	const seated = $derived([...data.factions].sort((a, b) => a.order - b.order));

	const voteTotals = $derived.by(() => {
		if (!voteHighlight) return null;
		let voor = 0;
		let tegen = 0;
		for (const f of seated) {
			const k = f.key;
			if (!k) continue;
			if (voteHighlight[k] === 'voor') voor += f.seats;
			else if (voteHighlight[k] === 'tegen') tegen += f.seats;
		}
		return { voor, tegen };
	});

	// Fixed row capacities: 150 seats for the Tweede Kamer, 75 for the Eerste. Radii scale
	// linearly inner→outer; each row holds what its six blocks hold without seats touching.
	// Every block holds as many seats in a row as the others: even rows (Thijs, 10 Oct).
	const ROW_CAPS = $derived(data.total_seats <= 75 ? RIJEN_75 : RIJEN_150);
	const kamer = $derived(chamberName(data.chamber));
	// As the Kamer draws its plenaire zaal ("Zetelverdeling plenaire zaal", tweedekamer.nl,
	// Wie zit waar): seen from the public tribune, the front with the Voorzitter, the
	// spreekgestoelte and vak-K at the top, the rows of seats opening toward it below, in
	// six blocks between five aisles. The fracties from the Voorzitter's left (`order`)
	// start on the right of the picture. docs/hierarchie.md, Parlement.
	const VIEW_W = 440;
	const CX = VIEW_W / 2;
	const FRONT = $derived(meubels ? 78 : 12);
	const CY = $derived(FRONT);
	const R_INNER = 110;
	const R_OUTER = 200;
	const SEAT_R = $derived(data.total_seats <= 75 ? 9 : 7);
	/** A seat's width along its row and its depth toward the front. */
	const SEAT_W = $derived(SEAT_R * 1.75);
	const SEAT_D = $derived(SEAT_R * 1.6);
	const VIEW_H = $derived(CY + R_OUTER + SEAT_R + 6);
	const BLOCKS = 6;
	/** The width of an aisle, the same in every row: the aisles run straight to the front. */
	const AISLE = 18;
	// Hitbox per fractie: a wedge from the gap before its first seat to the gap after
	// its last, and from the inner to the outer row. Seats are dealt out by angle, so
	// every faction holds one angular band and the wedges tile without overlap.
	const HIT_R_PAD = $derived(SEAT_R + 2);
	const polar = (a: number, r: number): [number, number] => [
		CX + r * Math.cos(a),
		CY + r * Math.sin(a)
	];

	type Seat = {
		x: number;
		y: number;
		angle: number;
		/** Null for a vacant seat no fractie holds (UX #48). */
		faction: SeatFaction | null;
		/** A vacant seat (`vacant`, API 0.79.44, #526): drawn empty. */
		leeg?: boolean;
	};

	const seats = $derived.by<Seat[]>(() => {
		// The seats of each row over six blocks; an aisle takes the same width in every row.
		const raw: { x: number; y: number; angle: number }[] = [];
		for (let i = 0; i < ROW_CAPS.length; i++) {
			const cap = ROW_CAPS[i];
			const r = R_INNER + (i * (R_OUTER - R_INNER)) / (ROW_CAPS.length - 1);
			const gap = AISLE / r;
			const block = (Math.PI - (BLOCKS - 1) * gap) / BLOCKS;
			for (let b = 0; b < BLOCKS; b++) {
				const n = Math.round(((b + 1) * cap) / BLOCKS) - Math.round((b * cap) / BLOCKS);
				const start = b * (block + gap);
				for (let k = 0; k < n; k++) {
					const angle = start + ((k + 0.5) / n) * block;
					const [x, y] = polar(angle, r);
					raw.push({ x, y, angle });
				}
			}
		}
		// From the right of the picture, the Voorzitter's left, as `order` counts.
		raw.sort((a, b) => a.angle - b.angle);
		return deelStoelen(raw, seated, vacant);
	});

	// One wedge per faction, bounded halfway between its outer seats and the
	// neighbouring faction's, so the hover area follows the seats themselves.
	type Sector = { faction: SeatFaction; path: string };
	const sectors = $derived.by<Sector[]>(() => {
		const bands: { faction: SeatFaction; lo: number; hi: number }[] = [];
		for (const s of seats) {
			if (!s.faction) continue;
			const last = bands.at(-1);
			if (last && last.faction.id === s.faction.id) last.hi = s.angle;
			else bands.push({ faction: s.faction, lo: s.angle, hi: s.angle });
		}
		const rIn = R_INNER - HIT_R_PAD;
		const rOut = R_OUTER + HIT_R_PAD;
		const edgePad = HIT_R_PAD / R_INNER;
		return bands.map((band, i) => {
			const a0 = i === 0 ? band.lo - edgePad : (bands[i - 1].hi + band.lo) / 2;
			const a1 = i === bands.length - 1 ? band.hi + edgePad : (band.hi + bands[i + 1].lo) / 2;
			const [x1, y1] = polar(a0, rIn);
			const [x2, y2] = polar(a0, rOut);
			const [x3, y3] = polar(a1, rOut);
			const [x4, y4] = polar(a1, rIn);
			// With the bowl below the front, a growing angle runs clockwise on screen.
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

	/** The middle of the bowl, under the front: where the count and a fractie's name stand. */
	const MID = $derived(CY + (meubels ? 72 : 50));

	let hovered = $state<SeatFaction | null>(null);
	const uid = $props.id();
	const naamVan = (f: SeatFaction) => fractieNaam(f);
</script>

<figure class="hemicycle" class:kaal={meubels} aria-label="Zetelverdeling {kamer}">
	<svg viewBox="0 0 {VIEW_W} {VIEW_H}" role="group" aria-label="Zetels per fractie">
		<FractiePatronen prefix={uid} namen={seated.map(naamVan)} />
		<!-- Sectoren eerst (onder de stoelen) zodat ze de pointer-events
         opvangen zonder over de stoelen te tekenen. -->
		{#each sectors as sec (sec.faction.id)}
			<!-- A fractie is a bron: its sector is a link, as its name is everywhere else. -->
			<a
				href={sec.faction.key ? hrefOf(sec.faction.key) : undefined}
				aria-label={`${naamVan(sec.faction)}, ${sec.faction.name ?? ''}, ${seatCount(sec.faction.seats)}`}
				data-sveltekit-noscroll
				onmouseenter={() => (hovered = sec.faction)}
				onmouseleave={() => (hovered = null)}
				onfocus={() => (hovered = sec.faction)}
				onblur={() => (hovered = null)}
			>
				<path d={sec.path} class="sector" />
			</a>
		{/each}
		{#each seats as s, i ((s.faction?.id ?? 'vacant') + ':' + s.x + ':' + s.y)}
			{@const stem = stemVanStoel(s, voteHighlight)}
			{@const side = stem === 'niet' ? undefined : stem}
			<!-- A seat no fractie holds: an empty outline in the quiet ink. -->
			{@const kleur = !s.faction
				? 'var(--ink-3)'
				: colorOf
					? colorOf(s.faction, i)
					: s.faction.color}
			{@const vulling =
				s.faction && patroonVan(naamVan(s.faction)) !== 'vol'
					? `url(#${patroonId(uid, naamVan(s.faction))})`
					: kleur}
			<!-- A seat as the Kamer draws it: a small block along its row, not a dot. -->
			<rect
				aria-hidden="true"
				x={-SEAT_W / 2}
				y={-SEAT_D / 2}
				width={SEAT_W}
				height={SEAT_D}
				rx="2"
				transform="translate({s.x} {s.y}) rotate({(s.angle * 180) / Math.PI + 90})"
				fill={side === 'tegen' || s.leeg ? undefined : vulling}
				style:stroke={side === 'tegen' || s.leeg ? kleur : undefined}
				class="seat"
				class:seat--leeg={s.leeg}
				class:seat--dim={hovered !== null && hovered.id !== s.faction?.id}
				class:seat--hi={hovered !== null && hovered.id === s.faction?.id}
				class:seat--vote-tegen={side === 'tegen'}
				class:seat--vote-other={stem === 'niet'}
			/>
		{/each}
		<!-- What the middle says, the sector's link says already: not read twice. -->
		<g aria-hidden="true">
			{#if hovered}
				<text
					x={CX}
					y={MID - 6}
					text-anchor="middle"
					class="center-num center-num--party"
					style:fill={hovered.color}
				>
					{naamVan(hovered)}
				</text>
				<text x={CX} y={MID + 10} text-anchor="middle" class="center-lbl">
					{hovered.seats}
					{hovered.seats === 1 ? 'zetel' : 'zetels'}
				</text>
			{:else if voteTotals && telling}
				<text x={CX} y={MID - 6} text-anchor="middle" class="center-num">
					{voteTotals.voor}
				</text>
				<text x={CX} y={MID + 10} text-anchor="middle" class="center-lbl">
					{woorden[0]}, {voteTotals.tegen}
					{woorden[1]}
				</text>
			{:else if !meubels}
				<text x={CX} y={MID - 6} text-anchor="middle" class="center-num">
					{data.assigned_seats}
				</text>
				<text x={CX} y={MID + 8} text-anchor="middle" class="center-lbl">zetels</text>
			{/if}
		</g>
		{#if meubels}
			<!-- The front as on the Kamer's plan: 1 Voorzitter, 2 Griffier, 3 Kabinet (vak-K),
			     4 Medewerkers Verslag en Redactie, 5 Spreekgestoelte, 6 Interruptiemicrofoons,
			     7 Bodedienst. Quiet: the seats are what the picture is about. -->
			<g aria-hidden="true">
				<g class="meubel">
					<line x1={CX - 14} y1="20" x2={CX - 104} y2="62" />
					<line x1={CX + 14} y1="20" x2={CX + 104} y2="62" />
					<line x1={CX - 172} y1="50" x2={CX - 156} y2="62" />
					<line x1={CX + 156} y1="50" x2={CX + 172} y2="62" />
					<polyline points="{CX - 40},{CY + 4} {CX},{CY + 16} {CX + 40},{CY + 4}" />
				</g>
				{#each [[CX - 50, 32, '1'], [CX - 80, 52, '2'], [CX + 62, 46, '3'], [CX + 164, 40, '4'], [CX, 9, '5'], [CX + 54, CY + 6, '6'], [CX - 164, 40, '7']] as [x, yy, n] (n)}
					<text {x} y={Number(yy) + 3} text-anchor="middle" class="nr-t">{n}</text>
				{/each}
			</g>
		{/if}
	</svg>

	{#if !meubels}
		<figcaption class="hemicycle-caption">
			<!-- The count stands in the middle; only seats not yet assigned are worth a word. -->
			{kamer}, {data.chamber === 'EK' ? 'samenstelling' : 'stand'} op {langeDatum(
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
	{/if}
</figure>

<style>
	/* The front quiet: the seats are what the picture is about (Thijs, 10 Oct). */
	.meubel line,
	.meubel polyline {
		fill: none;
		stroke: var(--rule);
		stroke-opacity: 0.7;
		stroke-width: 7;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.meubel polyline {
		stroke-width: 4;
	}
	/* The Kamer's number of a place, without a disc: the key under the hall names it. */
	.nr-t {
		font: 600 var(--t-glyph) var(--font-serif);
		fill: var(--ink-3);
	}
	/* Zonder kader en vlak, zoals de zaal van de Eerste Kamer. */
	.hemicycle.kaal {
		padding: 0;
		border: 0;
		background: transparent;
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
		gap: var(--s-2);
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
	/* A vacant seat: its fractie's outline, empty. */
	.seat--leeg {
		fill: var(--paper-2);
		stroke-width: 1;
		stroke-dasharray: 2 1.5;
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
		fill: var(--paper-2);
		stroke: var(--ink);
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
		font-weight: 600;
	}
	.center-lbl {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		fill: var(--ink-3);
	}
	.hemicycle-caption {
		margin: 0;
		padding-top: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
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
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
</style>

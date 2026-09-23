<script lang="ts">
	import type { Schema } from '$lib/api/types';

	type Seats = Schema<'ParliamentSeatsResponse'>;
	type SeatFaction = Seats['factions'][number];

	let {
		data,
		onSelect,
		voteHighlight = null
	}: {
		data: Seats;
		onSelect?: (key: string) => void;
		/** Faction key → side on one stemming. Set to light up the seats by vote instead
		 * of by party; a faction with no entry did not take part. */
		voteHighlight?: Record<string, 'voor' | 'tegen' | 'other'> | null;
	} = $props();

	const voteTotals = $derived.by(() => {
		if (!voteHighlight) return null;
		let voor = 0;
		let tegen = 0;
		for (const f of data.factions) {
			if (voteHighlight[f.key] === 'voor') voor += f.seats;
			else if (voteHighlight[f.key] === 'tegen') tegen += f.seats;
		}
		return { voor, tegen };
	});

	// Fixed row capacities, sum = 150. Radii scale linearly inner→outer.
	const ROW_CAPS = [14, 17, 19, 21, 24, 26, 29];
	const VIEW_W = 440;
	const VIEW_H = 230;
	const CX = VIEW_W / 2;
	const CY = 210;
	const R_INNER = 90;
	const R_OUTER = 200;
	// SEAT_R 7 (was 6): aangrenzende stoelen raken elkaar net, zodat een
	// fractie als een aaneengesloten band leest in plaats van losse puntjes.
	const SEAT_R = 7;
	// Hitbox per fractie: een transparante taartpunt die elke stoel van een
	// fractie omvat plus een marge. Daardoor is "rond de fractie hoveren"
	// genoeg — de individuele stoel hoeft niet exact geraakt te worden.
	const HIT_ANGLE_PAD = 0.045; // rad ≈ 2.6°
	const HIT_R_PAD = 14;

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
		for (const f of data.factions) {
			for (let k = 0; k < f.seats && idx < raw.length; k++, idx++) {
				out.push({ ...raw[idx], faction: f });
			}
		}
		return out;
	});

	// Eén taartpunt per fractie: omsluit alle stoelen van die fractie en
	// werkt als gemeenschappelijke hitbox voor hover/click/focus.
	type Sector = { faction: SeatFaction; path: string };
	const sectors = $derived.by<Sector[]>(() => {
		const byKey = new Map<string, Seat[]>();
		for (const s of seats) {
			const k = s.faction.key;
			if (!byKey.has(k)) byKey.set(k, []);
			byKey.get(k)!.push(s);
		}
		const out: Sector[] = [];
		const rIn = Math.max(0, R_INNER - HIT_R_PAD);
		const rOut = R_OUTER + HIT_R_PAD;
		const polar = (a: number, r: number): [number, number] => [
			CX + r * Math.cos(a),
			CY - r * Math.sin(a)
		];
		for (const f of data.factions) {
			const key = f.key;
			const seatsF = byKey.get(key);
			if (!seatsF || seatsF.length === 0) continue;
			const angles = seatsF.map((s) => s.angle);
			// Minimumhalfbreedte voor mini-fracties (1–2 zetels): zonder deze
			// ondergrens valt de hover-wig terug op enkel HIT_ANGLE_PAD, wat in
			// de mini-Hemicycle nauwelijks aanklikbaar is.
			const MIN_HALF = 0.06; // rad ≈ 3.4°
			const seatRange = (Math.max(...angles) - Math.min(...angles)) / 2;
			const halfPad = Math.max(HIT_ANGLE_PAD, MIN_HALF - seatRange);
			const center = (Math.max(...angles) + Math.min(...angles)) / 2;
			const aMin = center - seatRange - halfPad;
			const aMax = center + seatRange + halfPad;
			const [x1, y1] = polar(aMax, rIn); // inner-left
			const [x2, y2] = polar(aMax, rOut); // outer-left
			const [x3, y3] = polar(aMin, rOut); // outer-right
			const [x4, y4] = polar(aMin, rIn); // inner-right
			// Outer arc aMax → aMin: hoek neemt af in math-conventie, in
			// scherm-y-geïnverteerde SVG-coords is dat met de klok mee → sweep=1.
			// Inner arc aMin → aMax: tegen de klok in → sweep=0.
			const path = [
				`M ${x1} ${y1}`,
				`L ${x2} ${y2}`,
				`A ${rOut} ${rOut} 0 0 1 ${x3} ${y3}`,
				`L ${x4} ${y4}`,
				`A ${rIn} ${rIn} 0 0 0 ${x1} ${y1}`,
				'Z'
			].join(' ');
			out.push({ faction: f, path });
		}
		// Render largest fracties first, smallest last. Door HIT_ANGLE_PAD
		// overlappen aangrenzende sectoren met ~5°; zonder deze sortering zou
		// een grote fractie de hover-zone van een eenmans-fractie ernaast
		// kunnen overschrijven. Klein bovenop = klein blijft selecteerbaar.
		out.sort((a, b) => b.faction.seats - a.faction.seats);
		return out;
	});

	let hovered = $state<SeatFaction | null>(null);

	function handleClick(f: SeatFaction) {
		onSelect?.(f.key);
	}
	function handleKey(e: KeyboardEvent, f: SeatFaction) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onSelect?.(f.key);
		}
	}
</script>

<figure class="hemicycle" aria-label="Zetelverdeling Tweede Kamer">
	<svg viewBox="0 0 {VIEW_W} {VIEW_H}" aria-hidden="true">
		<!-- Sectoren eerst (onder de stoelen) zodat ze de pointer-events
         opvangen zonder over de stoelen te tekenen. -->
		{#each sectors as sec (sec.faction.id)}
			<path
				d={sec.path}
				class="sector"
				role="button"
				tabindex="0"
				aria-label={`${sec.faction.abbreviation ?? sec.faction.key}, ${sec.faction.name ?? ''}, ${sec.faction.seats} zetels`}
				onmouseenter={() => (hovered = sec.faction)}
				onmouseleave={() => (hovered = null)}
				onfocus={() => (hovered = sec.faction)}
				onblur={() => (hovered = null)}
				onclick={() => handleClick(sec.faction)}
				onkeydown={(e) => handleKey(e, sec.faction)}
			/>
		{/each}
		{#each seats as s (s.faction.id + ':' + s.x + ':' + s.y)}
			{@const side = voteHighlight?.[s.faction.key]}
			<circle
				cx={s.x}
				cy={s.y}
				r={SEAT_R}
				fill={voteHighlight ? undefined : s.faction.color}
				class="seat"
				class:seat--dim={hovered !== null && hovered.id !== s.faction.id}
				class:seat--hi={hovered?.id === s.faction.id}
				class:seat--vote-voor={side === 'voor'}
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
				{hovered.seats} zetels
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
	</svg>

	<!-- Tekstfallback voor schermlezers: de SVG zelf is aria-hidden zodat
       de seat-circles geen ruis maken; deze lijst geeft het volledige
       overzicht in stemvolgorde. -->
	<ul class="hemicycle-sr-list">
		{#each data.factions as f (f.id)}
			<li>{f.abbreviation ?? f.key}, {f.name ?? ''}, {f.seats} zetels</li>
		{/each}
	</ul>
	<figcaption class="hemicycle-caption">
		Tweede Kamer · {data.assigned_seats} van {data.total_seats} zetels · per {data.as_of}
	</figcaption>
</figure>

<style>
	.hemicycle {
		/* `flex: 1` only has effect inside a flex parent; elsewhere the figure is a block. */
		flex: 1;
		margin: 0;
		padding: 16px 16px 12px;
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
	/* Voor/tegen are told apart by fill, not by a second colour: solid ink is voor,
	   a hollow ring is tegen, a faint dot is a faction that did not vote. */
	.seat--vote-voor {
		fill: var(--ink);
	}
	.seat--vote-tegen {
		fill: var(--paper);
		stroke: var(--ink-3);
		stroke-width: 1.5;
	}
	.seat--vote-other {
		fill: var(--rule-strong);
	}
	/* Sector hitbox: a transparent wedge around a whole faction. */
	.sector {
		fill: transparent;
		cursor: pointer;
		outline: none;
	}
	.sector:focus-visible {
		fill: var(--accent-soft);
		stroke: var(--accent);
		stroke-width: 0.8;
		stroke-dasharray: 3 2;
	}
	.center-num {
		font-family: var(--font-serif);
		font-size: 32px;
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
		padding-top: 4px;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
		text-align: center;
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

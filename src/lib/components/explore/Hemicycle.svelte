<script lang="ts">
	import type { Schema } from '$lib/api/types';

	type Seats = Schema<'ParliamentSeatsResponse'>;
	type SeatFaction = Seats['factions'][number];

	let {
		data,
		onSelect
	}: {
		data: Seats;
		onSelect?: (key: string) => void;
	} = $props();

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
			<circle
				cx={s.x}
				cy={s.y}
				r={SEAT_R}
				fill={s.faction.color}
				class="seat"
				class:seat--dim={hovered !== null && hovered.id !== s.faction.id}
				class:seat--hi={hovered?.id === s.faction.id}
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
		{:else}
			<text x={CX} y={CY - 6} text-anchor="middle" class="center-num">
				{data.assigned_seats}
			</text>
			<text x={CX} y={CY + 8} text-anchor="middle" class="center-lbl">zetels</text>
		{/if}
	</svg>

	<figcaption class="hemicycle-caption">
		Tweede Kamer · {data.assigned_seats} van {data.total_seats} zetels · per {data.as_of}
	</figcaption>

	<!-- Tekstfallback voor schermlezers: de SVG zelf is aria-hidden zodat
       de seat-circles geen ruis maken; deze lijst geeft het volledige
       overzicht in stemvolgorde. -->
	<ul class="hemicycle-sr-list">
		{#each data.factions as f (f.id)}
			<li>{f.abbreviation ?? f.key}, {f.name ?? ''}, {f.seats} zetels</li>
		{/each}
	</ul>
</figure>

<style>
	.hemicycle {
		/* `flex: 1` heeft alleen effect als de Hemicycle in een flex-parent
       staat (zoals VerkenNetwerk's panel-visual); in andere contexten
       gedraagt hij zich als een normaal blok. */
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
	/* Zichtbare stoel: puur decoratief, geen pointer-events (die zitten op
     de sector eronder). Geen contour — de fractie-kleur leest tegen het
     paper-2 background contrasterend genoeg, en bij r=7 vormen de
     stoelen visueel groepen. Op hover dimmen de andere fracties zodat
     focus duidelijk blijft zonder extra stroke. */
	.seat {
		pointer-events: none;
		stroke: none;
		transition: opacity 120ms;
	}
	.seat--dim {
		opacity: 0.22;
	}
	.seat--hi {
		stroke: none;
	}
	/* Sectorhitbox: transparante taartpunt rond een hele fractie. */
	.sector {
		fill: transparent;
		cursor: pointer;
		outline: none;
	}
	.sector:focus-visible {
		fill: rgba(122, 31, 26, 0.06);
		stroke: var(--accent, #7a1f1a);
		stroke-width: 0.8;
		stroke-dasharray: 3 2;
	}
	.center-num {
		font-family: var(--font-serif, 'EB Garamond', serif);
		font-size: 32px;
		fill: var(--ink, #1a1814);
	}
	/* Bij hover toont de center-tekst de afkorting van de fractie. Iets
     compacter dan het standaard zetels-getal, en in de kleur van de
     fractie via de inline style. */
	.center-num--party {
		font-size: 20px;
		font-weight: 500;
	}
	.center-lbl {
		font-family: var(--font-sans, system-ui);
		font-size: 11px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		fill: var(--fg-3, #6b6558);
	}
	.hemicycle-caption {
		margin: 0;
		padding-top: 4px;
		font-family: var(--font-sans, system-ui);
		font-size: 12px;
		color: var(--fg-3, #6b6558);
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

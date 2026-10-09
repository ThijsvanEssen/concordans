<script lang="ts">
	// De vergaderzaal van de Eerste Kamer. Twee blokken
	// banken tegenover elkaar, elk vier plaatsen breed en tien rijen diep; de regering aan de
	// kop, de Voorzitter aan het andere eind. Wie waar zit geeft de API in `hall` (0.73, BE-4),
	// gelezen uit "Wie zit waar" op eerstekamer.nl.
	import type { Schema } from '$lib/api/types';
	import { bronHref } from '$lib/bron/href';
	import { kleurVan, vullingVan } from './partijkleuren.svelte';
	import FractiePatronen from './FractiePatronen.svelte';

	type Seats = Schema<'ParliamentSeatsResponse'>;

	let {
		data,
		hrefOf = (key: string) => bronHref(`factions/${key}`, { keepMode: false, mode: 'read' }),
		voteHighlight = null
	}: {
		data: Seats;
		hrefOf?: (key: string) => string;
		voteHighlight?: Record<string, 'voor' | 'tegen' | 'other'> | null;
	} = $props();

	// In the units of the Tweede Kamer's hall (Hemicycle): a seat as large, the hall as high
	// (291), so both stand at one scale in the same frame (Thijs, 9 Oct: "dezelfde styling
	// en de hoogte gelijk"). A member faces the aisle: the seat is deep toward it and wide
	// along the bench, which runs from the regering to the Voorzitter.
	const S_X = 11.2; // diepte naar het middenpad (SEAT_D)
	const S_Y = 12.25; // breedte langs de bank (SEAT_W)
	const COL = 16; // plaats per kolom
	const ROW = 17; // rij
	const PAIR = 7; // gang na elke twee rijen
	const AISLE = 110; // middenpad
	const TOP = 50;
	const blockW = 3 * COL + S_X;
	const W = 2 * blockW + AISLE;
	const rowY = (r: number) => TOP + r * ROW + Math.floor(r / 2) * PAIR;
	const H = 291;

	const byName = $derived(
		new Map(data.factions.map((f) => [f.abbreviation ?? f.name ?? f.key, f]))
	);
	// Een fractie zonder kleur in de gegevens krijgt een grijstint, en haar naam in de legenda.
	const GREYS = ['#b7b1a5', '#a39d90', '#8f897c', '#cbc5b9', '#7d776b', '#d8d3c8'];
	const fillOf = $derived.by(() => {
		const m = new Map<string, string>();
		let g = 0;
		for (const f of data.factions) {
			const name = f.abbreviation ?? f.name ?? f.key;
			m.set(name, f.color ?? GREYS[g++ % GREYS.length]);
		}
		return m;
	});

	type Stoel = { x: number; y: number; name: string };
	// Rij 0 bij de regering, kolom 0 aan de buitenkant; de Voorzitter aan het andere eind.
	const stoelen = $derived.by<Stoel[]>(() =>
		(data.hall?.seats ?? []).map((s) => {
			const name = s.abbreviation ?? s.faction;
			if (s.block === 'chair') return { x: W / 2 - S_X / 2, y: rowY(9), name };
			const x = s.block === 'left' ? s.column * COL : blockW + AISLE + s.column * COL;
			return { x, y: rowY(s.row), name };
		})
	);

	// As in the hemicycle of the Tweede Kamer: a fractie under the pointer stands out, the
	// others dim, and the aisle says its name and seats.
	let hovered = $state<string | null>(null);
	const uid = $props.id();
	const seatsOf = (name: string) =>
		byName.get(name)?.seats ?? stoelen.filter((s) => s.name === name).length;

	/** The seats per fractie, each with its place in the hall (for its colour). */
	const fractieStoelen = $derived.by(() => {
		const m = new Map<string, { s: Stoel; i: number }[]>();
		stoelen.forEach((s, i) => m.set(s.name, [...(m.get(s.name) ?? []), { s, i }]));
		return [...m];
	});

	const side = (name: string) => {
		const f = byName.get(name);
		return voteHighlight && f ? voteHighlight[f.key] : null;
	};
</script>

<figure class="zaal">
	<svg viewBox="0 0 {W} {H}" role="group" aria-label="Plattegrond van de Eerste Kamer, 75 zetels">
		<FractiePatronen prefix={uid} namen={fractieStoelen.map(([naam]) => naam)} />
		<!-- The front as in the Tweede Kamer's hall: quiet benches, the numbers of the legend.
		     3 Regering at the head, 4 Verslag en redactie at the table in the middle. -->
		<g aria-hidden="true">
			<line x1={W / 2 - 44} y1="24" x2={W / 2 + 44} y2="24" class="bank" />
			<rect x={W / 2 - 9} y={rowY(4)} width="18" height={2 * ROW} rx="4" class="tafel" />
			<text x={W / 2} y="14" text-anchor="middle" class="nr-t">3</text>
			<text x={W / 2} y={rowY(4) + ROW + 3} text-anchor="middle" class="nr-t">4</text>
		</g>
		<!-- One link per fractie, as the sectors of the hemicycle: its seats and the cells
		     around them are one target, so the pointer need not land on a seat itself. -->
		{#each fractieStoelen as [name, eigen] (name)}
			{@const f = byName.get(name)}
			{@const v = side(name)}
			<a
				href={f ? hrefOf(f.key) : undefined}
				aria-label="{name}, {seatsOf(name)} {seatsOf(name) === 1 ? 'zetel' : 'zetels'}"
				onmouseenter={() => (hovered = name)}
				onmouseleave={() => (hovered = null)}
				onfocus={() => (hovered = name)}
				onblur={() => (hovered = null)}
			>
				{#each eigen as { s } (s.x + ':' + s.y)}
					<rect
						class="cel"
						x={s.x - (COL - S_X) / 2}
						y={s.y - (ROW - S_Y) / 2 - PAIR / 2}
						width={COL}
						height={ROW + PAIR}
					/>
				{/each}
				{#each eigen as { s, i } (s.x + ':' + s.y)}
					<rect
						x={s.x}
						y={s.y}
						width={S_X}
						height={S_Y}
						rx="2"
						class="stoel"
						class:tegen={v === 'tegen'}
						class:overig={v === 'other'}
						class:dim={hovered !== null && hovered !== name}
						fill={v === 'tegen' ? undefined : vullingVan(uid, name, i, fillOf.get(name) ?? null)}
						style:stroke={v === 'tegen'
							? kleurVan('EK', name, i, fillOf.get(name) ?? null)
							: undefined}><title>{name}{s === stoelen.at(-1) ? ' (Voorzitter)' : ''}</title></rect
					>
				{/each}
			</a>
		{/each}
		{#if hovered}
			<!-- In the aisle, between the blocks: the fractie and its seats. -->
			<text
				x={W / 2}
				y={rowY(1) + 6}
				text-anchor="middle"
				class="hover-naam"
				aria-hidden="true"
				class:lang={hovered.replace(/^Fractie-/, '').length > 8}
				style:fill={kleurVan('EK', hovered, 0, fillOf.get(hovered) ?? null)}
				>{hovered.replace(/^Fractie-/, '')}</text
			>
			<text x={W / 2} y={rowY(1) + 22} text-anchor="middle" class="hover-zetels" aria-hidden="true"
				>{seatsOf(hovered)} {seatsOf(hovered) === 1 ? 'zetel' : 'zetels'}</text
			>
		{/if}
		<!-- At the foot: the Voorzitter (a member, in the fractie's colour) between two places
		     of the griffie, and their numbers under them. -->
		<g aria-hidden="true">
			<rect
				x={W / 2 - S_X / 2 - 8 - S_X}
				y={rowY(9)}
				width={S_X}
				height={S_Y}
				rx="2"
				class="tafel"
			/>
			<rect x={W / 2 + S_X / 2 + 8} y={rowY(9)} width={S_X} height={S_Y} rx="2" class="tafel" />
			<text x={W / 2} y={rowY(9) + S_Y + 17} text-anchor="middle" class="nr-t">1</text>
			<text x={W / 2 - S_X - 8} y={rowY(9) + S_Y + 17} text-anchor="middle" class="nr-t">2</text>
		</g>
	</svg>
</figure>

<style>
	.zaal {
		margin: 0;
		display: grid;
		gap: var(--s-3);
		justify-items: center;
	}
	/* As high as the hall of the Tweede Kamer (Hemicycle); IndexView sets both to 300px. */
	svg {
		width: auto;
		max-width: 100%;
		height: 320px;
	}
	/* The furniture as in the Tweede Kamer's hall: in the rule's tone, without contour. */
	.bank {
		stroke: var(--rule);
		stroke-width: 9;
		stroke-linecap: round;
	}
	.tafel {
		fill: var(--rule);
	}
	/* The Kamer's number of a place, without a disc, as in the Tweede Kamer's hall. */
	.nr-t {
		font: 600 var(--t-glyph) var(--font-serif);
		fill: var(--ink-3);
	}
	/* As in the hall of the Tweede Kamer: the first side (voor, coalitie) a seat in its
	   fractie's colour, the second (tegen, oppositie) open, a contour in that colour. */
	rect.tegen {
		fill: var(--paper);
		stroke-width: 2;
	}
	.stoel {
		pointer-events: none;
		transition: opacity var(--dur-1) var(--ease);
	}
	/* The target of a fractie: transparent, the size of a place with its share of the aisle. */
	.cel {
		fill: transparent;
	}
	rect.dim {
		opacity: 0.22;
	}
	/* A fractie with neither side (no vote, no cabinet): faded, as in the other hall. */
	rect.overig {
		opacity: 0.18;
	}
	.hover-naam {
		font: 600 var(--t-h3) var(--font-serif);
	}
	/* A long name (a one-member fractie) in a smaller size, to stay inside the aisle. */
	.hover-naam.lang {
		font-size: var(--t-micro);
	}
	.hover-zetels {
		font: var(--t-micro) var(--font-serif);
		fill: var(--ink-3);
	}
	a:focus-visible .stoel {
		stroke: var(--ink);
		stroke-width: 2;
	}
</style>

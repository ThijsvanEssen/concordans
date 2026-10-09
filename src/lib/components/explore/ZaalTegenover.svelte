<script lang="ts">
	// De vergaderzaal van de Eerste Kamer. Twee blokken
	// banken tegenover elkaar, elk vier plaatsen breed en tien rijen diep; de regering aan de
	// kop, de Voorzitter aan het andere eind. Wie waar zit geeft de API in `hall` (0.73, BE-4),
	// gelezen uit "Wie zit waar" op eerstekamer.nl.
	import type { Schema } from '$lib/api/types';
	import { bronHref } from '$lib/bron/href';
	import { kleurVan } from './partijkleuren.svelte';

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

	const S = 22; // stoel
	const COL = 28; // plaats per kolom
	const ROW = 26; // rij
	const PAIR = 10; // gang na elke twee rijen
	const AISLE = 120; // middenpad
	const TOP = 44;
	const blockW = 3 * COL + S;
	const W = 2 * blockW + AISLE;
	const rowY = (r: number) => TOP + r * ROW + Math.floor(r / 2) * PAIR;
	const H = rowY(9) + S + 56;

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
			if (s.block === 'chair') return { x: W / 2 - S / 2, y: rowY(9), name };
			const x = s.block === 'left' ? s.column * COL : blockW + AISLE + s.column * COL;
			return { x, y: rowY(s.row), name };
		})
	);

	// As in the hemicycle of the Tweede Kamer: a fractie under the pointer stands out, the
	// others dim, and the aisle says its name and seats.
	let hovered = $state<string | null>(null);
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
		<path
			d="M{W / 2 - 46} 8 H{W / 2 + 46} L{W / 2 + 40} 26 H{W / 2 - 40} Z"
			class="meubel"
			aria-hidden="true"
		/>
		<circle cx={W / 2} cy="17" r="7" class="nr" aria-hidden="true" /><text
			x={W / 2}
			y="20"
			text-anchor="middle"
			class="nr-t"
			aria-hidden="true">3</text
		>
		<rect
			x={W / 2 - 22}
			y={rowY(4)}
			width="44"
			height={2 * ROW - 4}
			rx="2"
			class="meubel"
			aria-hidden="true"
		/>
		<circle cx={W / 2} cy={rowY(4) + ROW - 2} r="7" class="nr" aria-hidden="true" /><text
			x={W / 2}
			y={rowY(4) + ROW + 1}
			text-anchor="middle"
			class="nr-t"
			aria-hidden="true">4</text
		>
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
						x={s.x - (COL - S) / 2}
						y={s.y - (ROW - S) / 2 - PAIR / 2}
						width={COL}
						height={ROW + PAIR}
					/>
				{/each}
				{#each eigen as { s, i } (s.x + ':' + s.y)}
					<rect
						x={s.x}
						y={s.y}
						width={S}
						height={S}
						rx="3"
						class="stoel"
						class:tegen={v === 'tegen'}
						class:dim={hovered !== null && hovered !== name}
						fill={v === 'tegen' ? undefined : kleurVan('EK', name, i, fillOf.get(name) ?? null)}
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
		<rect
			x={W / 2 - S / 2 - 10 - S}
			y={rowY(9)}
			width={S}
			height={S}
			rx="3"
			class="meubel"
			aria-hidden="true"
		/>
		<rect
			x={W / 2 + S / 2 + 10}
			y={rowY(9)}
			width={S}
			height={S}
			rx="3"
			class="meubel"
			aria-hidden="true"
		/>
		<circle cx={W / 2} cy={rowY(9) + S + 14} r="7" class="nr" aria-hidden="true" /><text
			x={W / 2}
			y={rowY(9) + S + 17}
			text-anchor="middle"
			class="nr-t"
			aria-hidden="true">1</text
		>
		<circle cx={W / 2 - S - 10} cy={rowY(9) + S + 14} r="7" class="nr" aria-hidden="true" /><text
			x={W / 2 - S - 10}
			y={rowY(9) + S + 17}
			text-anchor="middle"
			class="nr-t"
			aria-hidden="true">2</text
		>
	</svg>
</figure>

<style>
	.zaal {
		margin: 0;
		display: grid;
		gap: var(--s-3);
		justify-items: center;
	}
	/* Even hoog als het halfrond van de Tweede Kamer (Hemicycle, max 320). */
	svg {
		width: auto;
		max-width: 100%;
		height: 320px;
	}
	.meubel {
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
	.hover-naam {
		font: 500 var(--t-h3) var(--font-serif);
	}
	/* A long name (a one-member fractie) in a smaller size, to stay inside the aisle. */
	.hover-naam.lang {
		font-size: var(--t-micro);
	}
	.hover-zetels {
		font: var(--t-micro) var(--font-sans);
		fill: var(--ink-3);
	}
	a:focus-visible .stoel {
		stroke: var(--ink);
		stroke-width: 2;
	}
</style>

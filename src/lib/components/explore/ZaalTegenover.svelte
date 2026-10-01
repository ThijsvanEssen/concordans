<script lang="ts">
	// De vergaderzaal van de Eerste Kamer. Twee blokken
	// banken tegenover elkaar, elk vier plaatsen breed en tien rijen diep; de regering aan de
	// kop, de Voorzitter aan het andere eind. De plaats per fractie komt hier uit een vaste
	// tabel naar "Wie zit waar" op eerstekamer.nl (30 september 2026), tot de API haar geeft
	// in seating_plan (BE-4).
	import type { Schema } from '$lib/api/types';
	import { bronHref } from '$lib/bron/href';
	import { kleurVan } from './partijkleuren';

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

	// Per rij, van de regering naar de Voorzitter; een lege plaats is ''.
	const LEFT = [
		'SP,SP,SP,',
		'VVD,PvdD,PvdD,',
		'VVD,VVD,VVD,VVD',
		'VVD,VVD,VVD,VVD',
		'PVV,PVV,PVV,PVV',
		'BBB,BBB,JA21,JA21',
		'BBB,BBB,BBB,BBB',
		'BBB,BBB,BBB,BBB',
		'BBB,Fractie-Van de Sanden,Fractie-Visseren-Hamakers,50PLUS',
		'Fractie-Van Gasteren,Fractie-Beukering,Fractie-Walenkamp,OPNL'
	];
	const RIGHT = [
		',FVD,FVD,FVD',
		',D66,D66,D66',
		'D66,D66,D66,D66',
		'SGP,SGP,CDA,CDA',
		'CDA,CDA,CDA,CDA',
		'ChristenUnie,ChristenUnie,ChristenUnie,PRO',
		'PRO,PRO,PRO,PRO',
		'PRO,PRO,PRO,PRO',
		',Volt,Volt,PRO',
		',PRO,PRO,PRO'
	];
	const CHAIR = 'PRO';

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
	const stoelen = $derived.by<Stoel[]>(() => {
		const out: Stoel[] = [];
		LEFT.forEach((row, r) =>
			row.split(',').forEach((name, c) => {
				if (name) out.push({ x: c * COL, y: rowY(r), name });
			})
		);
		RIGHT.forEach((row, r) =>
			row.split(',').forEach((name, c) => {
				if (name) out.push({ x: blockW + AISLE + c * COL, y: rowY(r), name });
			})
		);
		out.push({ x: W / 2 - S / 2, y: rowY(9), name: CHAIR });
		return out;
	});

	// As in the hemicycle of the Tweede Kamer: a fractie under the pointer stands out, the
	// others dim, and the aisle says its name and seats.
	let hovered = $state<string | null>(null);
	const seatsOf = (name: string) =>
		byName.get(name)?.seats ?? stoelen.filter((s) => s.name === name).length;

	const side = (name: string) => {
		const f = byName.get(name);
		return voteHighlight && f ? voteHighlight[f.key] : null;
	};
</script>

<figure class="zaal">
	<svg viewBox="0 0 {W} {H}" role="img" aria-label="Plattegrond van de Eerste Kamer, 75 zetels">
		<path d="M{W / 2 - 46} 8 H{W / 2 + 46} L{W / 2 + 40} 26 H{W / 2 - 40} Z" class="meubel" />
		<circle cx={W / 2} cy="17" r="7" class="nr" /><text
			x={W / 2}
			y="20"
			text-anchor="middle"
			class="nr-t">3</text
		>
		<rect x={W / 2 - 22} y={rowY(4)} width="44" height={2 * ROW - 4} rx="2" class="meubel" />
		<circle cx={W / 2} cy={rowY(4) + ROW - 2} r="7" class="nr" /><text
			x={W / 2}
			y={rowY(4) + ROW + 1}
			text-anchor="middle"
			class="nr-t">4</text
		>
		{#each stoelen as s, i (i)}
			{@const f = byName.get(s.name)}
			{@const v = side(s.name)}
			<a
				href={f ? hrefOf(f.key) : undefined}
				aria-label="{s.name}, {seatsOf(s.name)} {seatsOf(s.name) === 1 ? 'zetel' : 'zetels'}{s ===
				stoelen.at(-1)
					? ', Voorzitter'
					: ''}"
				onmouseenter={() => (hovered = s.name)}
				onmouseleave={() => (hovered = null)}
				onfocus={() => (hovered = s.name)}
				onblur={() => (hovered = null)}
			>
				<rect
					x={s.x}
					y={s.y}
					width={S}
					height={S}
					rx="3"
					class:tegen={v === 'tegen'}
					class:voor={v === 'voor'}
					class:dim={hovered !== null && hovered !== s.name}
					fill={voteHighlight ? undefined : kleurVan('EK', s.name, i, fillOf.get(s.name) ?? null)}
					><title>{s.name}{s === stoelen.at(-1) ? ' (Voorzitter)' : ''}</title></rect
				>
			</a>
		{/each}
		{#if hovered}
			<!-- In the aisle, between the blocks: the fractie and its seats. -->
			<text
				x={W / 2}
				y={rowY(1) + 6}
				text-anchor="middle"
				class="hover-naam"
				class:lang={hovered.replace(/^Fractie-/, '').length > 8}
				style:fill={kleurVan('EK', hovered, 0, fillOf.get(hovered) ?? null)}
				aria-live="polite">{hovered.replace(/^Fractie-/, '')}</text
			>
			<text x={W / 2} y={rowY(1) + 22} text-anchor="middle" class="hover-zetels"
				>{seatsOf(hovered)} {seatsOf(hovered) === 1 ? 'zetel' : 'zetels'}</text
			>
		{/if}
		<rect x={W / 2 - S / 2 - 10 - S} y={rowY(9)} width={S} height={S} rx="3" class="meubel" />
		<rect x={W / 2 + S / 2 + 10} y={rowY(9)} width={S} height={S} rx="3" class="meubel" />
		<circle cx={W / 2} cy={rowY(9) + S + 14} r="7" class="nr" /><text
			x={W / 2}
			y={rowY(9) + S + 17}
			text-anchor="middle"
			class="nr-t">1</text
		>
		<circle cx={W / 2 - S - 10} cy={rowY(9) + S + 14} r="7" class="nr" /><text
			x={W / 2 - S - 10}
			y={rowY(9) + S + 17}
			text-anchor="middle"
			class="nr-t">2</text
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
	rect.voor {
		fill: var(--ink-2);
	}
	rect.tegen {
		fill: var(--paper);
		stroke: var(--accent);
		stroke-width: 2;
	}
	rect {
		transition: opacity var(--dur-1) var(--ease);
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
	a:focus-visible rect {
		stroke: var(--ink);
		stroke-width: 2;
	}
</style>

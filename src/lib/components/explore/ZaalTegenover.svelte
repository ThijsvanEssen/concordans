<script lang="ts">
	// Ontwerpstudie ronde 3 (prototype): de vergaderzaal van de Eerste Kamer. Twee blokken
	// banken tegenover elkaar, elk vier plaatsen breed en tien rijen diep; de regering aan de
	// kop, de Voorzitter aan het andere eind. De plaats per fractie komt hier uit een vaste
	// tabel naar "Wie zit waar" op eerstekamer.nl (30 september 2026), tot de API haar geeft
	// in seating_plan (BE-4). Niet voor main.
	import type { Schema } from '$lib/api/types';
	import { bronHref } from '$lib/bron/href';

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

	const order = (rows: string[]) => {
		const seen: string[] = [];
		for (const row of rows) for (const n of row.split(',')) if (n && !seen.includes(n)) seen.push(n);
		return seen;
	};
	const legendL = order(LEFT);
	const legendR = order(RIGHT);
	const count = (n: string) => stoelen.filter((s) => s.name === n).length;

	const side = (name: string) => {
		const f = byName.get(name);
		return voteHighlight && f ? voteHighlight[f.key] : null;
	};
</script>

<figure class="zaal">
	<svg viewBox="0 0 {W} {H}" role="img" aria-label="Plattegrond van de Eerste Kamer, 75 zetels">
		<path
			d="M{W / 2 - 46} 8 H{W / 2 + 46} L{W / 2 + 40} 26 H{W / 2 - 40} Z"
			class="meubel"
		/>
		<text x={W / 2} y="21" text-anchor="middle" class="lbl">Regering</text>
		{#each stoelen as s, i (i)}
			{@const f = byName.get(s.name)}
			{@const v = side(s.name)}
			<a href={f ? hrefOf(f.key) : undefined} aria-label="{s.name}{s === stoelen.at(-1) ? ', Voorzitter' : ''}">
				<rect
					x={s.x}
					y={s.y}
					width={S}
					height={S}
					rx="3"
					class:tegen={v === 'tegen'}
					class:voor={v === 'voor'}
					fill={voteHighlight ? undefined : fillOf.get(s.name)}
				><title>{s.name}{s === stoelen.at(-1) ? ' (Voorzitter)' : ''}</title></rect>
			</a>
		{/each}
		<text x={W / 2} y={rowY(9) + S + 16} text-anchor="middle" class="lbl">Voorzitter</text>
	</svg>
	<div class="legend">
		<div>
			<span class="side">Links</span>
			{#each legendL as n (n)}<span><i style:background={fillOf.get(n)}></i>{n} {count(n)}</span>{/each}
		</div>
		<div>
			<span class="side">Rechts</span>
			{#each legendR as n (n)}<span><i style:background={fillOf.get(n)}></i>{n} {count(n)}</span>{/each}
		</div>
	</div>
	<figcaption>
		Eerste Kamer, 75 zetels. Plaatsen naar "Wie zit waar" op eerstekamer.nl, 30 september 2026.
	</figcaption>
</figure>

<style>
	.zaal {
		margin: 0;
		display: grid;
		gap: var(--s-3);
		justify-items: center;
	}
	svg {
		width: 100%;
		max-width: 420px;
		height: auto;
	}
	.meubel {
		fill: var(--paper-2);
		stroke: var(--rule-strong);
	}
	.lbl {
		font: 500 var(--t-micro) var(--font-sans);
		fill: var(--ink-2);
	}
	rect.voor {
		fill: var(--ink-2);
	}
	rect.tegen {
		fill: var(--paper);
		stroke: var(--accent);
		stroke-width: 2;
	}
	a:focus-visible rect {
		stroke: var(--ink);
		stroke-width: 2;
	}
	.legend {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-4);
		font: var(--t-micro) var(--font-sans);
		color: var(--ink-2);
		width: 100%;
		max-width: 520px;
	}
	.legend > div {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.side {
		font-weight: 500;
		color: var(--ink);
	}
	.legend i {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 2px;
		margin-right: var(--s-2);
	}
	figcaption {
		font: var(--t-micro) var(--font-sans);
		color: var(--ink-3);
		text-align: center;
	}
</style>

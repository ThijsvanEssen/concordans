<script lang="ts">
	// The Kruiswoord of a topic (concept ux-voorstel/1f): the kinds of event as columns, the
	// months (or weeks) as rows, a year folded under its totals. A cell with a count is a
	// button: chosen, it stands in ink and the list under the grid holds its events. Richting
	// lays a bar of four shapes in the cells of the moties; a cell with an event after the
	// visit before this one has a corner in ink. On a phone the grid pans, its labels stay.
	import { formatCount } from '$lib/text/getal';
	import Caret from '$lib/components/ui/Caret.svelte';
	import { maandNaam, langeDatum } from '$lib/text/datum';
	import {
		jaarVanVak,
		somVan,
		type Aandeel,
		type Keuze,
		type Kolom,
		type Rij,
		type Vak
	} from './kruiswoord';

	export type KolomKop = {
		k: Kolom;
		label: string;
		/** What the column counts, on hover. */
		titel: string;
		/** The heading over two columns: `Stemmingen`, or the fractie. */
		groep?: string;
		/** The outcome's shape before the label: a square in its colour, or open. */
		vorm?: 'ja' | 'nee';
	};

	let {
		kolommen,
		vakken,
		rijen,
		keuze,
		onKies,
		bezig = {},
		ongeteld = {},
		aandeel = null,
		nieuwSinds = null,
		week = false
	}: {
		kolommen: KolomKop[];
		/** Every month or week of the period, the newest first. */
		vakken: Vak[];
		rijen: Map<Vak, Rij>;
		keuze: Keuze | null;
		onKies: (k: Keuze | null) => void;
		/** A column still counting: its empty cells wait instead of reading as none. */
		bezig?: Partial<Record<Kolom, boolean>>;
		/** Per column the last month or week not counted (the feed's pages ran out before). */
		ongeteld?: Partial<Record<Kolom, Vak | null>>;
		/** Richting on: the share of each direction among the moties voted in a month. */
		aandeel?: Map<Vak, Aandeel> | null;
		/** The day of the visit before this one, for the legend of the corner. */
		nieuwSinds?: string | null;
		week?: boolean;
	} = $props();

	const getal = formatCount;
	const jaren = $derived([...new Set(vakken.map(jaarVanVak))]);
	/** The newest year open; the others folded under their totals, until opened. */
	let open = $state<Set<string>>(new Set());
	let gezet = $state(false);
	$effect(() => {
		if (gezet || !jaren.length) return;
		open = new Set([jaren[0]]);
		gezet = true;
	});
	const wissel = (j: string) => {
		const s = new Set(open);
		if (s.has(j)) s.delete(j);
		else s.add(j);
		open = s;
	};

	const totaal = (vs: Vak[], k: Kolom) => vs.reduce((n, v) => n + (rijen.get(v)?.[k].n ?? 0), 0);
	const alle = (vs: Vak[]) => vs.reduce((n, v) => n + somVan(rijen.get(v)), 0);
	/** A column still counting: the totals of the row wait with it instead of reading 0. */
	const telt = $derived(Object.values(bezig).some(Boolean));
	const isOngeteld = (k: Kolom, v: Vak) => {
		const grens = ongeteld[k];
		return !!grens && v <= grens;
	};
	const label = (v: Vak, kort: boolean) =>
		v.includes('-W') ? `week ${Number(v.slice(6))}` : maandNaam(`${v}-01`, kort);
	const gekozen = (k: Kolom, v: Vak) => keuze?.kolom === k && keuze.vak === v;
	const heeftNieuw = $derived([...rijen.values()].some((r) => kolommen.some((c) => r[c.k].nieuw)));
	/** The four shares of a bar, as widths. */
	const delen = (a: Aandeel) => {
		const n = a.positief + a.negatief + a.neutraal + a.geen;
		return n
			? (['positief', 'negatief', 'neutraal', 'geen'] as const)
					.filter((d) => a[d] > 0)
					.map((d) => ({ d, w: (a[d] / n) * 100 }))
			: [];
	};
	const groepen = $derived(
		kolommen.reduce<{ label: string; van: number; n: number }[]>((g, c, i) => {
			if (!c.groep) return g;
			const last = g.at(-1);
			if (last && last.label === c.groep && last.van + last.n === i) last.n++;
			else g.push({ label: c.groep, van: i, n: 1 });
			return g;
		}, [])
	);
	const vakkenVan = (j: string) => vakken.filter((v) => jaarVanVak(v) === j);
</script>

<div class="schuif" data-zijscroll>
	<div
		class="kruiswoord"
		class:richting={!!aandeel}
		style:--n={kolommen.length + 1}
		role="grid"
		aria-label="Verloop per {week ? 'week' : 'maand'}"
	>
		<div class="rij kopregel" role="row">
			{#if groepen.length}
				{#each groepen as g (g.label)}
					<span class="groepkop" style:grid-column="{g.van + 2} / span {g.n}" aria-hidden="true"
						>{g.label}</span
					>
				{/each}
			{/if}
			<span class="k k--per" role="columnheader">{week ? 'Week' : 'Maand'}</span>
			{#each kolommen as c (c.k)}
				<span class="k" role="columnheader" title={c.titel}
					><span class="w"
						>{#if c.vorm}<span class="vorm vorm--{c.vorm}" aria-hidden="true"
							></span>{/if}{c.label}</span
					></span
				>
			{/each}
			<span class="k" role="columnheader" title="Alle gebeurtenissen van de rij"
				><span class="w">Alle</span></span
			>
		</div>

		<div class="rij kern" role="row">
			<span class="per" role="rowheader"
				>{telt && !alle(vakken) ? '…' : getal(alle(vakken))}
				<span class="lang">gebeurtenissen</span></span
			>
			{#each kolommen as c (c.k)}
				<span class="som-groot" role="gridcell"
					>{bezig[c.k] && !totaal(vakken, c.k) ? '…' : getal(totaal(vakken, c.k))}</span
				>
			{/each}
			<span class="som-groot" role="gridcell"
				>{telt && !alle(vakken) ? '…' : getal(alle(vakken))}</span
			>
		</div>

		{#each jaren as j (j)}
			{@const vs = vakkenVan(j)}
			<div class="rij jaar" role="row">
				<span class="per" role="rowheader"
					><button
						type="button"
						class="jaar-knop"
						aria-expanded={open.has(j)}
						onclick={() => wissel(j)}>{j}<Caret open={open.has(j)} side /></button
					></span
				>
				{#if !open.has(j)}
					{#each kolommen as c (c.k)}
						{#if vs.every((v) => isOngeteld(c.k, v))}
							<span class="t" role="gridcell" title="Niet geteld" aria-label="Niet geteld"></span>
						{:else}
							<span class="t" role="gridcell">{getal(totaal(vs, c.k))}</span>
						{/if}
					{/each}
					<span class="t" role="gridcell">{getal(alle(vs))}</span>
				{/if}
			</div>
			{#if open.has(j)}
				{#each vs as v (v)}
					{@const r = rijen.get(v)}
					<div class="rij" role="row">
						<span class="per" role="rowheader"
							><span class="lang">{label(v, false)}</span><span class="kort">{label(v, true)}</span
							></span
						>
						{#each kolommen as c (c.k)}
							{@const cel = r?.[c.k]}
							{#if cel && cel.n > 0}
								{@const a = c.k === 'moties' ? aandeel?.get(v) : undefined}
								<button
									type="button"
									role="gridcell"
									class="cel vol"
									class:nieuw={cel.nieuw}
									class:motie={c.k === 'moties'}
									aria-selected={gekozen(c.k, v)}
									aria-label="{c.label}, {label(v, false)} {jaarVanVak(v)}: {cel.n}{cel.nieuw
										? ', nieuw'
										: ''}"
									title={a
										? `Richting over de ${a.positief + a.negatief + a.neutraal + a.geen} moties waarover in deze ${week ? 'week' : 'maand'} is gestemd`
										: undefined}
									onclick={() => onKies(gekozen(c.k, v) ? null : { kolom: c.k, vak: v })}
									>{cel.n}{#if a}<span class="balk" aria-hidden="true"
											>{#each delen(a) as d (d.d)}<span class="b-{d.d}" style:width="{d.w}%"
												></span>{/each}</span
										>{/if}</button
								>
							{:else if isOngeteld(c.k, v)}
								<span class="cel ongeteld" role="gridcell" title="Niet geteld"></span>
							{:else if bezig[c.k]}
								<span class="cel wacht" role="gridcell" aria-label="Laden">…</span>
							{:else}
								<span class="cel leeg" role="gridcell" aria-label="Geen"></span>
							{/if}
						{/each}
						<span class="cel som" role="gridcell">{getal(somVan(r))}</span>
					</div>
				{/each}
			{/if}
		{/each}
	</div>
</div>
{#if heeftNieuw || aandeel}
	<p class="legenda">
		{#if heeftNieuw && nieuwSinds}<span
				><span class="nieuwteken" aria-hidden="true"></span>nieuw sinds {langeDatum(
					nieuwSinds
				)}</span
			>{/if}
		{#if aandeel}
			<span><span class="sw b-positief"></span>positief</span>
			<span><span class="sw b-negatief"></span>negatief</span>
			<span><span class="sw b-neutraal"></span>neutraal</span>
			<span><span class="sw b-geen"></span>niet gecodeerd</span>
		{/if}
	</p>
{/if}

<style>
	.schuif {
		--label: 150px;
		min-width: 0;
	}
	.rij {
		display: grid;
		grid-template-columns: var(--label) repeat(var(--n), minmax(0, 1fr));
		column-gap: var(--s-1);
		align-items: center;
		margin-top: 3px;
	}
	.rij > * {
		min-width: 0;
	}
	.kopregel {
		margin-top: 0;
		align-items: end;
	}
	.groepkop {
		grid-row: 1;
		margin-bottom: 2px;
		border-bottom: 1px solid var(--rule-strong);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink);
		text-align: center;
	}
	.k {
		grid-row: 2;
		padding: 2px 0 var(--s-1);
		border-bottom: 1px solid var(--rule-strong);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		text-align: center;
	}
	.k--per {
		text-align: left;
	}
	.vorm {
		display: inline-block;
		width: 10px;
		height: 10px;
		margin-right: var(--s-1);
		vertical-align: -1px;
	}
	.vorm--ja {
		background: var(--uitkomst-ja);
	}
	.vorm--nee {
		box-sizing: border-box;
		border: 2px solid var(--uitkomst-nee);
	}
	.kern {
		padding: var(--s-3) 0;
		border-bottom: 1px solid var(--rule-strong);
	}
	.per {
		padding-right: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
		white-space: nowrap;
	}
	.kern .per {
		white-space: normal;
		color: var(--ink-3);
	}
	.som-groot {
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		font-weight: 800;
		line-height: 1.1;
		color: var(--ink);
		text-align: center;
		font-variant-numeric: tabular-nums lining-nums;
	}
	.jaar {
		margin-top: var(--s-3);
	}
	.jaar-knop {
		display: inline-flex;
		align-items: center;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-weight: 600;
		color: var(--ink);
		cursor: pointer;
	}
	.t {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.cel {
		position: relative;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 30px;
		padding: 0;
		border: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
		font-variant-numeric: tabular-nums lining-nums;
	}
	.cel.leeg {
		background: repeating-linear-gradient(135deg, transparent 0 5px, var(--paper-2) 5px 7px);
	}
	.cel.wacht,
	.cel.som {
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.cel.vol {
		background: var(--paper);
		box-shadow: inset 0 0 0 1px var(--rule-strong);
		cursor: pointer;
	}
	.cel.vol:hover,
	.cel.vol:focus-visible {
		box-shadow: inset 0 0 0 1.5px var(--ink);
		outline: none;
	}
	.cel.vol.nieuw::after {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		border-style: solid;
		border-width: 0 9px 9px 0;
		border-color: transparent var(--ink) transparent transparent;
	}
	.cel.vol[aria-selected='true'] {
		background: var(--ink);
		color: var(--paper);
		box-shadow: none;
	}
	.cel.vol[aria-selected='true'].nieuw::after {
		border-color: transparent var(--paper) transparent transparent;
	}
	/* Richting: the moties' cells a little higher, the bar along their foot. */
	.richting .cel.vol.motie {
		height: 36px;
		justify-content: flex-start;
		padding-top: 2px;
	}
	.balk {
		position: absolute;
		left: var(--s-1);
		right: var(--s-1);
		bottom: 3px;
		display: flex;
		gap: 1px;
		height: 5px;
	}
	.balk span,
	.sw {
		display: block;
		height: 100%;
	}
	.b-positief {
		background: var(--ink);
	}
	.b-negatief {
		background: repeating-linear-gradient(90deg, var(--ink) 0 2px, transparent 2px 4px);
	}
	.b-neutraal {
		box-shadow: inset 0 0 0 1px var(--ink);
	}
	.b-geen {
		background: var(--paper-2);
	}
	.cel.vol[aria-selected='true'] .b-positief {
		background: var(--paper);
	}
	.cel.vol[aria-selected='true'] .b-negatief {
		background: repeating-linear-gradient(90deg, var(--paper) 0 2px, transparent 2px 4px);
	}
	.cel.vol[aria-selected='true'] .b-neutraal {
		box-shadow: inset 0 0 0 1px var(--paper);
	}
	.legenda {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-1) var(--s-3);
		margin: var(--s-2) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.legenda .sw {
		display: inline-block;
		width: 10px;
		height: 4px;
		margin-right: var(--s-1);
		vertical-align: 2px;
	}
	.nieuwteken {
		display: inline-block;
		margin-right: var(--s-2);
		border-style: solid;
		border-width: 0 9px 9px 0;
		border-color: transparent var(--ink) transparent transparent;
	}
	.kort {
		display: none;
	}
	/* On a phone: short month names, the heads upright, and the grid pans under its labels. */
	@media (max-width: 640px) {
		.schuif {
			--label: 52px;
			overflow-x: auto;
		}
		.kruiswoord {
			min-width: 520px;
		}
		.rij {
			column-gap: 2px;
		}
		.rij > :first-child {
			position: sticky;
			left: 0;
			z-index: 1;
			background: var(--paper);
		}
		.k {
			display: flex;
			flex-direction: column;
			justify-content: flex-end;
			align-items: center;
			height: 100px;
		}
		.k--per {
			align-items: flex-start;
		}
		.k .w {
			writing-mode: vertical-rl;
			transform: rotate(180deg);
		}
		.vorm {
			margin: 0 0 var(--s-1);
		}
		.som-groot {
			font-size: var(--t-h3);
		}
		.per {
			font-size: var(--t-micro);
		}
		.lang {
			display: none;
		}
		.kort {
			display: inline;
		}
	}
</style>

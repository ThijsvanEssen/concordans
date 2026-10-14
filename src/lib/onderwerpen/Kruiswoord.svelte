<script lang="ts">
	// The Kruiswoord of a topic (concept ux-voorstel/1f, ronde 6): the months (or weeks) as
	// rows, a year folded under its totals; the columns under their heading (Stukken,
	// Stemmingen, a fractie), the column's total at the top. Every number with a count is a
	// button: chosen, it stands in ink and the list under the grid holds its events. A column a
	// chosen strekking does not apply to stands empty. A cell with an event after the visit
	// before this one has a corner in ink. On a phone the grid pans, its labels stay.
	import { formatCount } from '$lib/text/getal';
	import Caret from '$lib/components/ui/Caret.svelte';
	import { maandNaam, langeDatum } from '$lib/text/datum';
	import { jaarVanVak, type Keuze, type Kolom, type Rij, type Vak } from './kruiswoord';

	export type KolomKop = {
		k: Kolom;
		label: string;
		/** What the column counts, on hover. */
		titel: string;
		/** The heading over its columns: `Stukken`, `Stemmingen`, or the fractie. */
		groep: string;
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
		failed = new Set(),
		ongeteld = {},
		uit = new Set(),
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
		/** Columns whose count did not come: not counted, never a 0, and a line under the grid. */
		failed?: ReadonlySet<Kolom>;
		/** Per column the last month or week not counted (the feed's pages ran out before). */
		ongeteld?: Partial<Record<Kolom, Vak | null>>;
		/** Columns a chosen strekking does not apply to: they stand empty. */
		uit?: ReadonlySet<Kolom>;
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
	const isOngeteld = (k: Kolom, v: Vak) => {
		const grens = ongeteld[k];
		return !!grens && v <= grens;
	};
	const label = (v: Vak, kort: boolean) =>
		v.includes('-W') ? `week ${Number(v.slice(6))}` : maandNaam(`${v}-01`, kort);
	const gekozen = (k: Kolom, v: Vak) => keuze?.kolom === k && keuze.vak === v;
	const kies = (k: Kolom, v: Vak) => onKies(gekozen(k, v) ? null : { kolom: k, vak: v });
	const heeftNieuw = $derived([...rijen.values()].some((r) => kolommen.some((c) => r[c.k].nieuw)));
	const groepen = $derived(
		kolommen.reduce<{ label: string; van: number; n: number }[]>((g, c, i) => {
			const last = g.at(-1);
			if (last && last.label === c.groep && last.van + last.n === i) last.n++;
			else g.push({ label: c.groep, van: i, n: 1 });
			return g;
		}, [])
	);
	const vakkenVan = (j: string) => vakken.filter((v) => jaarVanVak(v) === j);
	/** "Moties en brieven konden niet worden geteld.", in the order of the columns. */
	const failedLine = $derived.by(() => {
		const labels = kolommen
			.filter((c) => failed.has(c.k) && !uit.has(c.k))
			.map((c, i) => (i ? c.label.toLowerCase() : c.label));
		if (!labels.length) return null;
		const list =
			labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} en ${labels.at(-1)}`;
		return `${list} ${labels.length === 1 ? 'kon' : 'konden'} niet worden geteld.`;
	});
</script>

<div class="schuif" data-zijscroll>
	<div
		class="kruiswoord"
		style:--n={kolommen.length}
		role="grid"
		aria-label="Verloop per {week ? 'week' : 'maand'}"
	>
		<div class="rij kopregel" role="row">
			<!-- First, so it stands still as every row's label does on a phone. -->
			<span class="k k--per" role="columnheader">{week ? 'Week' : 'Maand'}</span>
			{#each groepen as g (g.label)}
				<span class="groepkop" style:grid-column="{g.van + 2} / span {g.n}" aria-hidden="true"
					><span class="groepkop__w">{g.label}</span></span
				>
			{/each}
			{#each kolommen as c (c.k)}
				<span class="k" class:af={uit.has(c.k)} role="columnheader" title={c.titel}
					><span class="w"
						>{#if c.vorm}<span class="vorm vorm--{c.vorm}" aria-hidden="true"
							></span>{/if}{c.label}</span
					></span
				>
			{/each}
		</div>

		<div class="rij kern" role="row">
			<span class="per" role="rowheader">Totaal</span>
			{#each kolommen as c (c.k)}
				{@const t = totaal(vakken, c.k)}
				{#if uit.has(c.k)}
					<span class="som-groot af" role="gridcell" aria-label="Niet van toepassing"></span>
				{:else if failed.has(c.k)}
					<span class="som-groot" role="gridcell" title="Niet geteld" aria-label="Niet geteld"
					></span>
				{:else if bezig[c.k]}
					<span class="som-groot" role="gridcell" aria-label="Laden">…</span>
				{:else if t > 0}
					<button
						type="button"
						role="gridcell"
						class="som-groot knop"
						aria-selected={gekozen(c.k, '')}
						aria-label="{c.groep}, {c.label}, totaal: {t}"
						onclick={() => kies(c.k, '')}>{getal(t)}</button
					>
				{:else}
					<span class="som-groot" role="gridcell">0</span>
				{/if}
			{/each}
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
						{@const t = totaal(vs, c.k)}
						{#if uit.has(c.k)}
							<span class="t" role="gridcell"></span>
						{:else if vs.every((v) => isOngeteld(c.k, v))}
							<span class="t" role="gridcell" title="Niet geteld" aria-label="Niet geteld"></span>
						{:else if failed.has(c.k)}
							<span class="t" role="gridcell" title="Niet geteld" aria-label="Niet geteld"></span>
						{:else if bezig[c.k]}
							<span class="t" role="gridcell">…</span>
						{:else if t > 0}
							<button
								type="button"
								role="gridcell"
								class="t knop"
								aria-selected={gekozen(c.k, j)}
								aria-label="{c.groep}, {c.label}, {j}: {t}"
								onclick={() => kies(c.k, j)}>{getal(t)}</button
							>
						{:else}
							<span class="t" role="gridcell">0</span>
						{/if}
					{/each}
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
							{#if uit.has(c.k)}
								<span class="cel nvt" role="gridcell"></span>
							{:else if failed.has(c.k)}
								<span class="cel ongeteld" role="gridcell" title="Niet geteld"></span>
							{:else if cel && cel.n > 0}
								<button
									type="button"
									role="gridcell"
									class="cel vol"
									class:nieuw={cel.nieuw}
									aria-selected={gekozen(c.k, v)}
									aria-label="{c.groep}, {c.label}, {label(v, false)} {jaarVanVak(
										v
									)}: {cel.n}{cel.nieuw ? ', nieuw' : ''}"
									onclick={() => kies(c.k, v)}>{cel.n}</button
								>
							{:else if isOngeteld(c.k, v)}
								<span class="cel ongeteld" role="gridcell" title="Niet geteld"></span>
							{:else if bezig[c.k]}
								<span class="cel wacht" role="gridcell" aria-label="Laden">…</span>
							{:else}
								<span class="cel leeg" role="gridcell" aria-label="Geen"></span>
							{/if}
						{/each}
					</div>
				{/each}
			{/if}
		{/each}
	</div>
</div>
{#if failedLine}
	<p class="stil" role="alert">{failedLine}</p>
{/if}
{#if heeftNieuw && nieuwSinds}
	<p class="legenda">
		<span
			><span class="nieuwteken" aria-hidden="true"></span>nieuw sinds {langeDatum(nieuwSinds)}</span
		>
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
		margin-top: var(--s-1);
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
		margin-bottom: var(--s-1);
		border-bottom: 1px solid var(--rule-strong);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink);
		text-align: center;
	}
	.k {
		grid-row: 2;
		padding: var(--s-1) 0;
		border-bottom: 1px solid var(--rule-strong);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		text-align: center;
	}
	.k--per {
		text-align: left;
	}
	.k.af {
		color: var(--rule-strong);
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
	/* A total is a button as a cell is: quiet at rest, an inset line on hover, in ink chosen. */
	.knop {
		padding: 0;
		border: 0;
		border-radius: 0;
		background: none;
		cursor: pointer;
	}
	.t.knop {
		height: var(--veld-h-klein);
	}
	.knop:hover,
	.knop:focus-visible {
		box-shadow: inset 0 0 0 1.5px var(--ink);
		outline: none;
	}
	.knop[aria-selected='true'] {
		background: var(--ink);
		color: var(--paper);
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
	.cel.wacht {
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
			column-gap: var(--s-1);
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
		/* A heading over panned columns keeps its name in view beside the labels. */
		.groepkop__w {
			display: inline-block;
			position: sticky;
			left: calc(var(--label) + var(--s-1));
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

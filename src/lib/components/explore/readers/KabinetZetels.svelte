<script lang="ts">
	// The seats of a cabinet (Thijs, 10 Oct: the coalition is a cabinet's at a point in time,
	// not the Kamer's): the Tweede Kamer on a day of its period, the coalition filled and the
	// opposition open, the two sides as lists and against the majority; under it the
	// coalition's seats over the period, a step per change, each step the day the hall shows;
	// the Eerste Kamer where the API has it (a cabinet in office on the day of its
	// composition). A cabinet from before 30 November 2006 has no seats per day: no section.
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import Hemicycle from '../Hemicycle.svelte';
	import ZaalTegenover from '../ZaalTegenover.svelte';
	import Meerderheid from '../Meerderheid.svelte';
	import { achtergrondVan, kleurVan } from '../partijkleuren.svelte';
	import { getCabinetSeats, getParliamentSeats } from '$lib/api/records';
	import { korteDatum, vandaag } from '$lib/text/datum';
	import { formatLongDate } from './_shared';
	import type { Schema } from '$lib/api/types';

	type Zaal = Schema<'ParliamentSeatsResponse'>;
	type Stuk = Schema<'SeatStretchDTO'>;

	let { kabinet }: { kabinet: string } = $props();

	let zetels = $state<Schema<'CabinetSeatsResponse'> | null>(null);
	let tk = $state<Zaal | null>(null);
	let ek = $state<Zaal | null>(null);

	const dag = vandaag();
	/** The cabinet's last day, or today while it is in office. */
	const eind = $derived(zetels ? (zetels.to_date ?? dag) : dag);
	/** The day the hall shows: ?zetels= when it falls in the period, else the last day. */
	const opDag = $derived.by(() => {
		const d = page.url.searchParams.get('zetels');
		return zetels?.from_date && d && d >= zetels.from_date && d <= eind ? d : eind;
	});

	$effect(() => {
		const key = kabinet;
		let weg = false;
		zetels = null;
		ek = null;
		getCabinetSeats(key)
			.then((z) => {
				if (weg) return;
				zetels = z;
				// The Eerste Kamer only where the API gives this cabinet a stretch there.
				if (z.ek?.length)
					getParliamentSeats('EK')
						.then((e) => {
							if (!weg && e.cabinet?.key === key) ek = e;
						})
						.catch(() => {});
			})
			.catch(() => {});
		return () => {
			weg = true;
		};
	});

	$effect(() => {
		const d = opDag;
		if (!zetels?.tk?.length) return;
		let weg = false;
		getParliamentSeats('TK', d === dag ? undefined : d)
			.then((t) => {
				if (!weg) tk = t;
			})
			.catch(() => {});
		return () => {
			weg = true;
		};
	});

	/**
	 * Of this cabinet's coalition, per fractie. In the Tweede Kamer from the stretch of the day
	 * shown: on the last day of a cabinet the hall's own `coalition` is already the next
	 * cabinet's (Schoof's last day is Jetten's first). Elsewhere from the hall.
	 */
	const vanKabinet = (z: Zaal, stuk: Stuk | null) => {
		const m = stuk?.factions ? new Map(stuk.factions.map((f) => [f.key, f.coalition])) : null;
		return (f: Zaal['factions'][number]) => (m ? (m.get(f.key) ?? null) : (f.coalition ?? null));
	};
	/** Coalition, opposition or neither per fractie, as the hall marks them. */
	const kantVan = (z: Zaal, stuk: Stuk | null = null) => {
		const c = vanKabinet(z, stuk);
		return Object.fromEntries(
			z.factions.map((f) => [f.key, c(f) === true ? 'voor' : c(f) === false ? 'tegen' : 'other'])
		) as Record<string, 'voor' | 'tegen' | 'other'>;
	};
	const naam = (f: Zaal['factions'][number]) => f.abbreviation ?? f.name ?? f.key;
	const zijden = (z: Zaal, stuk: Stuk | null = null) => {
		const c = vanKabinet(z, stuk);
		const fr = [...z.factions].sort((a, b) => b.seats - a.seats);
		const ja = fr.filter((f) => c(f) === true);
		const nee = fr.filter((f) => c(f) === false);
		const som = (l: typeof fr) => l.reduce((n, f) => n + f.seats, 0);
		return { ja, nee, jaZetels: som(ja), neeZetels: som(nee) };
	};

	// The step line: the coalition's seats over the period, the majority as a line.
	const W = 600;
	const H = 72;
	const PAD = 4;
	const dagNr = (d: string) => Date.parse(`${d}T00:00:00Z`) / 864e5;
	/** The majority of the Tweede Kamer: 76 of 150. */
	const MEERDERHEID = 76;
	// The scale follows the seats around the majority, so a change of a few seats shows.
	const schaal = $derived.by(() => {
		const v = (zetels?.tk ?? []).map((s: Stuk) => s.coalition);
		const lo = Math.max(0, Math.min(...v, MEERDERHEID) - 12);
		const hi = Math.min(150, Math.max(...v, MEERDERHEID) + 8);
		return (n: number) => PAD + (1 - (n - lo) / (hi - lo)) * (H - 2 * PAD);
	});
	const stukken = $derived.by(() => {
		const tkStukken = zetels?.tk ?? [];
		if (!zetels?.from_date || !tkStukken.length) return [];
		const a = dagNr(zetels.from_date);
		const b = Math.max(dagNr(eind) + 1, a + 1);
		const x = (d: string) => ((dagNr(d) - a) / (b - a)) * W;
		const dagBreed = W / (b - a);
		return tkStukken.map((s: Stuk) => {
			const x0 = x(s.from_date);
			const tot = s.to_date && s.to_date < eind ? s.to_date : eind;
			// A stretch of one day stays wide enough to see and to point at.
			const x1 = Math.max(x(tot) + dagBreed, x0 + 3);
			return { s, x0, x1, y: schaal(s.coalition) };
		});
	});
	const yMeerderheid = $derived(schaal(MEERDERHEID));
	const gekozen = $derived(
		stukken.find((k) => opDag >= k.s.from_date && opDag <= (k.s.to_date ?? eind)) ?? null
	);
	/** The hall on the first day of a stretch; the last stretch is the hall without ?zetels. */
	function kies(s: Stuk) {
		const u = new URL(page.url);
		if (!s.to_date || s.to_date >= eind) u.searchParams.delete('zetels');
		else u.searchParams.set('zetels', s.from_date);
		void goto(u, { replaceState: true, noScroll: true, keepFocus: true });
	}
</script>

{#if zetels?.tk?.length}
	<Sectie titel="Zetels">
		<div class="zetels">
			{#if tk}
				{@const z = zijden(tk, gekozen?.s ?? null)}
				<figure class="kamer">
					<figcaption>Tweede Kamer, {formatLongDate(opDag)}</figcaption>
					<div class="zaal">
						<Hemicycle
							data={tk}
							meubels
							telling={false}
							voteHighlight={kantVan(tk, gekozen?.s ?? null)}
							woorden={['coalitie', 'oppositie']}
							colorOf={(f, i) => kleurVan('TK', naam(f), i, f.color ?? null)}
						/>
					</div>
					<!-- The Kamer's numbers of the front, quiet under the hall. -->
					<p class="sleutel">
						{#each ['Voorzitter', 'Griffier', 'Kabinet (vak-K)', 'Verslag en redactie', 'Spreekgestoelte', 'Interruptiemicrofoons', 'Bodedienst'] as plaats, i (plaats)}<span
								><b>{i + 1}</b> {plaats}</span
							>{/each}
					</p>
					<div class="zijden">
						{#each [['Coalitie', z.ja, z.jaZetels], ['Oppositie', z.nee, z.neeZetels]] as const as [kop, lijst, totaal] (kop)}
							<div class="zijde" class:zijde--lang={lijst.length > 6}>
								<h4>{kop} <span class="aantal">{totaal}</span></h4>
								<ol>
									{#each lijst as f (f.key)}
										<li>
											<span
												class="stip"
												class:open={kop === 'Oppositie'}
												style:--kleur={kleurVan('TK', naam(f), 0, f.color ?? null)}
												style:--achter={achtergrondVan(naam(f), f.color ?? null)}
											></span>
											<span class="n">{naam(f)}</span><span class="z">{f.seats}</span>
										</li>
									{/each}
								</ol>
							</div>
						{/each}
					</div>
					<Meerderheid
						ja={z.jaZetels}
						nee={z.neeZetels}
						totaal={tk.total_seats}
						woorden={['coalitie', 'oppositie']}
					/>
				</figure>
			{/if}

			{#if stukken.length > 1}
				<div class="verloop">
					<span class="drempel" style:top="{(yMeerderheid / H) * 100}%">{MEERDERHEID}</span>
					<svg
						viewBox="0 0 {W} {H}"
						preserveAspectRatio="none"
						role="group"
						aria-label="Zetels van de coalitie in de Tweede Kamer"
					>
						<line x1="0" x2={W} y1={yMeerderheid} y2={yMeerderheid} class="lijn" />
						{#each stukken as k (k.s.from_date)}
							<rect
								x={k.x0}
								y={k.y}
								width={k.x1 - k.x0}
								height={H - PAD - k.y}
								class="stap"
								class:gekozen={gekozen === k}
							/>
							<!-- A step is the day of the hall above: the whole height is the target. -->
							<rect
								x={k.x0}
								y="0"
								width={k.x1 - k.x0}
								height={H}
								class="doel"
								role="button"
								tabindex="0"
								aria-label="{k.s.coalition} zetels, {formatLongDate(k.s.from_date)}"
								onclick={() => kies(k.s)}
								onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && kies(k.s)}
								><title>{k.s.coalition} zetels vanaf {formatLongDate(k.s.from_date)}</title></rect
							>
						{/each}
					</svg>
					<p class="as">
						<span>{zetels.from_date ? korteDatum(zetels.from_date) : ''}</span>
						{#if gekozen}
							<span class="nu"
								>{gekozen.s.coalition} zetels, {korteDatum(gekozen.s.from_date)}{gekozen.s
									.to_date && gekozen.s.to_date !== gekozen.s.from_date
									? ` tot ${korteDatum(gekozen.s.to_date)}`
									: ''}</span
							>
						{/if}
						<span>{zetels.to_date ? korteDatum(zetels.to_date) : 'nu'}</span>
					</p>
				</div>
			{/if}

			{#if ek}
				{@const z = zijden(ek)}
				<figure class="kamer">
					<figcaption>Eerste Kamer, samenstelling op {formatLongDate(ek.as_of ?? null)}</figcaption>
					<div class="zaal">
						<ZaalTegenover data={ek} voteHighlight={kantVan(ek)} />
					</div>
					<p class="sleutel">
						{#each ['Voorzitter', 'Griffie', 'Regering', 'Verslag en redactie'] as plaats, i (plaats)}<span
								><b>{i + 1}</b> {plaats}</span
							>{/each}
					</p>
					<Meerderheid
						ja={z.jaZetels}
						nee={z.neeZetels}
						totaal={ek.total_seats}
						woorden={['coalitie', 'oppositie']}
					/>
				</figure>
			{/if}
		</div>
	</Sectie>
{/if}

<style>
	.zetels {
		display: flex;
		flex-direction: column;
		gap: var(--s-6);
	}
	.kamer {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}
	figcaption {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.zaal {
		display: flex;
		justify-content: center;
	}
	/* Both halls in the box of the Tweede Kamer's (440 by 291): one scale, one height. */
	.zaal :global(svg) {
		width: 100%;
		max-width: 456px;
		height: auto;
		aspect-ratio: 440 / 291;
	}
	.zaal :global(.hemicycle) {
		padding: 0;
		border: 0;
		background: transparent;
	}
	/* The two sides side by side, each a list of its fracties by seats; a long side (the
	   opposition, mostly) in two columns, so the lists stand about as high (Thijs, 10 Oct). */
	.zijden {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
		gap: var(--s-5);
	}
	.zijde--lang ol {
		columns: 2;
		column-gap: var(--s-5);
	}
	.zijde--lang li {
		break-inside: avoid;
	}
	.sleutel {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--s-1) var(--s-3);
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.sleutel b {
		font-weight: 600;
		color: var(--ink-2);
	}
	@media (max-width: 520px) {
		.zijden {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	h4 {
		display: flex;
		justify-content: space-between;
		margin: 0 0 var(--s-1);
		padding-bottom: var(--s-1);
		border-bottom: 1px solid var(--rule);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink);
	}
	.aantal {
		font-weight: 600;
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--s-2);
		padding: 2px 0;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.n {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.z {
		color: var(--ink-3);
	}
	/* Filled for the coalition, open for the opposition, as the seats in the hall. */
	.stip {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		background: var(--achter, var(--kleur));
	}
	.stip.open {
		background: var(--paper);
		box-shadow: inset 0 0 0 1.5px var(--kleur);
	}
	.verloop {
		position: relative;
	}
	/* The majority's number above the end of its line, inside the column. */
	.drempel {
		position: absolute;
		right: 0;
		transform: translateY(-115%);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--accent);
	}
	.verloop svg {
		display: block;
		width: 100%;
		height: 72px;
	}
	.stap {
		fill: var(--rule);
	}
	.stap.gekozen {
		fill: var(--ink);
	}
	.doel {
		fill: transparent;
		cursor: pointer;
		outline: none;
	}
	.doel:hover,
	.doel:focus-visible {
		stroke: var(--ink);
		stroke-width: 1;
	}
	.lijn {
		stroke: var(--accent);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}
	.as {
		display: flex;
		justify-content: space-between;
		gap: var(--s-3);
		margin: var(--s-1) 0 0;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.nu {
		color: var(--ink);
	}
</style>

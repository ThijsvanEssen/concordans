<script lang="ts">
	import { naamVan } from '$lib/bron/menselijk';
	// The seats of a cabinet in one Kamer (concept 16, variant B; Thijs, 10 Oct): the coalition's
	// seats as the head figure, their course over the cabinet's period, then the hall on the day
	// chosen, its two sides and the majority. Text and bars at the frame's left edge, the hall
	// alone centred. Where the API has no stretches yet (the Eerste Kamer before its history is
	// filled) the hall of today, when its cabinet is this one; else a quiet line.
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import Hemicycle from '../Hemicycle.svelte';
	import ZaalTegenover from '../ZaalTegenover.svelte';
	import Meerderheid from '../Meerderheid.svelte';
	import ZaalPlaatsen from '../ZaalPlaatsen.svelte';
	import { achtergrondVan, kleurVan } from '../partijkleuren.svelte';
	import { getParliamentSeats } from '$lib/api/records';
	import { korteDatum, vandaag } from '$lib/text/datum';
	import { formatLongDate } from './_shared';
	import { vacantZonderFractie, wijzigingenVan } from './zetels';
	import type { Schema } from '$lib/api/types';

	type Zaal = Schema<'ParliamentSeatsResponse'>;
	type Stuk = Schema<'SeatStretchDTO'>;

	let {
		kamer,
		stukken,
		meerderheid,
		van,
		eind,
		dag,
		kabinet,
		onKies
	}: {
		kamer: 'TK' | 'EK';
		/** The cabinet's stretches in this Kamer; empty where the API has none. */
		stukken: Stuk[];
		/** The seats a majority takes (`majority` of the cabinet's seats). */
		meerderheid: number;
		/** The cabinet's first day. */
		van: string | null;
		/** Its last day, or today while it is in office. */
		eind: string;
		/** The day the hall shows. */
		dag: string;
		kabinet: string;
		onKies: (s: Stuk) => void;
	} = $props();

	const titel = $derived(
		kamer === 'TK' ? 'Zetels in de Tweede Kamer' : 'Zetels in de Eerste Kamer'
	);
	const PLAATSEN = {
		TK: [
			'Voorzitter',
			'Griffier',
			'Kabinet (vak-K)',
			'Verslag en redactie',
			'Spreekgestoelte',
			'Interruptiemicrofoons',
			'Bodedienst'
		],
		EK: ['Voorzitter', 'Griffie', 'Regering', 'Verslag en redactie']
	};

	/** The hall of the day; `geen` where the data has none for it. */
	let zaal = $state<Zaal | 'laden' | 'geen'>('laden');
	/**
	 * The day the hall is asked for: the day shown, within the stretch it falls in (a past
	 * cabinet's last day is its successor's first). Always with a date: only then does the
	 * hall give its vacancies (API 0.79.44, #526).
	 */
	const zaalDag = $derived.by(() => {
		const s =
			stukken.find((t) => dag >= t.from_date && dag <= (t.to_date ?? eind)) ?? stukken.at(-1);
		if (!s) return vandaag();
		const tot = s.to_date ?? eind;
		return dag < s.from_date ? s.from_date : dag > tot ? tot : dag;
	});
	$effect(() => {
		const k = kamer;
		const d = zaalDag;
		const metStukken = stukken.length > 0;
		const sleutel = kabinet;
		let weg = false;
		zaal = 'laden';
		// With stretches the hall of the day chosen; without, the hall of today, when it is
		// this cabinet's.
		getParliamentSeats(k, d)
			.then((z) => {
				if (weg) return;
				zaal = metStukken || z.cabinet?.key === sleutel ? z : 'geen';
			})
			.catch(() => {
				if (!weg) zaal = 'geen';
			});
		return () => {
			weg = true;
		};
	});

	const gekozen = $derived(
		stukken.find((s) => dag >= s.from_date && dag <= (s.to_date ?? eind)) ?? stukken.at(-1) ?? null
	);

	/**
	 * Of this cabinet's coalition, per fractie: from the stretch of the day (on a cabinet's last
	 * day the hall's own `coalition` is already the next cabinet's), else from the hall.
	 */
	const vanKabinet = (stuk: Stuk | null) => {
		const m = stuk?.factions ? new Map(stuk.factions.map((f) => [f.key, f.coalition])) : null;
		return (f: Zaal['factions'][number]) =>
			m && f.key ? (m.get(f.key) ?? null) : (f.coalition ?? null);
	};
	const kantVan = (z: Zaal, stuk: Stuk | null) => {
		const c = vanKabinet(stuk);
		return Object.fromEntries(
			z.factions.map((f) => [f.key, c(f) === true ? 'voor' : c(f) === false ? 'tegen' : 'other'])
		) as Record<string, 'voor' | 'tegen' | 'other'>;
	};
	const naam = (f: { key?: string | null; abbreviation?: string | null; name?: string | null }) =>
		f.abbreviation ?? f.name ?? naamVan('factions', f);
	type Rij = { key: string; naam: string; seats: number; vacant: number; color: string | null };
	/**
	 * The two sides as the head figure counts them (UX test 10 Oct, #12: "41" above, "37" in
	 * the list): from the stretch, its fracties' seats with their vacancies; the hall gives the
	 * colours. Without a stretch, from the hall.
	 */
	const zijden = (z: Zaal, stuk: Stuk | null) => {
		const kleur = new Map(z.factions.map((f) => [f.key, f.color ?? null]));
		const rijen: (Rij & { ja: boolean | null })[] = stuk?.factions?.length
			? stuk.factions.map((f) => ({
					key: f.key ?? naam(f),
					naam: naam(f),
					seats: f.seats,
					vacant: f.vacant ?? 0,
					color: kleur.get(f.key) ?? null,
					ja: f.coalition ?? null
				}))
			: z.factions.map((f) => ({
					key: f.key ?? naam(f),
					naam: naam(f),
					seats: f.seats,
					vacant: 0,
					color: f.color ?? null,
					ja: f.coalition ?? null
				}));
		const fr = rijen.sort((a, b) => b.seats - a.seats);
		const ja = fr.filter((f) => f.ja === true);
		const nee = fr.filter((f) => f.ja === false);
		const som = (l: typeof fr) => l.reduce((n, f) => n + f.seats, 0);
		// The vacant seats no fractie holds: of neither side (UX #48).
		const los = stuk ? vacantZonderFractie(stuk) : 0;
		return { ja, nee, jaZetels: som(ja), neeZetels: som(nee), los };
	};

	/** The seats of the Kamer (Grondwet art. 51): the stretches' sums run over it on a day a
	 *  seat changes hands (Schoof, 25 July 2025: 152). */
	const zetelsVanKamer = $derived(kamer === 'TK' ? 150 : 75);
	/** The head figure: the coalition's seats on the day, of the Kamer's. */
	/**
	 * The coalition's vacant seats on the stretch (`coalition_vacant`, API 0.79.44, #526); an
	 * API before it gives none, and then the sum of its fracties' own (`factions[].vacant`).
	 */
	const coalitieVacant = (s: Stuk) =>
		s.coalition_vacant ??
		(s.factions ?? []).reduce((n, f) => n + (f.coalition ? (f.vacant ?? 0) : 0), 0);
	const kop = $derived.by(() => {
		if (gekozen)
			return { ja: gekozen.coalition, totaal: zetelsVanKamer, vacant: coalitieVacant(gekozen) };
		if (typeof zaal === 'object')
			return { ja: zijden(zaal, null).jaZetels, totaal: zetelsVanKamer, vacant: 0 };
		return null;
	});
	const onzeker = $derived(stukken.some((s) => s.checked === false));

	// The step line: the coalition's seats over the period, the majority as a line.
	const W = 600;
	const H = 72;
	const PAD = 4;
	const dagNr = (d: string) => Date.parse(`${d}T00:00:00Z`) / 864e5;
	// The scale follows the seats around the majority, so a change of a few seats shows.
	const schaal = $derived.by(() => {
		const v = stukken.map((s) => s.coalition);
		const top = zetelsVanKamer;
		const lo = Math.max(0, Math.min(...v, meerderheid) - Math.round(top / 12));
		const hi = Math.min(top, Math.max(...v, meerderheid) + Math.round(top / 18));
		return (n: number) => PAD + (1 - (n - lo) / (hi - lo)) * (H - 2 * PAD);
	});
	const stappen = $derived.by(() => {
		if (!van || stukken.length < 2) return [];
		const a = dagNr(van);
		const b = Math.max(dagNr(eind) + 1, a + 1);
		const x = (d: string) => ((dagNr(d) - a) / (b - a)) * W;
		const dagBreed = W / (b - a);
		return stukken.map((s) => {
			const x0 = Math.max(0, x(s.from_date));
			const tot = s.to_date && s.to_date < eind ? s.to_date : eind;
			// A stretch of one day stays wide enough to see and to point at.
			const x1 = Math.max(x(tot) + dagBreed, x0 + 6);
			return { s, x0, x1, y: schaal(s.coalition) };
		});
	});
	const yMeerderheid = $derived(schaal(meerderheid));
	const wijzigingen = $derived(gekozen ? wijzigingenVan(gekozen) : []);
	/** `66 zetels, 2 sep. 2026 tot 10 okt. 2026.` */
	const stapZin = (s: Stuk) =>
		`${s.coalition} zetels, ${korteDatum(s.from_date)}${
			s.to_date && s.to_date !== s.from_date ? ` tot ${korteDatum(s.to_date)}` : ''
		}.`;
</script>

{#snippet meerderheidWoord(n: number)}{n >= meerderheid
		? 'meerderheid'
		: 'geen meerderheid'}{/snippet}

<Sectie {titel}>
	<div class="zetels">
		{#if kop}
			<!-- The head figure (concept 16, B): the coalition's seats on the day shown. -->
			<!-- The latest count first, one step from its course (Thijs, 10 Oct): the figure
			     leads to the step strip under it. -->
			<p class="kopgetal">
				{#if stappen.length}<a class="kopgetal__getal" href="#verloop-{kamer}">{kop.ja}</a>{:else}<b
						>{kop.ja}</b
					>{/if}
				<span
					>coalitiezetels{kop.vacant ? `, waarvan ${kop.vacant} vacant` : ''}, van {kop.totaal},
					{@render meerderheidWoord(kop.ja)} ({meerderheid})</span
				>
			</p>
		{/if}

		{#if stappen.length}
			<div class="verloop" id="verloop-{kamer}" tabindex="-1">
				<div class="strook">
					<svg
						viewBox="0 0 {W} {H}"
						preserveAspectRatio="none"
						role="group"
						aria-label="Zetels van de coalitie in de {kamer === 'TK'
							? 'Tweede'
							: 'Eerste'} Kamer, met een lijn op de meerderheid van {meerderheid}"
					>
						{#each stappen as k (k.s.from_date)}
							<rect
								x={k.x0}
								y={k.y}
								width={k.x1 - k.x0}
								height={H - PAD - k.y}
								class="stap"
								class:gekozen={gekozen === k.s}
								class:onzeker={k.s.checked === false}
							/>
						{/each}
						<!-- The majority over the steps, so a coalition above it does not hide it. -->
						<line x1="0" x2={W} y1={yMeerderheid} y2={yMeerderheid} class="lijn" />
						{#each stappen as k (k.s.from_date)}
							<!-- A step is the day of the hall below: the whole height is the target. -->
							<rect
								x={k.x0}
								y="0"
								width={k.x1 - k.x0}
								height={H}
								class="doel"
								role="button"
								tabindex="0"
								aria-label="{k.s.coalition} zetels, {formatLongDate(k.s.from_date)}"
								onclick={() => onKies(k.s)}
								onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onKies(k.s)}
								><title>{k.s.coalition} zetels vanaf {formatLongDate(k.s.from_date)}</title></rect
							>
						{/each}
					</svg>
					<!-- The majority named at its line, not in a sentence under it (UX-toets 10 Oct, #17). -->
					<span class="lijn-naam" style:top="{(yMeerderheid / H) * 100}%" aria-hidden="true"
						>meerderheid {meerderheid}</span
					>
				</div>
				<!-- The period's ends under its ends; what the strip shows as a caption at the left
				     edge, as under the hall. -->
				<p class="as">
					<span>{van ? korteDatum(van) : ''}</span>
					<span>{eind === vandaag() ? 'nu' : korteDatum(eind)}</span>
				</p>
				{#if gekozen}
					<p class="onderschrift">
						<b>{stapZin(gekozen)}</b>{#each wijzigingen as w, i (i)}{i ? '; ' : ' '}<span
								class="wijziging">{w.woorden ?? w.soort}</span
							>{#if w.wie}{` ${w.wie}`}{/if}{/each}{wijzigingen.length
							? gekozen.checked === false
								? ' (onzeker).'
								: '.'
							: ''}
					</p>
				{/if}
				{#if onzeker}
					<p class="onderschrift">
						De telling van deze termijn sloot niet; de zetels zijn onzeker.
					</p>
				{/if}
			</div>
		{/if}

		{#if zaal === 'laden'}
			<p class="onderschrift">Laden…</p>
		{:else if zaal === 'geen'}
			<p class="onderschrift">
				{stukken.length
					? `Geen samenstelling in de gegevens op ${formatLongDate(dag)}.`
					: `Geen samenstelling van de ${kamer === 'TK' ? 'Tweede' : 'Eerste'} Kamer voor dit kabinet in de gegevens.`}
			</p>
		{:else}
			{@const z = zijden(zaal, gekozen)}
			<figure class="kamer">
				<p class="onderschrift">Samenstelling op {formatLongDate(zaal.as_of ?? dag)}.</p>
				<div class="zaal">
					{#if kamer === 'TK'}
						<Hemicycle
							data={zaal}
							meubels
							telling={false}
							vacant={z.los}
							voteHighlight={kantVan(zaal, gekozen)}
							woorden={['coalitie', 'oppositie']}
							colorOf={(f, i) => kleurVan('TK', naam(f), i, f.color ?? null)}
						/>
					{:else}
						<ZaalTegenover data={zaal} voteHighlight={kantVan(zaal, gekozen)} />
					{/if}
				</div>
				<!-- The Kamer's numbers of the front, quiet under the hall. -->
				<ZaalPlaatsen plaatsen={PLAATSEN[kamer]} />
				<div class="zijden">
					{#each [['Coalitie', z.ja, z.jaZetels], ['Oppositie', z.nee, z.neeZetels]] as const as [kopje, lijst, totaal] (kopje)}
						<div class="zijde" class:zijde--lang={lijst.length > 6}>
							<h4>{kopje} <span class="aantal">{totaal}</span></h4>
							<ol>
								{#each lijst as f (f.key)}
									<li>
										<span
											class="stip"
											class:open={kopje === 'Oppositie'}
											style:--kleur={kleurVan(kamer, f.naam, 0, f.color)}
											style:--achter={achtergrondVan(f.naam, f.color)}
										></span>
										<span class="n"
											>{f.naam}{#if f.vacant}<span class="vacant">, {f.vacant} vacant</span
												>{/if}</span
										><span class="z">{f.seats}</span>
									</li>
								{/each}
							</ol>
						</div>
					{/each}
					{#if z.los}
						<!-- The vacant seats no fractie holds: a row of neither side (UX #48). -->
						<ol class="los">
							<li>
								<span class="stip stip--leeg"></span>
								<span class="n">Vacant</span><span class="z">{z.los}</span>
							</li>
						</ol>
					{/if}
				</div>
				<Meerderheid
					ja={z.jaZetels}
					nee={z.neeZetels}
					totaal={zaal.total_seats}
					woorden={['coalitie', 'oppositie']}
				/>
			</figure>
		{/if}
	</div>
</Sectie>

<style>
	.zetels {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
	}
	/* The head figure: the number in weight, its words beside it on one baseline. */
	.kopgetal {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-2);
		margin: 0;
		font-family: var(--font-serif);
	}
	.kopgetal b {
		font-size: var(--t-h2);
		font-weight: 800;
		line-height: var(--lh-tight);
		color: var(--ink);
	}
	.kopgetal span {
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.kamer {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}
	/* A date or a state of what is shown (docs/bediening.md, Bronregels). */
	.onderschrift {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.onderschrift b {
		font-weight: 400;
		color: var(--ink);
	}
	/* The Eerste Kamer's own words verbatim, or a derived change's kind, in ink; its fracties
	   quiet. */
	.wijziging {
		color: var(--ink);
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
		font-family: var(--font-serif);
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
		font-family: var(--font-serif);
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
	.vacant {
		color: var(--ink-3);
	}
	/* The head figure leads to the course: ink, underlined on hover as every link. */
	.kopgetal__getal {
		font-size: var(--t-h2);
		font-weight: 800;
		line-height: var(--lh-tight);
		color: var(--ink);
		text-decoration: none;
	}
	.kopgetal__getal:hover {
		text-decoration: underline;
	}
	/* Filled for the coalition, open for the opposition, as the seats in the hall. */
	.stip {
		width: 8px;
		height: 8px;
		border-radius: var(--r-1);
		background: var(--achter, var(--kleur));
	}
	.stip.open {
		background: var(--paper);
		box-shadow: inset 0 0 0 1.5px var(--kleur);
	}
	/* Empty and dotted, as a vacant seat in the hall. */
	.stip--leeg {
		background: transparent;
		border: 1px dashed var(--ink-3);
	}
	.verloop {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}
	.verloop svg {
		display: block;
		width: 100%;
		height: 72px;
	}
	.strook {
		position: relative;
	}
	/* The majority's name at the right end, just above its line. */
	.lijn-naam {
		position: absolute;
		right: 0;
		transform: translateY(calc(-100% - 2px));
		padding-left: var(--s-1);
		background: var(--paper);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 1;
		color: var(--ink);
		pointer-events: none;
	}
	/* Edge to edge: no seam between two stretches. */
	.stap {
		fill: var(--rule);
		shape-rendering: crispEdges;
	}
	.stap.gekozen {
		fill: var(--ink);
	}
	/* A term whose count did not add up: the step dotted, not filled. */
	.stap.onzeker {
		fill: transparent;
		stroke: var(--ink-3);
		stroke-width: 1;
		stroke-dasharray: 2 2;
		vector-effect: non-scaling-stroke;
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
		stroke: var(--ink);
		stroke-width: 2;
		vector-effect: non-scaling-stroke;
	}
	.as {
		display: flex;
		justify-content: space-between;
		gap: var(--s-3);
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
</style>

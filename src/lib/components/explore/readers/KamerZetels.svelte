<script lang="ts">
	import { fractieNaam } from '$lib/bron/menselijk';
	// The seats of a cabinet in one Kamer (concept 16, variant B; Thijs, 10 Oct): the coalition's
	// seats as the head figure, their course over the cabinet's period, then the hall on the day
	// chosen and its two sides. Every part at the column's width from its left edge (Thijs,
	// 12 Oct). Where the API has no stretches yet (the Eerste Kamer before its history is
	// filled) the hall of today, when its cabinet is this one; else a quiet line.
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import Hemicycle from '../Hemicycle.svelte';
	import ZaalTegenover from '../ZaalTegenover.svelte';
	import { indelingMarkering } from '../zaaltegenover';
	import ZaalPlaatsen from '../ZaalPlaatsen.svelte';
	import { achtergrondVan, kleurVan } from '../partijkleuren.svelte';
	import { DAY_MS, korteDatum, langeDatum, onDate, fromDate, vandaag } from '$lib/text/datum';
	import { noneHeld } from '$lib/text/coverage';
	import { capitalize } from '$lib/text/words';
	import { hallOfDay, vacantZonderFractie, wijzigingenVan, zetelHoogte } from './zetels';
	import { load } from '$lib/util/load.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import type { Schema } from '$lib/api/types';
	import type { Chamber } from '$lib/components/parliamentary/chamber';
	import Tijdas from '$lib/components/tijdlijn/Tijdas.svelte';
	import Fasen from '$lib/components/tijdlijn/Fasen.svelte';
	import { ms, periodeZin } from '$lib/components/tijdlijn/tijdas';

	type Zaal = Schema<'ParliamentSeatsResponse'>;
	type Stretch = Schema<'SeatStretchDTO'>;

	let {
		kamer,
		stretches,
		meerderheid,
		from: van,
		to: eind,
		dag,
		kabinet,
		onSelect,
		fasen = [],
		ready = $bindable(false)
	}: {
		kamer: Chamber;
		/** The cabinet's stretches in this Kamer; empty where the API has none. */
		stretches: Stretch[];
		/** The seats a majority takes (`majority` of the cabinet's seats). */
		meerderheid: number;
		/** The cabinet's first day. */
		from: string | null;
		/** Its last day, or today while it is in office. */
		to: string;
		/** The day the hall shows. */
		dag: string;
		kabinet: string;
		onSelect: (s: Stretch) => void;
		/** The cabinet's phases (demissionair and after), as on its posts. */
		fasen?: { van: string; label: string }[];
		/** Its hall has answered (or failed): the Kamers stand together once both have. */
		ready?: boolean;
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

	/**
	 * The day the hall is asked for: the day shown, within the stretch it falls in (a past
	 * cabinet's last day is its successor's first). Always with a date: only then does the
	 * hall give its vacancies (API 0.79.44, #526).
	 */
	const zaalDag = $derived.by(() => {
		const s =
			stretches.find((t) => dag >= t.from_date && dag <= (t.to_date ?? eind)) ?? stretches.at(-1);
		if (!s) return vandaag();
		const tot = s.to_date ?? eind;
		return dag < s.from_date ? s.from_date : dag > tot ? tot : dag;
	});
	const hall = load(
		() => ({ day: zaalDag, withStretches: stretches.length > 0, chamber: kamer, cabinet: kabinet }),
		(k) => hallOfDay(k.chamber, k.day, k.cabinet, k.withStretches),
		'Zaal van het kabinet'
	);
	/** The hall of the day, once it is in; null where the data has none for it. */
	const zaal = $derived(hall.state.status === 'ready' ? hall.state.data : null);
	$effect(() => {
		ready = hall.state.status !== 'loading';
	});

	const gekozen = $derived(
		stretches.find((s) => dag >= s.from_date && dag <= (s.to_date ?? eind)) ??
			stretches.at(-1) ??
			null
	);

	/**
	 * Of this cabinet's coalition, per fractie: from the stretch of the day (on a cabinet's last
	 * day the hall's own `coalition` is already the next cabinet's), else from the hall.
	 */
	const vanKabinet = (stretch: Stretch | null) => {
		const m = stretch?.factions ? new Map(stretch.factions.map((f) => [f.key, f.coalition])) : null;
		return (f: Zaal['factions'][number]) =>
			m && f.key ? (m.get(f.key) ?? null) : (f.coalition ?? null);
	};
	const kantVan = (z: Zaal, stretch: Stretch | null) => {
		const c = vanKabinet(stretch);
		return Object.fromEntries(
			z.factions.map((f) => [
				f.key ?? naam(f),
				c(f) === true ? 'voor' : c(f) === false ? 'tegen' : 'other'
			])
		) as Record<string, 'voor' | 'tegen' | 'other'>;
	};
	const naam = (f: { key?: string | null; abbreviation?: string | null; name?: string | null }) =>
		fractieNaam(f);
	type Rij = { key: string; naam: string; seats: number; vacant: number; color: string | null };
	/**
	 * The two sides as the head figure counts them (UX test 10 Oct, #12: "41" above, "37" in
	 * the list): from the stretch, its fracties' seats with their vacancies; the hall gives the
	 * colours. Without a stretch, from the hall.
	 */
	const zijden = (z: Zaal, stretch: Stretch | null) => {
		const kleur = new Map(z.factions.map((f) => [f.key, f.color ?? null]));
		const rijen: (Rij & { ja: boolean | null })[] = stretch?.factions?.length
			? stretch.factions.map((f) => ({
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
		const los = stretch ? vacantZonderFractie(stretch) : 0;
		return { ja, nee, jaZetels: som(ja), los };
	};

	/** The seats of the Kamer (Grondwet art. 51): the stretches' sums run over it on a day a
	 *  seat changes hands (Schoof, 25 July 2025: 152). */
	const zetelsVanKamer = $derived(kamer === 'TK' ? 150 : 75);
	/** The head figure: the coalition's seats on the day, of the Kamer's, and its vacant ones. */
	const kop = $derived.by(() => {
		if (gekozen)
			return {
				ja: gekozen.coalition,
				totaal: zetelsVanKamer,
				vacant: gekozen.coalition_vacant ?? 0
			};
		if (zaal) return { ja: zijden(zaal, null).jaZetels, totaal: zetelsVanKamer, vacant: 0 };
		return null;
	});

	// The step line: the coalition's seats over the period, the majority as a line.
	const W = 600;
	// On a touch screen a step is often narrower than a finger: there the strip is the one
	// target and a tap takes the step under it; with a mouse and the keys each step is a button.
	const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
	function pickAt(e: MouseEvent) {
		const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const x = ((e.clientX - box.left) / box.width) * W;
		const k = stappen.find((t) => x >= t.x0 && x < t.x1) ?? stappen.at(-1);
		if (k) onSelect(k.s);
	}
	const H = 72;
	const PAD = 0;
	const dagNr = (d: string) => Date.parse(`${d}T00:00:00Z`) / DAY_MS;
	// The Kamer's whole scale, none to all its seats: the majority at its true height.
	const schaal = (n: number) => zetelHoogte(n, zetelsVanKamer, H, PAD);
	const stappen = $derived.by(() => {
		if (!van || stretches.length < 2) return [];
		const a = dagNr(van);
		const b = Math.max(dagNr(eind) + 1, a + 1);
		const x = (d: string) => ((dagNr(d) - a) / (b - a)) * W;
		const dagBreed = W / (b - a);
		return stretches.map((s) => {
			const x0 = Math.max(0, x(s.from_date));
			const tot = s.to_date && s.to_date < eind ? s.to_date : eind;
			// A stretch of one day stays wide enough to see and to point at.
			const x1 = Math.max(x(tot) + dagBreed, x0 + 6);
			return { s, x0, x1, y: schaal(s.coalition) };
		});
	});
	const yMeerderheid = $derived(schaal(meerderheid));
	/** A count that did not add up is marked once, with the count. */
	const onzekerWoord = (s: Stretch) => (s.checked === false ? ' (onzeker)' : '');
	const wijzigingen = $derived(gekozen ? wijzigingenVan(gekozen) : []);
	/** `66 zetels, 2 sep. 2026 tot 10 okt. 2026.`, or `24 zetels, … (onzeker).` */
	const stapZin = (s: Stretch) =>
		`${s.coalition} zetels, ${
			s.to_date === s.from_date ? korteDatum(s.from_date) : periodeZin(s.from_date, s.to_date)
		}${onzekerWoord(s)}.`;
	/** The axis: the one of the posts (Tijdas), under the steps. */
	const as = $derived(
		van
			? {
					periode: { van: ms(van), tot: ms(eind) + DAY_MS, lopend: eind === vandaag() },
					begin: korteDatum(van),
					eind: eind === vandaag() ? 'nu' : korteDatum(eind)
				}
			: null
	);
	const fasePlek = $derived(
		as
			? fasen
					.map((f) => ({
						at: (ms(f.van) - as.periode.van) / (as.periode.tot - as.periode.van),
						label: f.label
					}))
					.filter((f) => f.at > 0 && f.at < 1)
			: []
	);
</script>

{#snippet meerderheidWoord(n: number)}{n >= meerderheid
		? 'meerderheid'
		: 'geen meerderheid'}{/snippet}

<!-- Open, not folded: the two Kamers stand side by side, seen at a glance (Thijs, 23 Oct, A190). -->
<Sectie title={titel} inklapbaar={false}>
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
				{#if fasePlek.length}<Fasen fasen={fasePlek} />{/if}
				<div class="strook">
					{#each fasePlek as f (f.at)}<span
							class="fase-lijn"
							style:left="{f.at * 100}%"
							aria-hidden="true"
						></span>{/each}
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
					<svg
						viewBox="0 0 {W} {H}"
						preserveAspectRatio="none"
						onclick={coarse ? pickAt : undefined}
						role="group"
						aria-label="Zetels van de coalitie in de {kamer === 'TK'
							? 'Tweede'
							: 'Eerste'} Kamer, met een lijn op de meerderheid van {meerderheid}"
					>
						<!-- The whole Kamer, none to all its seats: the frame the majority stands in. -->
						<rect x="0" y="0" width={W} height={H} class="vlak" />
						{#each stappen as k (k.s.from_date)}
							<rect
								x={k.x0}
								y={k.y}
								width={k.x1 - k.x0}
								height={H - PAD - k.y}
								class="stap"
								class:is-active={gekozen === k.s}
								class:onzeker={k.s.checked === false}
							/>
						{/each}
						<!-- The majority over the steps, so a coalition above it does not hide it. -->
						<line x1="0" x2={W} y1={yMeerderheid} y2={yMeerderheid} class="lijn" />
						{#if !coarse}
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
									aria-label="{k.s.coalition} zetels, {langeDatum(k.s.from_date)}{onzekerWoord(
										k.s
									)}"
									onclick={() => onSelect(k.s)}
									onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(k.s)}
									><title>{k.s.coalition} zetels {fromDate(k.s.from_date)}{onzekerWoord(k.s)}</title
									></rect
								>
							{/each}
						{/if}
					</svg>
					<!-- The majority named at its line, not in a sentence under it (UX-toets 10 Oct, #17). -->
					<span class="lijn-naam" style:top="{(yMeerderheid / H) * 100}%" aria-hidden="true"
						>meerderheid {meerderheid}</span
					>
				</div>
				<!-- The period's ends under its ends; what the strip shows as a caption at the left
				     edge, as under the hall. -->
				{#if as}
					<Tijdas periode={as.periode} from={as.begin} to={as.eind} plaats="onder" />
				{/if}
				{#if gekozen}
					<p class="onderschrift">
						<b>{stapZin(gekozen)}</b>{#each wijzigingen as w, i (i)}{i ? '; ' : ' '}<span
								class="wijziging">{w.woorden ?? w.soort}</span
							>{#if w.wie}{` ${w.wie}`}{/if}{/each}{wijzigingen.length ? '.' : ''}
					</p>
				{/if}
			</div>
		{/if}

		{#if hall.state.status !== 'ready'}
			<LoadState state={hall.state} what="De zaal" retry={hall.retry} />
		{:else if !zaal}
			<p class="onderschrift">
				{stretches.length
					? `${capitalize(noneHeld('samenstelling'))} ${onDate(dag)}.`
					: `Geen samenstelling van de ${kamer === 'TK' ? 'Tweede' : 'Eerste'} Kamer voor dit kabinet in de gegevens.`}
			</p>
		{:else}
			{@const z = zijden(zaal, gekozen)}
			<!-- A hall drawn by fractie says so beside its date (zaaltegenover.ts). -->
			{@const markering = indelingMarkering(zaal)}
			<figure class="kamer">
				<p class="onderschrift">
					Samenstelling {onDate(zaal.as_of ?? dag)}.{markering ? ` ${markering}.` : ''}
				</p>
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
					{#each [['Coalitie', z.ja], ['Oppositie', z.nee]] as const as [kopje, lijst] (kopje)}
						<div class="zijde" class:zijde--lang={lijst.length > 6}>
							<h4>{kopje}</h4>
							<ol>
								{#each lijst as f (f.key)}
									<li>
										<span
											class="stip"
											class:is-hollow={kopje === 'Oppositie'}
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
		font-weight: 600;
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
	/* Both halls in the box of the Tweede Kamer's (440 by 291): one scale, one height, and
	   the column's width, as the course above and the sides below (Thijs, 12 Oct: one edge,
	   one measure for every part of the section). */
	.zaal :global(svg),
	.zaal :global(.hemicycle svg) {
		display: block;
		width: 100%;
		height: auto;
		max-height: none;
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
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink);
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
		font-weight: 600;
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
	.stip.is-hollow {
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
		padding: 0 var(--s-1);
		background: var(--paper-2);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 1;
		color: var(--ink);
		pointer-events: none;
	}
	.vlak {
		fill: var(--paper-2);
	}
	/* Edge to edge: no seam between two stretches. */
	.stap {
		fill: var(--rule);
		shape-rendering: crispEdges;
	}
	.stap.is-active {
		fill: var(--ink);
	}
	/* A term whose count did not add up: the step filled as any, its edge dotted. */
	.stap.onzeker {
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
	.fase-lijn {
		position: absolute;
		top: 0;
		bottom: 0;
		border-left: 1px dotted var(--rule-strong);
		pointer-events: none;
	}
</style>

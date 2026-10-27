<script lang="ts">
	// The tijdstrook under the canvas of the werkplek (Design System, Tijdstrook): the years from
	// the first bron on the canvas to the last, one stacked bar per year in the colours of the
	// kinds, on a scale relative to the busiest year in view; a wetswijziging is a diamond over
	// the bar of its year. A drag over the band, or a tap on a year, chooses the period, which the
	// bronfilter holds (?van, ?tot); a tap on the one year chosen gives every year back. The
	// grips are sliders: the keyboard chooses the period without dragging. At the left the
	// period in words (a tap opens the date fields), the count per kind and the quick choices.
	// A phone shows the strip small at rest; a tap opens a Blad with grips of 44 px.
	import { MediaQuery } from 'svelte/reactivity';
	import {
		STRIP_KINDS,
		CHANGE_COLOUR,
		busiest,
		countParts,
		inPeriod,
		perYear,
		type Stip
	} from '$lib/bron/strook';
	import { vandaag } from '$lib/text/datum';
	import { periodInWords } from '$lib/text/periode';
	import Blad from '$lib/components/ui/Blad.svelte';
	import Periode from '$lib/components/ui/Periode.svelte';
	import TijdstrookAs from './TijdstrookAs.svelte';

	let {
		stippen,
		zonderJaar = 0,
		van,
		tot,
		vanDag = null,
		totDag = null,
		onPeriode,
		onDagen
	}: {
		/** Each bron on the canvas with a date: its year as a fraction, its kind. */
		stippen: readonly Stip[];
		/** The bronnen on the canvas without a date; counted, never placed. */
		zonderJaar?: number;
		/** The period chosen, by its years; null where open. */
		van: number | null;
		tot: number | null;
		/** The period as days, as the address holds it (for the date fields). */
		vanDag?: string | null;
		totDag?: string | null;
		onPeriode: (van: number | null, tot: number | null) => void;
		/** A period chosen by days, in the date fields. */
		onDagen?: (van: string, tot: string) => void;
	} = $props();

	const telefoon = new MediaQuery('max-width: 768px');
	const today = vandaag();

	const eerste = $derived(Math.floor(Math.min(...stippen.map((s) => s.jaar))));
	const laatste = $derived(Math.floor(Math.max(...stippen.map((s) => s.jaar))));
	/** The years the band spans: the last one whole. */
	const span = $derived(laatste - eerste + 1);
	const plek = (jaar: number) => ((jaar - eerste) / span) * 100;
	const jaren = $derived(perYear(stippen, eerste, laatste));
	const drukste = $derived(busiest(jaren));

	let band = $state<HTMLElement | null>(null);
	let drag = $state<{ van: number; tot: number } | null>(null);
	const jaarOp = (e: PointerEvent) => {
		const r = band?.getBoundingClientRect();
		if (!r || r.width === 0) return eerste;
		const f = Math.min(0.9999, Math.max(0, (e.clientX - r.left) / r.width));
		return eerste + Math.floor(f * span);
	};
	function neer(e: PointerEvent) {
		band?.setPointerCapture(e.pointerId);
		const j = jaarOp(e);
		const handle = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-greep]')?.dataset
			.greep;
		// A grip moves its own end of the period; the other end stays.
		if (handle && keuze)
			drag =
				handle === 'van' ? { van: keuze.tot, tot: keuze.van } : { van: keuze.van, tot: keuze.tot };
		else drag = { van: j, tot: j };
		hover = null;
	}
	function beweeg(e: PointerEvent) {
		if (drag) drag = { ...drag, tot: jaarOp(e) };
		else if (e.pointerType === 'mouse') hover = jaarOp(e);
	}
	function op() {
		const s = drag;
		drag = null;
		if (!s) return;
		const a = Math.min(s.van, s.tot);
		const b = Math.max(s.van, s.tot);
		if (a === b && van === a && tot === a) onPeriode(null, null);
		else onPeriode(a, b);
	}
	/** What stands chosen: the drag under way, else the period of the address. */
	const keuze = $derived(
		drag
			? { van: Math.min(drag.van, drag.tot), tot: Math.max(drag.van, drag.tot) }
			: van !== null || tot !== null
				? { van: van ?? eerste, tot: tot ?? laatste }
				: null
	);
	/** The end the pointer holds in a drag: the grip that is filled. */
	const dragHandle = $derived(drag ? (drag.tot < drag.van ? 'van' : 'tot') : null);
	const gekozen = $derived({ van: keuze?.van ?? eerste, tot: keuze?.tot ?? laatste });

	// The keyboard: a grip is a slider; arrows a year, Page Up and Down five, Home and End the ends.
	function zet(a: number, b: number) {
		if (a <= eerste && b >= laatste) onPeriode(null, null);
		else onPeriode(a, b);
	}
	function toets(e: KeyboardEvent, kant: 'van' | 'tot') {
		const stap: Record<string, number> = {
			ArrowLeft: -1,
			ArrowDown: -1,
			ArrowRight: 1,
			ArrowUp: 1,
			PageDown: -5,
			PageUp: 5
		};
		const nu = gekozen[kant];
		const naar = e.key === 'Home' ? eerste : e.key === 'End' ? laatste : nu + (stap[e.key] ?? NaN);
		if (Number.isNaN(naar)) return;
		e.preventDefault();
		const jaar = Math.min(laatste, Math.max(eerste, naar));
		if (kant === 'van') zet(Math.min(jaar, gekozen.tot), gekozen.tot);
		else zet(gekozen.van, Math.max(jaar, gekozen.van));
		hover = jaar;
	}

	// What the hover or the focus on a year shows: the count per kind of that year.
	let hover = $state<number | null>(null);
	const kaartJaar = $derived(hover === null ? null : jaren[hover - eerste]);

	// The count of the period, in words; the bronnen without a year stand in it, never placed.
	const periode = $derived(inPeriod(jaren, gekozen.van, gekozen.tot));
	const delen = $derived([
		...countParts(periode.per, periode.changes),
		...(zonderJaar ? [{ text: `${zonderJaar} zonder jaar` }] : [])
	]);
	const woorden = $derived(
		vanDag || totDag ? periodInWords(vanDag ?? '', totDag ?? '', today) : `${eerste} tot ${laatste}`
	);
	const wijzigingsJaar = $derived(jaren.findLast((y) => y.wijzigingen.length > 0)?.jaar ?? null);

	// The quick choices; "Sinds…" opens the date fields.
	const vijf = $derived(laatste - 4);
	const heeftTot = $derived(totDag !== null || tot !== null);
	const staat = $derived({
		alle: !keuze,
		vijf: !!keuze && !heeftTot && gekozen.van === vijf,
		wijziging: !!keuze && !heeftTot && wijzigingsJaar !== null && gekozen.van === wijzigingsJaar
	});
	const eigen = $derived(!!keuze && !staat.vijf && !staat.wijziging);
	let periodeVelden = $state<{ toon: (at: HTMLElement) => void } | null>(null);
	let woordenKnop = $state<HTMLButtonElement | null>(null);
	let sindsKnop = $state<HTMLButtonElement | null>(null);
	let blad = $state(false);
	const velden = (at: HTMLElement | null) => at && periodeVelden?.toon(at);
</script>

{#snippet ruit()}<i class="ruit" aria-hidden="true" style:background={CHANGE_COLOUR}></i>{/snippet}

{#snippet telling()}
	<p class="telling" aria-live="polite">
		{#each delen as d, i (d.text)}<span
				>{#if 'change' in d && d.change}{@render ruit()}{/if}{d.text}{i < delen.length - 1
					? ', '
					: ''}</span
			>{/each}
	</p>
{/snippet}

{#snippet snelkeuzes()}
	<div class="snel" role="group" aria-label="Snelkeuze">
		<button
			type="button"
			class="btn"
			aria-pressed={staat.alle}
			onclick={() => onPeriode(null, null)}>Alle jaren</button
		>
		{#if span > 5}
			<button
				type="button"
				class="btn"
				aria-pressed={staat.vijf}
				onclick={() => onPeriode(vijf, null)}>5 jaar</button
			>
		{/if}
		{#if wijzigingsJaar !== null}
			<button
				type="button"
				class="btn"
				aria-pressed={staat.wijziging}
				onclick={() => onPeriode(wijzigingsJaar, null)}
				>Sinds {@render ruit()}de wijziging van {wijzigingsJaar}</button
			>
		{/if}
		<button
			type="button"
			class="btn"
			aria-pressed={eigen}
			aria-haspopup="dialog"
			bind:this={sindsKnop}
			onclick={() => velden(sindsKnop)}>Sinds…</button
		>
	</div>
{/snippet}

{#snippet tekening(groot: boolean)}
	<div class="grafiek" class:is-groot={groot}>
		{#if kaartJaar && !telefoon.current}
			<div
				class="kaart"
				style:left="clamp(0px, calc({plek(kaartJaar.jaar + 0.5)}% - 92px), calc(100% - 184px))"
			>
				<p class="kaart-kop">{kaartJaar.jaar}</p>
				{#each kaartJaar.delen.filter((d) => d.n > 0) as d (d.id)}
					{@const k = STRIP_KINDS.find((s) => s.id === d.id)!}
					<p class="kaart-rij">
						<i class="teken" style:background={k.colour}></i>{d.n}
						{d.n === 1 ? k.one : k.many}
					</p>
				{/each}
				{#each kaartJaar.wijzigingen as w (w)}
					<p class="kaart-rij">{@render ruit()}{w}</p>
				{/each}
				{#if kaartJaar.total === 0 && kaartJaar.wijzigingen.length === 0}
					<p class="kaart-rij leeg-rij">Geen bronnen met een datum</p>
				{/if}
			</div>
		{/if}
		<div
			class="band"
			role="group"
			aria-label="Periode kiezen"
			bind:this={band}
			onpointerdown={neer}
			onpointermove={beweeg}
			onpointerup={op}
			onpointerleave={() => (hover = null)}
			onpointercancel={() => (drag = null)}
		>
			{#if keuze}
				<span
					class="keuze"
					style:left="{plek(Math.max(eerste, keuze.van))}%"
					style:right="{100 - plek(Math.min(laatste, keuze.tot) + 1)}%"
				></span>
			{/if}
			<div class="kolommen" aria-hidden="true">
				{#each jaren as y (y.jaar)}
					<div
						class="kolom"
						class:is-dim={!!keuze && (y.jaar < keuze.van || y.jaar > keuze.tot)}
						style:--f={y.total / drukste}
					>
						{#if y.wijzigingen.length}<i
								class="ruit op-staaf"
								data-wijziging
								style:background={CHANGE_COLOUR}
							></i>{/if}
						{#if y.total}
							<div class="staaf">
								{#each y.delen as d (d.id)}
									{#if d.n}<i
											class="deel"
											style:flex-grow={d.n}
											style:background={STRIP_KINDS.find((k) => k.id === d.id)!.colour}
										></i>{/if}
								{/each}
							</div>
						{:else}<i class="leeg"></i>{/if}
					</div>
				{/each}
			</div>
			{#each ['van', 'tot'] as kant (kant)}
				{@const k = kant as 'van' | 'tot'}
				<span
					class="greep"
					class:is-los={!keuze}
					class:is-resizing={drag && dragHandle === k}
					data-greep={k}
					role="slider"
					tabindex="0"
					aria-label={k === 'van' ? 'Van' : 'Tot'}
					aria-valuemin={eerste}
					aria-valuemax={laatste}
					aria-valuenow={gekozen[k]}
					aria-valuetext={k === 'tot' && !keuze ? 'nu' : undefined}
					style:left="{k === 'van'
						? plek(Math.max(eerste, gekozen.van))
						: plek(Math.min(laatste, gekozen.tot) + 1)}%"
					onkeydown={(e) => toets(e, k)}
					onfocus={() => (hover = gekozen[k])}
					onblur={() => (hover = null)}
				></span>
			{/each}
		</div>
		<TijdstrookAs {eerste} {laatste} {van} {tot} />
	</div>
{/snippet}

{#if stippen.length > 1 && span > 1}
	<div class="tijdstrook" class:is-resizing={!!drag} class:is-rust={telefoon.current}>
		{#if telefoon.current}
			<button
				type="button"
				class="rust"
				aria-haspopup="dialog"
				aria-label="Periode, {woorden}. Wijzig"
				onclick={() => (blad = true)}
			>
				<span class="kop">{woorden}</span>
				<span class="micro">{delen.map((d) => d.text).join(', ')}</span>
				<span class="mini" aria-hidden="true">
					<span class="kolommen">
						{#each jaren as y (y.jaar)}
							<span
								class="kolom"
								class:is-dim={!!keuze && (y.jaar < keuze.van || y.jaar > keuze.tot)}
								style:--f={y.total / drukste}
							>
								{#if y.total}
									<span class="staaf">
										{#each y.delen as d (d.id)}{#if d.n}<i
													class="deel"
													style:flex-grow={d.n}
													style:background={STRIP_KINDS.find((k) => k.id === d.id)!.colour}
												></i>{/if}{/each}
									</span>
								{:else}<i class="leeg"></i>{/if}
							</span>
						{/each}
					</span>
				</span>
				<TijdstrookAs {eerste} {laatste} {van} {tot} uiteinden />
			</button>
		{:else}
			<div class="kopblok">
				<button
					type="button"
					class="kop woorden"
					aria-haspopup="dialog"
					bind:this={woordenKnop}
					onclick={() => velden(woordenKnop)}>{woorden}</button
				>
				{@render telling()}
				{@render snelkeuzes()}
			</div>
			{@render tekening(false)}
		{/if}
	</div>
	{#if blad}
		<Blad title="Periode" aboveTabbar onClose={() => (blad = false)}>
			<div class="blad">
				<button
					type="button"
					class="kop woorden"
					aria-haspopup="dialog"
					bind:this={woordenKnop}
					onclick={() => velden(woordenKnop)}>{woorden}</button
				>
				{@render telling()}
				{@render tekening(true)}
				{@render snelkeuzes()}
			</div>
		</Blad>
	{/if}
	<Periode
		bind:this={periodeVelden}
		zonderKnop
		from={vanDag ?? ''}
		to={totDag ?? ''}
		onChange={(a, b) => onDagen?.(a, b)}
	/>
{/if}

<style>
	.tijdstrook {
		flex: none;
		display: grid;
		grid-template-columns: minmax(0, 17rem) minmax(0, 1fr);
		column-gap: var(--s-5);
		align-items: end;
		padding: var(--s-2) var(--s-5);
		border-top: 1px solid var(--rule);
		background: var(--paper);
		user-select: none;
	}
	.kopblok {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		min-width: 0;
		align-self: stretch;
		justify-content: space-between;
	}
	.kop {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		line-height: 1.2;
		color: var(--ink);
	}
	.woorden {
		align-self: flex-start;
		padding: 0;
		border: 0;
		background: none;
		text-align: left;
		cursor: pointer;
		text-decoration: underline;
		text-decoration-color: var(--rule);
		text-underline-offset: 3px;
	}
	.telling,
	.micro {
		margin: 0;
		font-size: var(--t-note);
		line-height: 1.3;
		color: var(--ink-3);
	}
	.snel {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--s-3);
	}
	.snel .btn {
		min-height: var(--tik-h);
		padding: 0;
		border: 0;
		border-bottom: 2px solid transparent;
		border-radius: 0;
		background: none;
		font-size: var(--t-ui);
		color: var(--ink-2);
	}
	.snel .btn[aria-pressed='true'] {
		border-bottom-color: var(--ink);
		color: var(--ink);
	}
	/* A wetswijziging: a diamond in the colour of the wetten. */
	.ruit {
		display: inline-block;
		flex: none;
		width: 7px;
		height: 7px;
		margin-right: var(--s-1);
		transform: rotate(45deg) scale(0.85);
	}
	.grafiek {
		position: relative;
		min-width: 0;
		--band-h: 44px;
	}
	.grafiek.is-groot {
		--band-h: 64px;
	}
	.kaart {
		position: absolute;
		z-index: 2;
		bottom: calc(100% + var(--s-1));
		width: 184px;
		box-sizing: border-box;
		padding: var(--s-2) var(--s-3);
		border-radius: var(--r-2);
		background: var(--paper);
		box-shadow: var(--shadow-pop);
		pointer-events: none;
	}
	.kaart-kop,
	.kaart-rij {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin: 0;
		font-size: var(--t-note);
		line-height: 1.5;
		color: var(--ink-2);
	}
	.kaart-kop {
		font-family: var(--font-serif);
		font-weight: 600;
		color: var(--ink);
	}
	.kaart .ruit {
		margin-right: 0;
	}
	.leeg-rij {
		color: var(--ink-3);
	}
	.teken {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: var(--r-1);
	}
	.band {
		position: relative;
		height: var(--band-h);
		--hoog: calc(var(--band-h) - 10px);
		border-radius: var(--r-1);
		background: var(--paper-2);
		cursor: col-resize;
		touch-action: none;
	}
	.keuze {
		position: absolute;
		top: 0;
		bottom: 0;
		background: var(--paper);
	}
	.is-resizing .keuze {
		border: 1px dashed var(--ink-2);
	}
	/* The bars end at the base of the band: the years are named below it, never over a bar. */
	.kolommen {
		position: absolute;
		inset: 0;
		display: flex;
		overflow: hidden;
		border-radius: var(--r-1);
	}
	.kolom {
		position: relative;
		flex: 1 1 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		pointer-events: none;
	}
	.staaf {
		display: flex;
		flex-direction: column-reverse;
		gap: 1px;
		width: 70%;
		min-width: 2px;
		max-width: 14px;
		height: calc(var(--hoog) * var(--f));
		min-height: 2px;
	}
	.deel {
		flex-basis: 0;
		min-height: 2px;
	}
	.leeg {
		width: 6px;
		height: 1px;
		background: var(--rule);
	}
	.kolom.is-dim .deel {
		background: var(--rule) !important;
	}
	.op-staaf {
		position: absolute;
		bottom: calc(var(--hoog) * var(--f) + 3px);
		left: 50%;
		margin: -3px 0 0 -3px;
	}
	.kolom:not(:has(.staaf)) .op-staaf {
		bottom: 3px;
	}
	.kolom.is-dim .ruit {
		background: var(--rule) !important;
	}
	.greep {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 3px;
		margin-left: -1.5px;
		background: var(--ink);
		cursor: ew-resize;
	}
	.greep.is-los {
		opacity: 0;
	}
	/* In the Blad the grips are there to take, at the ends, period or not. */
	.is-groot .greep.is-los {
		opacity: 1;
	}
	.greep.is-los:focus-visible {
		opacity: 1;
	}
	.greep:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
	.greep::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: 8px;
		height: 22px;
		transform: translate(-50%, -50%);
		box-sizing: border-box;
		border: 1.5px solid var(--ink);
		border-radius: var(--r-1);
		background: var(--paper);
	}
	.greep.is-resizing {
		width: 4px;
		margin-left: -2px;
	}
	.greep.is-resizing::after {
		background: var(--ink);
	}
	/* On touch the grip is a target of 44 px across the band. */
	@media (pointer: coarse), (max-width: 768px) {
		.greep::before {
			content: '';
			position: absolute;
			inset: 0 calc((var(--veld-h-raak) - 3px) / -2);
		}
	}
	/* A phone at rest: the period, its count and the small bars in one tap target. */
	.is-rust {
		display: block;
		padding: var(--s-1) var(--s-4);
	}
	.rust {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		column-gap: var(--s-2);
		align-items: baseline;
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		text-align: left;
		font: inherit;
	}
	.rust .kop {
		font-size: 13px;
	}
	.rust .micro {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: var(--t-label);
	}
	.rust .mini {
		grid-column: 1 / -1;
		display: block;
		position: relative;
		height: 20px;
		margin-top: var(--s-1);
		border-radius: var(--r-1);
		background: var(--paper-2);
		--hoog: 16px;
	}
	.rust .mini .kolommen {
		display: flex;
	}
	.rust :global(.as) {
		grid-column: 1 / -1;
		height: 12px;
		margin-top: var(--s-1);
	}
	.rust :global(.as span) {
		font-size: var(--t-label);
	}
	.blad {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		padding: var(--s-2) var(--s-4) var(--s-4);
	}
	.blad .snel .btn {
		min-height: var(--veld-h-raak);
	}
	.blad .woorden {
		min-height: var(--veld-h-raak);
	}
</style>

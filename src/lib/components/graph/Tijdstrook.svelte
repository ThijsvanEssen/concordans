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
		undatedText,
		sumPeriod,
		perYear,
		type Stip
	} from '$lib/bron/strook';
	import type { Collection } from '$lib/vocabulary';
	import { vandaag } from '$lib/text/datum';
	import { periodInWords } from '$lib/text/periode';
	import Blad from '$lib/components/ui/Blad.svelte';
	import Periode from '$lib/components/ui/Periode.svelte';
	import TijdstrookAs from './TijdstrookAs.svelte';

	let {
		stippen,
		undated = [],
		van,
		tot,
		fromDay = null,
		toDay = null,
		onPeriode,
		onDays
	}: {
		/** Each bron on the canvas with a date: its year as a fraction, its kind. */
		stippen: readonly Stip[];
		/** The bronnen on the canvas without a date, by collection; counted, never placed. */
		undated?: readonly Collection[];
		/** The period chosen, by its years; null where open. */
		van: number | null;
		tot: number | null;
		/** The period as days, as the address holds it (for the date fields). */
		fromDay?: string | null;
		toDay?: string | null;
		onPeriode: (van: number | null, tot: number | null) => void;
		/** A period chosen by days, in the date fields. */
		onDays?: (van: string, tot: string) => void;
	} = $props();

	const phone = new MediaQuery('max-width: 768px');
	const today = vandaag();

	const first = $derived(Math.floor(Math.min(...stippen.map((s) => s.jaar))));
	const last = $derived(Math.floor(Math.max(...stippen.map((s) => s.jaar))));
	/** The years the band spans: the last one whole. */
	const span = $derived(last - first + 1);
	const plek = (jaar: number) => ((jaar - first) / span) * 100;
	const years = $derived(perYear(stippen, first, last));
	const busiestYear = $derived(busiest(years));

	let band = $state<HTMLElement | null>(null);
	let drag = $state<{ van: number; tot: number } | null>(null);
	const yearAt = (e: PointerEvent) => {
		const r = band?.getBoundingClientRect();
		if (!r || r.width === 0) return first;
		const f = Math.min(0.9999, Math.max(0, (e.clientX - r.left) / r.width));
		return first + Math.floor(f * span);
	};
	function neer(e: PointerEvent) {
		band?.setPointerCapture(e.pointerId);
		const j = yearAt(e);
		const handle = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-greep]')?.dataset
			.greep;
		// A grip moves its own end of the period; the other end stays.
		if (handle && chosen)
			drag =
				handle === 'van'
					? { van: chosen.tot, tot: chosen.van }
					: { van: chosen.van, tot: chosen.tot };
		else drag = { van: j, tot: j };
		hover = null;
	}
	function beweeg(e: PointerEvent) {
		if (drag) drag = { ...drag, tot: yearAt(e) };
		else if (e.pointerType === 'mouse') hover = yearAt(e);
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
	const chosen = $derived(
		drag
			? { van: Math.min(drag.van, drag.tot), tot: Math.max(drag.van, drag.tot) }
			: van !== null || tot !== null
				? { van: van ?? first, tot: tot ?? last }
				: null
	);
	/** The end the pointer holds in a drag: the grip that is filled. */
	const dragHandle = $derived(drag ? (drag.tot < drag.van ? 'van' : 'tot') : null);
	const range = $derived({ van: chosen?.van ?? first, tot: chosen?.tot ?? last });

	// The keyboard: a grip is a slider; arrows a year, Page Up and Down five, Home and End the ends.
	function setRange(a: number, b: number) {
		if (a <= first && b >= last) onPeriode(null, null);
		else onPeriode(a, b);
	}
	function onKey(e: KeyboardEvent, side: 'van' | 'tot') {
		const steps: Record<string, number> = {
			ArrowLeft: -1,
			ArrowDown: -1,
			ArrowRight: 1,
			ArrowUp: 1,
			PageDown: -5,
			PageUp: 5
		};
		const nu = range[side];
		const target = e.key === 'Home' ? first : e.key === 'End' ? last : nu + (steps[e.key] ?? NaN);
		if (Number.isNaN(target)) return;
		e.preventDefault();
		const jaar = Math.min(last, Math.max(first, target));
		if (side === 'van') setRange(Math.min(jaar, range.tot), range.tot);
		else setRange(range.van, Math.max(jaar, range.van));
		hover = jaar;
	}

	// What the hover or the focus on a year shows: the count per kind of that year.
	let hover = $state<number | null>(null);
	const cardYear = $derived(hover === null ? null : years[hover - first]);

	// The count of the period, in words; the bronnen without a year stand in it, never placed.
	const counts = $derived(sumPeriod(years, range.van, range.tot));
	const undatedWords = $derived(undatedText(undated));
	const parts = $derived([
		...countParts(counts.per, counts.changes),
		...(undatedWords ? [{ text: undatedWords }] : [])
	]);
	const words = $derived(
		fromDay || toDay ? periodInWords(fromDay ?? '', toDay ?? '', today) : `${first} tot ${last}`
	);
	const changeYear = $derived(years.findLast((y) => y.changes.length > 0)?.jaar ?? null);

	// The quick choices; "Sinds…" opens the date fields.
	const five = $derived(last - 4);
	const hasTo = $derived(toDay !== null || tot !== null);
	const pressed = $derived({
		all: !chosen,
		five: !!chosen && !hasTo && range.van === five,
		change: !!chosen && !hasTo && changeYear !== null && range.van === changeYear
	});
	const custom = $derived(!!chosen && !pressed.five && !pressed.change);
	let dateFields = $state<{ openAt: (at: HTMLElement) => void } | null>(null);
	let wordsButton = $state<HTMLButtonElement | null>(null);
	let sinceButton = $state<HTMLButtonElement | null>(null);
	let blad = $state(false);
	const openFields = (at: HTMLElement | null) => at && dateFields?.openAt(at);
</script>

{#snippet ruit()}<i class="ruit" aria-hidden="true" style:background={CHANGE_COLOUR}></i>{/snippet}

{#snippet telling()}
	<p class="telling" aria-live="polite">
		{#each parts as d, i (d.text)}<span
				>{#if 'change' in d && d.change}{@render ruit()}{/if}{d.text}{i < parts.length - 1
					? ', '
					: ''}</span
			>{/each}
	</p>
{/snippet}

{#snippet snelkeuzes()}
	<div class="snel" role="group" aria-label="Snelkeuze">
		<button
			type="button"
			class="btn is-text"
			aria-pressed={pressed.all}
			onclick={() => onPeriode(null, null)}>Alle jaren</button
		>
		{#if span > 5}
			<button
				type="button"
				class="btn is-text"
				aria-pressed={pressed.five}
				onclick={() => onPeriode(five, null)}>5 jaar</button
			>
		{/if}
		{#if changeYear !== null}
			<button
				type="button"
				class="btn is-text"
				aria-pressed={pressed.change}
				onclick={() => onPeriode(changeYear, null)}
				>Sinds {@render ruit()}de wijziging van {changeYear}</button
			>
		{/if}
		<button
			type="button"
			class="btn is-text"
			aria-pressed={custom}
			aria-haspopup="dialog"
			bind:this={sinceButton}
			onclick={() => openFields(sinceButton)}>Sinds…</button
		>
	</div>
{/snippet}

{#snippet tekening(groot: boolean)}
	<div class="grafiek" data-groot={groot || undefined}>
		{#if cardYear && !phone.current}
			<div
				class="kaart"
				style:left="clamp(0px, calc({plek(cardYear.jaar + 0.5)}% - 92px), calc(100% - 184px))"
			>
				<p class="kaart-kop">{cardYear.jaar}</p>
				{#each cardYear.parts.filter((d) => d.n > 0) as d (d.id)}
					{@const k = STRIP_KINDS.find((s) => s.id === d.id)!}
					<p class="kaart-rij">
						<i class="teken" style:background={k.colour}></i>{d.n}
						{d.n === 1 ? k.one : k.many}
					</p>
				{/each}
				{#each cardYear.changes as w (w)}
					<p class="kaart-rij">{@render ruit()}{w}</p>
				{/each}
				{#if cardYear.total === 0 && cardYear.changes.length === 0}
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
			{#if chosen}
				<span
					class="keuze"
					style:left="{plek(Math.max(first, chosen.van))}%"
					style:right="{100 - plek(Math.min(last, chosen.tot) + 1)}%"
				></span>
			{/if}
			<div class="kolommen" aria-hidden="true">
				{#each years as y (y.jaar)}
					<div
						class="kolom"
						class:is-dim={!!chosen && (y.jaar < chosen.van || y.jaar > chosen.tot)}
						style:--f={y.total / busiestYear}
					>
						{#if y.changes.length}<i
								class="ruit op-staaf"
								data-wijziging
								style:background={CHANGE_COLOUR}
							></i>{/if}
						{#if y.total}
							<div class="staaf">
								{#each y.parts as d (d.id)}
									{#if d.n}<i
											class="deel"
											style:flex-grow={d.n}
											style:background-color={STRIP_KINDS.find((k) => k.id === d.id)!.colour}
										></i>{/if}
								{/each}
							</div>
						{:else}<i class="leeg"></i>{/if}
					</div>
				{/each}
			</div>
			{#each ['van', 'tot'] as side (side)}
				{@const k = side as 'van' | 'tot'}
				<span
					class="greep"
					data-los={!chosen || undefined}
					class:is-resizing={drag && dragHandle === k}
					data-greep={k}
					role="slider"
					tabindex="0"
					aria-label={k === 'van' ? 'Van' : 'Tot'}
					aria-valuemin={first}
					aria-valuemax={last}
					aria-valuenow={range[k]}
					aria-valuetext={k === 'tot' && !chosen ? 'nu' : undefined}
					style:left="{k === 'van'
						? plek(Math.max(first, range.van))
						: plek(Math.min(last, range.tot) + 1)}%"
					onkeydown={(e) => onKey(e, k)}
					onfocus={() => (hover = range[k])}
					onblur={() => (hover = null)}
				></span>
			{/each}
		</div>
		<TijdstrookAs {first} {last} {van} {tot} />
	</div>
{/snippet}

{#if stippen.length > 1 && span > 1}
	<div class="tijdstrook" class:is-resizing={!!drag} data-rust={phone.current || undefined}>
		{#if phone.current}
			<button
				type="button"
				class="rust"
				aria-haspopup="dialog"
				aria-label="Periode, {words}. Wijzig"
				onclick={() => (blad = true)}
			>
				<span class="kop">{words}</span>
				<span class="micro">{parts.map((d) => d.text).join(', ')}</span>
				<span class="mini" aria-hidden="true">
					<span class="kolommen">
						{#each years as y (y.jaar)}
							<span
								class="kolom"
								class:is-dim={!!chosen && (y.jaar < chosen.van || y.jaar > chosen.tot)}
								style:--f={y.total / busiestYear}
							>
								{#if y.total}
									<span class="staaf">
										{#each y.parts as d (d.id)}{#if d.n}<i
													class="deel"
													style:flex-grow={d.n}
													style:background-color={STRIP_KINDS.find((k) => k.id === d.id)!.colour}
												></i>{/if}{/each}
									</span>
								{:else}<i class="leeg"></i>{/if}
							</span>
						{/each}
					</span>
				</span>
				<TijdstrookAs {first} {last} {van} {tot} uiteinden />
			</button>
		{:else}
			<div class="kopblok">
				<button
					type="button"
					class="kop woorden"
					aria-haspopup="dialog"
					bind:this={wordsButton}
					onclick={() => openFields(wordsButton)}>{words}</button
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
					bind:this={wordsButton}
					onclick={() => openFields(wordsButton)}>{words}</button
				>
				{@render telling()}
				{@render tekening(true)}
				{@render snelkeuzes()}
			</div>
		</Blad>
	{/if}
	<Periode
		bind:this={dateFields}
		zonderKnop
		from={fromDay ?? ''}
		to={toDay ?? ''}
		onChange={(a, b) => onDays?.(a, b)}
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
		border-bottom: 2px solid transparent;
		border-radius: 0;
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
	.grafiek[data-groot] {
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
		width: 70%;
		min-width: 2px;
		max-width: 14px;
		height: calc(var(--hoog) * var(--f));
		min-height: 2px;
	}
	.deel {
		box-sizing: content-box;
		border-top: 1px solid transparent;
		background-clip: padding-box;
		flex-basis: 0;
		min-height: 2px;
	}
	.leeg {
		width: 6px;
		height: 1px;
		background: var(--rule);
	}
	.kolom.is-dim .deel {
		background-color: var(--rule) !important;
	}
	.op-staaf {
		position: absolute;
		bottom: calc(var(--hoog) * var(--f) + 3px);
		left: calc(50% - 3px);
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
	.greep[data-los] {
		opacity: 0;
	}
	/* In the Blad the grips are there to take, at the ends, period or not. */
	[data-groot] .greep[data-los] {
		opacity: 1;
	}
	.greep[data-los]:focus-visible {
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
	[data-rust] {
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
		font-size: var(--t-micro);
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

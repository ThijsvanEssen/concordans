<script lang="ts">
	// The period of a list as one line in words ("Alle jaren", "Sinds 2020", "1 jan 2024 tot
	// 30 jun 2024") that opens a chooser: quick choices, a van and tot, and where the list gives
	// it the distribution per year with two handles (Design System, Periode). A popover under
	// the line on a wide screen, a sheet from below on a phone. The same in every filter pane
	// and first in it. Days as the URL and the API hold them; the rule is in docs/README.md.
	import { clickOutside, topLayer } from '$lib/actions/top-layer';
	import { vandaag } from '$lib/text/datum';
	import { formatCount } from '$lib/text/getal';
	import {
		QUICK_CHOICES,
		TO_BEFORE_FROM,
		fieldText,
		periodInWords,
		quickChoiceOf,
		readBound
	} from '$lib/text/periode';
	import { afterTick } from '$lib/util/after-tick';
	import Blad from './Blad.svelte';
	import {
		DRAW_HEIGHT,
		DRAW_WIDTH,
		bars,
		inPeriod,
		stepYear,
		yearAt,
		type Distribution
	} from './period-distribution';
	import TekstLink from './TekstLink.svelte';

	type Side = 'van' | 'tot';

	let {
		from: van,
		to: tot,
		onChange,
		label = 'Periode',
		distribution,
		counts = 'Aantal',
		zonderKnop = false
	}: {
		from: string;
		to: string;
		onChange: (van: string, tot: string) => void;
		/** The name of the chooser, for a screen reader. */
		label?: string;
		/** The count per year, where the list has it: bars, handles and the count in the period. */
		distribution?: Distribution;
		/** What the distribution counts: `Uitspraken`. */
		counts?: string;
		/** No line of its own: the page opens the chooser with `toon`, at the element it gives. */
		zonderKnop?: boolean;
	} = $props();

	const uid = $props.id();
	const today = vandaag();
	let open = $state(false);
	let own = $state<HTMLButtonElement | null>(null);
	let elsewhere = $state<HTMLElement | null>(null);
	/** What the chooser stands under and the focus goes back to: its line, or what opened it. */
	const button = $derived(zonderKnop ? elsewhere : own);
	let dialog = $state<HTMLElement | null>(null);
	let track = $state<HTMLElement | null>(null);
	let typed = $state({ van: '', tot: '' });
	/** The fields whose reading is shown: after leaving one, or Toepassen; not while typing. */
	let checked = $state({ van: false, tot: false });
	let sheet = $state(false);

	$effect(() => {
		const mq = matchMedia('(max-width: 768px)');
		sheet = mq.matches;
		const on = () => (sheet = mq.matches);
		mq.addEventListener('change', on);
		return () => mq.removeEventListener('change', on);
	});

	const words = $derived(periodInWords(van, tot, today));
	const read = $derived({ van: readBound(typed.van, 'from'), tot: readBound(typed.tot, 'to') });
	const days = $derived({
		van: 'day' in read.van ? read.van.day : van,
		tot: 'day' in read.tot ? read.tot.day : tot
	});
	const errors = $derived({
		van: 'error' in read.van ? read.van.error : '',
		tot:
			'error' in read.tot
				? read.tot.error
				: days.van && days.tot && days.tot < days.van
					? TO_BEFORE_FROM
					: ''
	});
	const invalid = $derived({
		van: checked.van && !!errors.van,
		tot: checked.tot && !!errors.tot
	});
	const errorLine = $derived((invalid.van && errors.van) || (invalid.tot && errors.tot) || '');
	const quick = $derived(quickChoiceOf(days.van, days.tot, today));

	// The distribution and the handles on its years.
	const span = $derived(
		distribution && distribution.length > 1
			? { min: distribution[0].year, max: distribution[distribution.length - 1].year }
			: null
	);
	const clamp = (y: number) => (span ? Math.min(span.max, Math.max(span.min, y)) : y);
	const year = $derived({
		van: span ? clamp(days.van ? Number(days.van.slice(0, 4)) : span.min) : 0,
		tot: span ? clamp(days.tot ? Number(days.tot.slice(0, 4)) : span.max) : 0
	});
	const drawn = $derived(distribution && span ? bars(distribution, year.van, year.tot) : []);
	const place = (y: number) =>
		span && span.max > span.min ? (y - span.min) / (span.max - span.min) : 0;

	/** Open the chooser under `at` (with `zonderKnop`). */
	export function toon(at: HTMLElement) {
		elsewhere = at;
		show();
	}
	function show() {
		typed = { van: fieldText(van, 'from'), tot: fieldText(tot, 'to') };
		checked = { van: false, tot: false };
		open = true;
		afterTick(() => {
			const chosen = dialog?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
			(chosen ?? dialog?.querySelector<HTMLElement>('input'))?.focus();
		});
	}
	function close(back: boolean) {
		open = false;
		if (back) afterTick(() => button?.focus({ preventScroll: true }));
	}
	$effect(() => {
		if (!open || sheet) return;
		return clickOutside(
			() => [dialog, button],
			() => close(false)
		);
	});

	function choose(c: (typeof QUICK_CHOICES)[number]) {
		typed = { van: fieldText(c.from(today), 'from'), tot: '' };
		checked = { van: false, tot: false };
	}
	function leave(side: Side) {
		checked[side] = true;
		const r = read[side];
		if ('day' in r) typed[side] = fieldText(r.day, side === 'van' ? 'from' : 'to');
	}
	function apply() {
		checked = { van: true, tot: true };
		const first = errors.van ? 'van' : errors.tot ? 'tot' : null;
		if (first) {
			dialog?.querySelector<HTMLElement>(`#${uid}-${first}`)?.focus();
			return;
		}
		onChange(days.van, days.tot);
		close(true);
	}
	function clear() {
		onChange('', '');
		close(true);
	}

	function setYear(side: Side, y: number) {
		if (!span) return;
		const j = side === 'van' ? Math.min(y, year.tot) : Math.max(y, year.van);
		const edge = side === 'van' ? j <= span.min : j >= span.max;
		typed[side] = edge ? '' : String(j);
		checked[side] = false;
	}
	function handleKey(e: KeyboardEvent, side: Side) {
		if (!span) return;
		const next = stepYear(e.key, year[side], span.min, span.max);
		if (next === null) return;
		e.preventDefault();
		setYear(side, next);
	}
	function drag(e: PointerEvent, side: Side) {
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		const to = (ev: PointerEvent) => {
			if (!track || !span) return;
			const r = track.getBoundingClientRect();
			setYear(side, yearAt((ev.clientX - r.left) / r.width, span.min, span.max));
		};
		const stop = () => {
			el.removeEventListener('pointermove', to);
			el.removeEventListener('pointerup', stop);
			el.removeEventListener('pointercancel', stop);
		};
		el.addEventListener('pointermove', to);
		el.addEventListener('pointerup', stop);
		el.addEventListener('pointercancel', stop);
	}

	function radioKey(e: KeyboardEvent, i: number) {
		const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
		if (!step) return;
		e.preventDefault();
		const n = QUICK_CHOICES.length;
		const c = QUICK_CHOICES[(i + step + n) % n];
		choose(c);
		afterTick(() => dialog?.querySelector<HTMLElement>(`#${uid}-s-${c.id}`)?.focus());
	}
	/** The keys stay in the chooser: the menu or sheet round it must not take them. */
	function keys(e: KeyboardEvent) {
		// In the Blad of a phone Tab goes round inside it, by the Blad.
		if (sheet && e.key === 'Tab') return;
		e.stopPropagation();
		const at = e.target as HTMLElement;
		if (e.key === 'Escape') {
			e.preventDefault();
			close(true);
		} else if (at.matches('[role="slider"]')) handleKey(e, at.dataset.side as Side);
		else if (at.matches('[role="radio"]')) radioKey(e, Number(at.dataset.i));
		else if (at.matches('input') && e.key === 'Enter') {
			e.preventDefault();
			apply();
		}
	}
	/** On the box itself, not delegated: a menu round it listens there, and must not get the keys. */
	function keepKeys(node: HTMLElement) {
		node.addEventListener('keydown', keys);
		return { destroy: () => node.removeEventListener('keydown', keys) };
	}
</script>

{#snippet content()}
	<div>
		<p class="veld-kop" id="{uid}-snel">Snelkeuze</p>
		<div class="snel" role="radiogroup" aria-labelledby="{uid}-snel">
			{#each QUICK_CHOICES as c, i (c.id)}
				<button
					type="button"
					class="btn"
					role="radio"
					id="{uid}-s-{c.id}"
					aria-checked={quick === c.id}
					tabindex={quick === c.id || (quick === null && i === 0) ? 0 : -1}
					data-i={i}
					onclick={() => choose(c)}>{c.label}</button
				>
			{/each}
		</div>
	</div>
	{#if distribution && span}
		<div class="bereik">
			<p class="veld-kop rijkop">
				<span>{counts} per jaar</span>
				<span>{formatCount(inPeriod(distribution, year.van, year.tot))} in de periode</span>
			</p>
			<svg
				class="verdeling"
				viewBox="0 0 {DRAW_WIDTH} {DRAW_HEIGHT}"
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				{#each drawn as b, i (i)}
					<rect class:uit={!b.inside} x={b.x} y={b.y} width={b.width} height={b.height} />
				{/each}
			</svg>
			<div class="spoor" bind:this={track}>
				<span
					class="tussen"
					style="left:{place(year.van) * 100}%;right:{(1 - place(year.tot)) * 100}%"
				></span>
				{#each [{ side: 'van', name: 'Van' }, { side: 'tot', name: 'Tot' }] as g (g.side)}
					<button
						type="button"
						class="greep"
						role="slider"
						aria-label={g.name}
						aria-valuemin={span.min}
						aria-valuemax={span.max}
						aria-valuenow={year[g.side as Side]}
						aria-valuetext={g.side === 'tot' && !days.tot ? 'nu' : undefined}
						style="left:{place(year[g.side as Side]) * 100}%"
						data-side={g.side}
						onpointerdown={(e) => drag(e, g.side as Side)}
					></button>
				{/each}
			</div>
			<div class="veld-kop as" aria-hidden="true">
				<span>{span.min}</span><span>{span.max}</span>
			</div>
		</div>
	{/if}
	<div class="velden">
		<label for="{uid}-van">van</label>
		<input
			id="{uid}-van"
			autocomplete="off"
			placeholder="begin"
			bind:value={typed.van}
			aria-invalid={invalid.van}
			aria-describedby={invalid.van ? `${uid}-fout` : undefined}
			oninput={() => {
				checked.van = false;
			}}
			onblur={() => leave('van')}
		/>
		<label for="{uid}-tot">tot</label>
		<input
			id="{uid}-tot"
			autocomplete="off"
			placeholder="nu"
			bind:value={typed.tot}
			aria-invalid={invalid.tot}
			aria-describedby={invalid.tot ? `${uid}-fout` : undefined}
			oninput={() => {
				checked.tot = false;
			}}
			onblur={() => leave('tot')}
		/>
	</div>
	{#if errorLine}<p class="fout" id="{uid}-fout">{errorLine}</p>{/if}
	<div class="voet">
		<TekstLink onclick={clear}>Wissen</TekstLink>
		<button type="button" class="btn is-primary" onclick={apply}>Toepassen</button>
	</div>
{/snippet}

<div class="periode">
	{#if !zonderKnop}
		<button
			type="button"
			class="btn trigger"
			bind:this={own}
			aria-haspopup="dialog"
			aria-expanded={open}
			aria-label="{words} Wijzig"
			onclick={() => (open ? close(true) : show())}
		>
			<span class="wat">{words}</span><span class="wijzig" aria-hidden="true">Wijzig</span>
		</button>
	{/if}
	{#if open && button && !sheet}
		<div
			class="tekstmenu__lijst pop"
			role="dialog"
			aria-label={label}
			tabindex="-1"
			bind:this={dialog}
			use:topLayer={{ anchor: button, close: () => close(false) }}
			use:keepKeys
		>
			{@render content()}
		</div>
	{/if}
	{#if open && sheet}
		<Blad title={label} opener={() => button} onClose={() => close(true)}>
			<div class="sheet" bind:this={dialog} use:keepKeys>
				{@render content()}
			</div>
		</Blad>
	{/if}
</div>

<style>
	.periode {
		display: flex;
		min-width: 0;
	}
	/* In rest: one button over the column, the period in words and "Wijzig" at its right. On a
	   touch screen it keeps the desktop letter, so a long period still fits its column. */
	.trigger {
		flex: 1;
		min-width: 0;
		justify-content: space-between;
		text-align: left;
	}
	.trigger[aria-expanded='true'] {
		background: var(--paper-2);
	}
	.wat {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.wijzig {
		flex: none;
		color: var(--ink-2);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: var(--onderstreping);
	}
	@media (pointer: coarse), (max-width: 768px) {
		.trigger {
			font-size: var(--t-ui);
			padding-inline: var(--s-3);
		}
	}
	:is(button, input):focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}

	/* Open on a wide screen: 320 px under the line, in the top layer. */
	.pop {
		box-sizing: border-box;
		width: min(320px, calc(100vw - 2 * var(--s-2)));
		margin: 0;
		padding: var(--s-4);
		box-shadow: var(--shadow-pop);
	}
	.pop,
	.sheet {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
	}
	.veld-kop {
		margin: 0 0 var(--s-2);
		font-family: var(--font-ui);
		font-size: var(--t-label);
		font-weight: 500;
		line-height: 16px;
		color: var(--ink-3);
	}
	.rijkop {
		display: flex;
		justify-content: space-between;
		gap: var(--s-2);
	}
	.snel {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	.snel .btn[aria-checked='true'] {
		background: var(--paper-2);
		box-shadow: inset 0 -2px 0 var(--ink);
	}

	/* The distribution: bars in the period in ink-3, outside it in rule; two handles on a track. */
	.bereik {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.bereik .veld-kop {
		margin: 0;
	}
	.verdeling {
		display: block;
		width: 100%;
		height: var(--s-7);
	}
	.verdeling rect {
		fill: var(--ink-3);
	}
	.verdeling rect.uit {
		fill: var(--rule);
	}
	.spoor {
		--greep-b: 14px;
		--greep-h: 16px;
		position: relative;
		height: calc(var(--s-4) + var(--s-1));
		margin: 0 calc(var(--greep-b) / 2);
	}
	.spoor::before {
		content: '';
		position: absolute;
		left: calc(var(--greep-b) / -2);
		right: calc(var(--greep-b) / -2);
		top: 50%;
		height: 1px;
		background: var(--rule);
	}
	.tussen {
		position: absolute;
		top: 50%;
		height: 3px;
		margin-top: -1px;
		background: var(--ink);
	}
	/* The frame is a line inside the box, not a border: a handle is not a button. */
	.greep {
		position: absolute;
		top: 50%;
		box-sizing: border-box;
		width: var(--greep-b);
		height: var(--greep-h);
		margin: calc(var(--greep-h) / -2) 0 0 calc(var(--greep-b) / -2);
		padding: 0;
		border: 0;
		box-shadow: inset 0 0 0 1px var(--ink);
		border-radius: var(--r-1);
		background: var(--paper);
		cursor: ew-resize;
		touch-action: none;
	}
	.as {
		display: flex;
		justify-content: space-between;
	}

	.velden {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr);
		gap: var(--s-2);
		align-items: center;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.velden input {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		height: var(--veld-h);
		padding: 0 var(--s-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		color: var(--ink);
	}
	.velden input::placeholder {
		color: var(--ink-3);
	}
	.fout {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 18px;
		color: var(--uitkomst-nee);
	}
	.voet {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-2);
		padding-top: var(--s-3);
		border-top: 1px solid var(--rule);
	}

	/* Open on a phone: a Blad from below, every control a finger high. */
	.sheet {
		padding: 0 var(--s-4) var(--s-4);
	}
	.sheet .snel .btn[aria-checked='true'] {
		box-shadow: inset 0 -3px 0 var(--ink);
	}
	.sheet .velden {
		font-size: var(--t-meta);
	}
	.sheet .velden input {
		height: var(--veld-h-raak);
		font-size: var(--t-input);
	}
	.sheet .voet {
		padding-top: 0;
		border-top: 0;
	}
	.sheet .spoor {
		--greep-b: 20px;
		--greep-h: 24px;
		height: var(--veld-h-raak);
	}
</style>

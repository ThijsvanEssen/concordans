<script lang="ts">
	// The period of a list as one line in words ("Alle jaren", "Sinds 2020", "1 jan 2024 tot
	// 30 jun 2024") that opens a chooser: snelkeuzes, a van and tot, and where the list gives
	// it the distribution per year with two handles (Design System, Periode). A popover under
	// the line on a wide screen, a sheet from below on a phone. The same in every filter pane
	// and first in it. Days as the URL and the API hold them; the rule is in docs/README.md.
	import { afterTick } from '$lib/util/after-tick';
	import { clickOutside, topLayer } from '$lib/actions/top-layer';
	import { vandaag } from '$lib/text/datum';
	import { formatCount } from '$lib/text/getal';
	import {
		FOUT_TOT_VOOR_VAN,
		SNELKEUZEN,
		leesGrens,
		snelkeuzeVan,
		veldTekst,
		woorden
	} from '$lib/text/periode';
	import {
		BREED,
		HOOG,
		inPeriode,
		jaarBij,
		stapJaar,
		staven,
		type Verdeling
	} from './periode-verdeling';

	let {
		from: van,
		to: tot,
		onChange,
		label = 'Periode',
		verdeling,
		telt = 'Aantal'
	}: {
		from: string;
		to: string;
		onChange: (van: string, tot: string) => void;
		/** The name of the chooser, for a screen reader. */
		label?: string;
		/** The count per year, where the list has it: bars, handles and the count in the period. */
		verdeling?: Verdeling;
		/** What the distribution counts: `Uitspraken`. */
		telt?: string;
	} = $props();

	const uid = $props.id();
	const dag = vandaag();
	let open = $state(false);
	let knop = $state<HTMLButtonElement | null>(null);
	let dialoog = $state<HTMLElement | null>(null);
	let spoor = $state<HTMLElement | null>(null);
	let tekstVan = $state('');
	let tekstTot = $state('');
	/** The fields whose reading is shown: after leaving one, or Toepassen; not while typing. */
	let gecontroleerd = $state({ van: false, tot: false });
	let sheet = $state(false);

	$effect(() => {
		const mq = matchMedia('(max-width: 767px)');
		sheet = mq.matches;
		const on = () => (sheet = mq.matches);
		mq.addEventListener('change', on);
		return () => mq.removeEventListener('change', on);
	});

	const wat = $derived(woorden(van, tot, dag));
	const lees = $derived({ van: leesGrens(tekstVan, 'van'), tot: leesGrens(tekstTot, 'tot') });
	const dagen = $derived({
		van: 'dag' in lees.van ? lees.van.dag : van,
		tot: 'dag' in lees.tot ? lees.tot.dag : tot
	});
	const fouten = $derived({
		van: 'fout' in lees.van ? lees.van.fout : '',
		tot:
			'fout' in lees.tot
				? lees.tot.fout
				: dagen.van && dagen.tot && dagen.tot < dagen.van
					? FOUT_TOT_VOOR_VAN
					: ''
	});
	const ongeldig = $derived({
		van: gecontroleerd.van && !!fouten.van,
		tot: gecontroleerd.tot && !!fouten.tot
	});
	const foutRegel = $derived((ongeldig.van && fouten.van) || (ongeldig.tot && fouten.tot) || '');
	const snel = $derived(snelkeuzeVan(dagen.van, dagen.tot, dag));

	// The distribution and the handles on its years.
	const jaren = $derived(
		verdeling && verdeling.length > 1
			? { min: verdeling[0].jaar, max: verdeling[verdeling.length - 1].jaar }
			: null
	);
	const jaarVan = $derived(
		jaren ? clamp(dagen.van ? Number(dagen.van.slice(0, 4)) : jaren.min) : 0
	);
	const jaarTot = $derived(
		jaren ? clamp(dagen.tot ? Number(dagen.tot.slice(0, 4)) : jaren.max) : 0
	);
	function clamp(y: number): number {
		return jaren ? Math.min(jaren.max, Math.max(jaren.min, y)) : y;
	}
	const staafjes = $derived(verdeling && jaren ? staven(verdeling, jaarVan, jaarTot) : []);
	const deel = (y: number) =>
		jaren && jaren.max > jaren.min ? (y - jaren.min) / (jaren.max - jaren.min) : 0;

	function openen() {
		tekstVan = veldTekst(van, 'van');
		tekstTot = veldTekst(tot, 'tot');
		gecontroleerd = { van: false, tot: false };
		open = true;
		afterTick(() => {
			const gekozen = dialoog?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]');
			(gekozen ?? dialoog?.querySelector<HTMLElement>('input'))?.focus();
		});
	}
	function sluit(terug: boolean) {
		open = false;
		if (terug) afterTick(() => knop?.focus());
	}
	$effect(() => {
		if (!open) return;
		return clickOutside(
			() => [dialoog, knop],
			() => sluit(false)
		);
	});

	function kiesSnel(s: (typeof SNELKEUZEN)[number]) {
		tekstVan = veldTekst(s.van(dag), 'van');
		tekstTot = '';
		gecontroleerd = { van: false, tot: false };
	}
	function verlaat(kant: 'van' | 'tot') {
		gecontroleerd[kant] = true;
		const l = lees[kant];
		if ('dag' in l) {
			const t = veldTekst(l.dag, kant);
			if (kant === 'van') tekstVan = t;
			else tekstTot = t;
		}
	}
	function pas() {
		gecontroleerd = { van: true, tot: true };
		const eerste = fouten.van ? 'van' : fouten.tot ? 'tot' : null;
		if (eerste) {
			dialoog?.querySelector<HTMLElement>(`#${uid}-${eerste}`)?.focus();
			return;
		}
		onChange(dagen.van, dagen.tot);
		sluit(true);
	}
	function wis() {
		onChange('', '');
		sluit(true);
	}

	function zetJaar(kant: 'van' | 'tot', y: number) {
		if (!jaren) return;
		const j = kant === 'van' ? Math.min(y, jaarTot) : Math.max(y, jaarVan);
		const rand = kant === 'van' ? j <= jaren.min : j >= jaren.max;
		const t = rand ? '' : String(j);
		if (kant === 'van') tekstVan = t;
		else tekstTot = t;
		gecontroleerd[kant] = false;
	}
	function greepToets(e: KeyboardEvent, kant: 'van' | 'tot') {
		if (!jaren) return;
		const nu = kant === 'van' ? jaarVan : jaarTot;
		const volgend = stapJaar(e.key, nu, jaren.min, jaren.max);
		if (volgend === null) return;
		e.preventDefault();
		zetJaar(kant, volgend);
	}
	function sleep(e: PointerEvent, kant: 'van' | 'tot') {
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		const naar = (ev: PointerEvent) => {
			if (!spoor || !jaren) return;
			const r = spoor.getBoundingClientRect();
			zetJaar(kant, jaarBij((ev.clientX - r.left) / r.width, jaren.min, jaren.max));
		};
		const stop = () => {
			el.removeEventListener('pointermove', naar);
			el.removeEventListener('pointerup', stop);
			el.removeEventListener('pointercancel', stop);
		};
		el.addEventListener('pointermove', naar);
		el.addEventListener('pointerup', stop);
		el.addEventListener('pointercancel', stop);
	}

	const FOCUSBAAR = 'button:not([disabled]), input:not([disabled])';
	/** The keys stay in the chooser: the menu or sheet round it must not take them. */
	function toets(e: KeyboardEvent) {
		e.stopPropagation();
		if (e.key === 'Escape') {
			e.preventDefault();
			sluit(true);
		} else if (e.key === 'Tab' && sheet && dialoog) {
			const els = [...dialoog.querySelectorAll<HTMLElement>(FOCUSBAAR)];
			const [eerste, laatste] = [els[0], els.at(-1)];
			const at = document.activeElement;
			if (e.shiftKey && at === eerste) {
				e.preventDefault();
				laatste?.focus();
			} else if (!e.shiftKey && at === laatste) {
				e.preventDefault();
				eerste?.focus();
			}
		} else {
			const at = e.target as HTMLElement;
			if (at.matches('[role="slider"]')) greepToets(e, at.dataset.kant as 'van' | 'tot');
			else if (at.matches('[role="radio"]')) snelToets(e, Number(at.dataset.i));
			else if (at.matches('input')) veldToets(e);
		}
	}
	function snelToets(e: KeyboardEvent, i: number) {
		const stap = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
		if (!stap) return;
		e.preventDefault();
		const n = SNELKEUZEN.length;
		const s = SNELKEUZEN[(i + stap + n) % n];
		kiesSnel(s);
		afterTick(() => dialoog?.querySelector<HTMLElement>(`#${uid}-s-${s.id}`)?.focus());
	}
	/** On the box itself, not delegated: a menu round it listens there, and must not get the keys. */
	function houdToetsen(node: HTMLElement) {
		node.addEventListener('keydown', toets);
		return { destroy: () => node.removeEventListener('keydown', toets) };
	}
	function veldToets(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		pas();
	}
</script>

{#snippet inhoud()}
	<div>
		<p class="kop" id="{uid}-snel">Snelkeuze</p>
		<div class="snel" role="radiogroup" aria-labelledby="{uid}-snel">
			{#each SNELKEUZEN as s, i (s.id)}
				<button
					type="button"
					role="radio"
					id="{uid}-s-{s.id}"
					aria-checked={snel === s.id}
					tabindex={snel === s.id || (snel === null && i === 0) ? 0 : -1}
					onclick={() => kiesSnel(s)}
					data-i={i}>{s.label}</button
				>
			{/each}
		</div>
	</div>
	{#if verdeling && jaren}
		<div class="bereik">
			<p class="kop rijkop">
				<span>{telt} per jaar</span>
				<span>{formatCount(inPeriode(verdeling, jaarVan, jaarTot))} in de periode</span>
			</p>
			<svg
				class="verdeling"
				viewBox="0 0 {BREED} {HOOG}"
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				{#each staafjes as s, i (i)}
					<rect class:uit={!s.binnen} x={s.x} y={s.y} width={s.breed} height={s.hoog} />
				{/each}
			</svg>
			<div class="spoor" bind:this={spoor}>
				<span class="tussen" style="left:{deel(jaarVan) * 100}%;right:{(1 - deel(jaarTot)) * 100}%"
				></span>
				{#each [{ kant: 'van', naam: 'Van', nu: jaarVan }, { kant: 'tot', naam: 'Tot', nu: jaarTot }] as g (g.kant)}
					<button
						type="button"
						class="greep"
						role="slider"
						aria-label={g.naam}
						aria-valuemin={jaren.min}
						aria-valuemax={jaren.max}
						aria-valuenow={g.nu}
						aria-valuetext={g.kant === 'tot' && !dagen.tot ? 'nu' : undefined}
						style="left:{deel(g.nu) * 100}%"
						data-kant={g.kant}
						onpointerdown={(e) => sleep(e, g.kant as 'van' | 'tot')}
					></button>
				{/each}
			</div>
			<div class="as" aria-hidden="true"><span>{jaren.min}</span><span>{jaren.max}</span></div>
		</div>
	{/if}
	<div class="velden">
		<label for="{uid}-van">van</label>
		<input
			id="{uid}-van"
			class="veld"
			autocomplete="off"
			placeholder="begin"
			bind:value={tekstVan}
			aria-invalid={ongeldig.van}
			aria-describedby={ongeldig.van ? `${uid}-fout` : undefined}
			oninput={() => (gecontroleerd.van = false)}
			onblur={() => verlaat('van')}
		/>
		<label for="{uid}-tot">tot</label>
		<input
			id="{uid}-tot"
			class="veld"
			autocomplete="off"
			placeholder="nu"
			bind:value={tekstTot}
			aria-invalid={ongeldig.tot}
			aria-describedby={ongeldig.tot ? `${uid}-fout` : undefined}
			oninput={() => (gecontroleerd.tot = false)}
			onblur={() => verlaat('tot')}
		/>
	</div>
	{#if foutRegel}<p class="fout" id="{uid}-fout">{foutRegel}</p>{/if}
	<div class="voet">
		<button type="button" class="tekst" onclick={wis}>Wissen</button>
		<button type="button" class="btn is-primary" onclick={pas}>Toepassen</button>
	</div>
{/snippet}

<div class="periode">
	<button
		type="button"
		class="trigger"
		bind:this={knop}
		aria-haspopup="dialog"
		aria-expanded={open}
		aria-label="{wat} Wijzig"
		onclick={() => (open ? sluit(true) : openen())}
	>
		<span class="wat">{wat}</span><span class="wijzig" aria-hidden="true">Wijzig</span>
	</button>
	{#if open && knop && !sheet}
		<div
			class="tekstmenu__lijst pop"
			role="dialog"
			aria-label={label}
			tabindex="-1"
			bind:this={dialoog}
			use:topLayer={{ anchor: knop, close: () => sluit(false) }}
			use:houdToetsen
		>
			{@render inhoud()}
		</div>
	{/if}
	{#if open && sheet}
		<div class="scherm">
			<div
				class="sheet"
				role="dialog"
				aria-modal="true"
				aria-labelledby="{uid}-kop"
				tabindex="-1"
				bind:this={dialoog}
				use:houdToetsen
			>
				<div class="greepje" aria-hidden="true"></div>
				<div class="sheetkop">
					<h3 id="{uid}-kop">{label}</h3>
					<button type="button" class="sluit" aria-label="Sluiten" onclick={() => sluit(true)}
						>×</button
					>
				</div>
				{@render inhoud()}
			</div>
		</div>
	{/if}
</div>

<style>
	.periode {
		display: flex;
		min-width: 0;
	}
	/* In rest: one button over the column, the period in words and "Wijzig" at its right. */
	.trigger {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-2);
		box-sizing: border-box;
		height: var(--veld-h);
		padding: 0 var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		font-weight: 500;
		color: var(--ink);
		cursor: pointer;
		text-align: left;
	}
	.trigger:hover,
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
		text-underline-offset: var(--underline-offset);
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
		font-family: var(--font-ui);
	}
	.kop {
		margin: 0 0 var(--s-2);
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
	.snel button,
	.tekst,
	.voet .btn {
		box-sizing: border-box;
		height: var(--veld-h);
		padding: 0 var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		font-weight: 500;
		color: var(--ink);
		cursor: pointer;
	}
	.snel button:hover {
		background: var(--paper-2);
	}
	.snel button[aria-checked='true'] {
		background: var(--paper-2);
		box-shadow: inset 0 -2px 0 var(--ink);
	}

	/* The distribution: bars in the period in ink-3, outside it in rule; two handles on a track. */
	.bereik {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
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
		height: 20px;
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
	.greep {
		position: absolute;
		top: 50%;
		box-sizing: border-box;
		width: var(--greep-b);
		height: var(--greep-h);
		margin: calc(var(--greep-h) / -2) 0 0 calc(var(--greep-b) / -2);
		padding: 0;
		border: 1px solid var(--ink);
		border-radius: var(--r-1);
		background: var(--paper);
		cursor: ew-resize;
		touch-action: none;
	}
	.as {
		display: flex;
		justify-content: space-between;
		font-size: var(--t-label);
		line-height: 16px;
		color: var(--ink-3);
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
	.veld {
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
	.veld::placeholder {
		color: var(--ink-3);
	}
	.fout {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 18px;
		color: var(--accent);
	}
	.voet {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-2);
		padding-top: var(--s-3);
		border-top: 1px solid var(--rule);
	}
	.tekst {
		border-color: transparent;
		background: transparent;
		color: var(--ink-2);
	}
	.tekst:hover {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: var(--underline-offset);
	}
	.voet .btn.is-primary {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--paper);
	}

	/* Open on a phone: a sheet from below behind the screen, every control a finger high. */
	.scherm {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		background: var(--scherm);
	}
	.sheet {
		box-sizing: border-box;
		max-height: 100%;
		overflow-y: auto;
		padding: var(--s-2) var(--s-4) var(--s-4);
		background: var(--paper);
		border-radius: var(--r-2) var(--r-2) 0 0;
		color: var(--ink);
	}
	.greepje {
		flex: none;
		width: 36px;
		height: 4px;
		margin: 0 auto;
		border-radius: var(--r-rond);
		background: var(--rule);
	}
	.sheetkop {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.sheetkop h3 {
		margin: 0;
		font-size: var(--t-ui-raak);
		font-weight: 600;
	}
	.sluit {
		width: var(--veld-h-raak);
		height: var(--veld-h-raak);
		padding: 0;
		border: 0;
		background: transparent;
		font-size: var(--t-ui-raak);
		color: var(--ink-2);
		cursor: pointer;
	}
	.sheet .snel button,
	.sheet .tekst,
	.sheet .voet .btn {
		height: var(--veld-h-raak);
		padding: 0 var(--s-4);
		font-size: var(--t-ui-raak);
	}
	.sheet .snel button[aria-checked='true'] {
		box-shadow: inset 0 -3px 0 var(--ink);
	}
	.sheet .veld {
		height: var(--veld-h-raak);
		font-size: var(--t-input);
	}
	.sheet .velden {
		font-size: var(--t-meta);
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
	/* The line itself is a finger high on a touch screen; its words keep the desktop letter,
	   so a long period still fits its column. */
	@media (pointer: coarse), (max-width: 768px) {
		.trigger {
			height: var(--veld-h-raak);
		}
	}
</style>

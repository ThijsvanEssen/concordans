<script lang="ts">
	// The tijdstrook under the canvas of the werkplek (besluit 39, mockup A197-b): a band of
	// the years from the first bron on the canvas to the last, each bron a dot in the colour of
	// its kind at its date. A drag over the band, or a tap on a year, chooses the period, which
	// the bronfilter holds (?van, ?tot); a tap on the one year chosen gives every year back.
	// The keyboard's way is Periode in the strip at the left.
	import { kindColour } from '$lib/bron/kleur';
	import type { Collection } from '$lib/vocabulary';

	type Stip = { jaar: number; collection: Collection };

	let {
		stippen,
		van,
		tot,
		onPeriode
	}: {
		/** Each bron on the canvas with a date: its year as a fraction, its kind. */
		stippen: readonly Stip[];
		/** The period chosen, by its years; null where open. */
		van: number | null;
		tot: number | null;
		onPeriode: (van: number | null, tot: number | null) => void;
	} = $props();

	const eerste = $derived(Math.floor(Math.min(...stippen.map((s) => s.jaar))));
	const laatste = $derived(Math.floor(Math.max(...stippen.map((s) => s.jaar))));
	/** The years the band spans: the last one whole. */
	const span = $derived(laatste - eerste + 1);
	const plek = (jaar: number) => ((jaar - eerste) / span) * 100;
	/** A year on the axis every so many, as the span allows. */
	const stap = $derived(span > 60 ? 20 : span > 24 ? 5 : span > 8 ? 2 : 1);
	const assen = $derived(
		Array.from({ length: span }, (_, i) => eerste + i).filter((j) => j % stap === 0)
	);

	let band = $state<HTMLElement | null>(null);
	let sleep = $state<{ van: number; tot: number } | null>(null);
	const jaarOp = (e: PointerEvent) => {
		const r = band?.getBoundingClientRect();
		if (!r || r.width === 0) return eerste;
		const f = Math.min(0.9999, Math.max(0, (e.clientX - r.left) / r.width));
		return eerste + Math.floor(f * span);
	};
	function neer(e: PointerEvent) {
		band?.setPointerCapture(e.pointerId);
		const j = jaarOp(e);
		sleep = { van: j, tot: j };
	}
	function beweeg(e: PointerEvent) {
		if (sleep) sleep = { ...sleep, tot: jaarOp(e) };
	}
	function op() {
		const s = sleep;
		sleep = null;
		if (!s) return;
		const a = Math.min(s.van, s.tot);
		const b = Math.max(s.van, s.tot);
		if (a === b && van === a && tot === a) onPeriode(null, null);
		else onPeriode(a, b);
	}
	/** What stands chosen: the drag under way, else the period of the address. */
	const keuze = $derived(
		sleep
			? { van: Math.min(sleep.van, sleep.tot), tot: Math.max(sleep.van, sleep.tot) }
			: van !== null || tot !== null
				? { van: van ?? eerste, tot: tot ?? laatste }
				: null
	);
</script>

{#if stippen.length > 1 && span > 1}
	<div class="tijdstrook" aria-hidden="true">
		<div
			class="band"
			bind:this={band}
			onpointerdown={neer}
			onpointermove={beweeg}
			onpointerup={op}
			onpointercancel={() => (sleep = null)}
		>
			{#if keuze}
				<span
					class="keuze"
					style:left="{plek(Math.max(eerste, keuze.van))}%"
					style:right="{100 - plek(Math.min(laatste, keuze.tot) + 1)}%"
				></span>
			{/if}
			{#each stippen as s, i (i)}
				<i
					class="stip"
					class:is-dim={!!keuze && (s.jaar < keuze.van || s.jaar >= keuze.tot + 1)}
					style:left="{plek(s.jaar)}%"
					style:background={kindColour(s.collection)}
				></i>
			{/each}
		</div>
		<div class="as">
			{#each assen as j (j)}<span style:left="{plek(j + 0.5)}%">{j}</span>{/each}
		</div>
	</div>
{/if}

<style>
	.tijdstrook {
		flex: none;
		padding: var(--s-2) var(--s-5) var(--s-1);
		border-top: 1px solid var(--rule);
		background: var(--paper);
		touch-action: none;
		user-select: none;
	}
	.band {
		position: relative;
		height: var(--s-6);
		border: 1px solid var(--rule-strong);
		background: var(--paper-2);
		cursor: col-resize;
	}
	.keuze {
		position: absolute;
		top: 0;
		bottom: 0;
		background: var(--paper);
		box-shadow:
			inset 1px 0 0 var(--ink-2),
			inset -1px 0 0 var(--ink-2);
	}
	.stip {
		position: absolute;
		bottom: var(--s-1);
		width: 10px;
		height: 10px;
		transform: translateX(-50%);
		border-radius: var(--r-rond);
	}
	.stip.is-dim {
		opacity: 0.25;
	}
	.as {
		position: relative;
		height: var(--s-4);
	}
	.as span {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		white-space: nowrap;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 1;
		color: var(--ink-3);
	}
</style>

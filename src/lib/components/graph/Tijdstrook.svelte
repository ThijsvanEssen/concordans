<script lang="ts">
	// The tijdstrook under the canvas of the werkplek (besluit 39, Design System Tijdstrook): a
	// band of the years from the first bron on the canvas to the last, one column per year, the
	// bronnen of a year stacked as dots. A drag over the band, or a tap on a year, chooses the period, which
	// the bronfilter holds (?van, ?tot); a tap on the one year chosen gives every year back.
	// The period has two grips; the keyboard's way is Periode in the strip at the left.
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
		const greep = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-greep]')?.dataset
			.greep;
		// A grip moves its own end of the period; the other end stays.
		if (greep && keuze)
			sleep =
				greep === 'van' ? { van: keuze.tot, tot: keuze.van } : { van: keuze.van, tot: keuze.tot };
		else sleep = { van: j, tot: j };
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
	/** The end the pointer holds in a drag: the grip that is filled. */
	const greepSleep = $derived(sleep ? (sleep.tot < sleep.van ? 'van' : 'tot') : null);
	/** The bronnen per year, from the first, to stack. */
	const kolommen = $derived.by(() => {
		const k = Array.from({ length: span }, () => 0);
		for (const s of stippen) k[Math.floor(s.jaar) - eerste]++;
		return k;
	});
	const periodeTekst = $derived.by(() => {
		const a = keuze?.van ?? eerste;
		const b = keuze?.tot ?? laatste;
		return a === b ? `${a}` : `${a} tot ${b}`;
	});
</script>

{#if stippen.length > 1 && span > 1}
	<div class="tijdstrook" class:is-resizing={!!sleep} aria-hidden="true">
		<p class="kop">{periodeTekst}</p>
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
			<div class="kolommen">
				{#each kolommen as n, k (k)}
					{@const jaar = eerste + k}
					<div class="kolom" class:is-dim={!!keuze && (jaar < keuze.van || jaar > keuze.tot)}>
						{#each { length: n } as _, i (i)}<i class="stip"></i>{/each}
					</div>
				{/each}
			</div>
			{#if keuze}
				<span
					class="greep"
					class:is-resizing={sleep && greepSleep === 'van'}
					data-greep="van"
					style:left="{plek(Math.max(eerste, keuze.van))}%"
				></span>
				<span
					class="greep"
					class:is-resizing={sleep && greepSleep === 'tot'}
					data-greep="tot"
					style:left="{plek(Math.min(laatste, keuze.tot) + 1)}%"
				></span>
			{/if}
		</div>
		<div class="as">
			{#each assen as j, i (j)}
				<span
					class:is-in={!keuze || (j >= keuze.van && j <= keuze.tot)}
					data-tussen={i % 2 === 1 || undefined}
					style:left="{plek(j + 0.5)}%">{j}</span
				>
			{/each}
		</div>
	</div>
{/if}

<style>
	.tijdstrook {
		flex: none;
		padding: var(--s-2) var(--s-5);
		border-top: 1px solid var(--rule);
		background: var(--paper);
		touch-action: none;
		user-select: none;
	}
	/* The period as heading is for the phone; the axis carries it elsewhere. */
	.kop {
		display: none;
		margin: 0 0 var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		line-height: 1;
		color: var(--ink);
	}
	.band {
		position: relative;
		height: 58px;
		border-radius: var(--r-1);
		background: var(--paper-2);
		cursor: col-resize;
	}
	.keuze {
		position: absolute;
		top: 0;
		bottom: 0;
		background: var(--paper);
	}
	.is-resizing > .band > .keuze {
		border: 1px dashed var(--ink-2);
	}
	.kolommen {
		position: absolute;
		inset: 0;
		display: flex;
		overflow: hidden;
		border-radius: var(--r-1);
	}
	.kolom {
		flex: 1 1 0;
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		justify-content: flex-start;
		padding-bottom: var(--s-1);
		pointer-events: none;
	}
	.stip {
		flex: none;
		/* The dot is 5.2 px in a cell of 6.5: the stack runs 6.5 px apart. */
		box-sizing: content-box;
		width: 5.2px;
		height: 5.2px;
		border: 0.65px solid transparent;
		border-radius: var(--r-rond);
		background: var(--ink-2) padding-box;
	}
	.kolom.is-dim .stip {
		background: var(--rule);
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
	.as {
		position: relative;
		height: var(--s-4);
		margin-top: var(--s-1);
	}
	.as span {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		white-space: nowrap;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 1;
		color: var(--rule);
	}
	.as span.is-in {
		font-weight: 600;
		color: var(--ink);
	}
	/* Without a period every year is a plain year in ink-3. */
	.tijdstrook:not(:has(.keuze)) .as span {
		font-weight: 400;
		color: var(--ink-3);
	}
	/* A phone shows it too: the period as heading, a year every second year, a taller band. */
	@media (max-width: 768px) {
		.tijdstrook {
			padding: var(--s-2) var(--s-4);
		}
		.kop {
			display: block;
		}
		.band {
			height: 64px;
		}
		.as span[data-tussen] {
			display: none;
		}
	}
</style>

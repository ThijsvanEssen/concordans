<script lang="ts">
	// The entries into the Hoge Raad over every area of law (B144, the plane "Ingangen naar de
	// Hoge Raad"): wide, the courts before it on the left, each with a line to the Hoge Raad and
	// under that line how and by what article; above the Hoge Raad the cases it hears in first and
	// only instance, under it the court after verwijzing. A line after one court alone is dashed.
	// On a phone the same as a list down the page.
	import CourtArticles from './CourtArticles.svelte';
	import type { CassationIntake } from './entries';
	import { lowerFirst } from '$lib/text/words';

	let { entries }: { entries: CassationIntake } = $props();
	const dashed = $derived(entries.into.some((e) => e.dashed));
</script>

<section class="ingangen" aria-labelledby="ingangen-kop">
	<h2 id="ingangen-kop">Ingangen naar de Hoge Raad</h2>
	<div class="schema">
		<ol class="in">
			{#each entries.into as e (e.name + e.stage + e.areas)}
				<li class={e.dashed ? 'stippel' : undefined}>
					<p class="kaart"><span class="naam">{e.name}</span> {e.stage}, {e.areas}</p>
					<p class="lijn raak-regels">{e.via}, <CourtArticles court={e.to} /></p>
				</li>
			{/each}
		</ol>
		{#if entries.first.length}
			<div class="boven">
				{#each entries.first as f (f.stage)}
					<p class="kaart raak-regels">
						<span class="naam">{f.stage}</span>
						{f.areas}, <CourtArticles court={f.court} />
					</p>
				{/each}
				<span class="pijl-neer" aria-hidden="true"></span>
			</div>
		{/if}
		<p class="kaart kern"><span class="naam">Hoge Raad</span> cassatie</p>
		{#if entries.out.length}
			<div class="onder">
				{#each entries.out as o (o.court.tier + o.stage)}
					<span class="pijl-neer" aria-hidden="true"></span>
					<p class="kaart raak-regels">
						<span class="naam">{o.court.name}</span>
						{lowerFirst(o.stage)}, {o.areas}: <CourtArticles court={o.court} />
					</p>
				{/each}
			</div>
		{/if}
	</div>
	{#if dashed}<p class="stil legenda">Gestippeld: alleen in enkele zaken.</p>{/if}
</section>

<style>
	.ingangen {
		--kaart-h: 4.5rem;
		--lijn: 2px solid var(--ink-3);
		--tussen: 3rem;
		margin-top: var(--s-6);
		padding-top: var(--s-4);
		border-top: 1px solid var(--rule);
	}
	h2 {
		margin: 0 0 var(--s-4);
		font: var(--niveau-1-sectie);
		color: var(--ink);
	}
	p {
		margin: 0;
	}
	.kaart {
		box-sizing: border-box;
		min-height: var(--kaart-h);
		padding: var(--s-2) var(--s-3);
		border: 1px solid var(--ink-3);
		border-radius: var(--r-2);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.naam {
		display: block;
		font-size: var(--t-body);
		color: var(--ink);
	}
	.kern {
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-height: calc(var(--kaart-h) * 1.4);
		border-color: var(--ink);
		background: var(--paper-2);
	}
	.kern .naam {
		font-weight: 600;
	}
	.lijn {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.legenda {
		margin: var(--s-3) 0 0;
		font-size: var(--t-meta);
	}
	.in {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	/* Wide: the courts on the left, their lines meet in one upright line that goes into the Hoge
	   Raad; above and under it the first and only instance and the court after verwijzing. */
	@media (min-width: 769px) {
		.schema {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(13rem, 17rem);
			grid-template-rows: 1fr auto 1fr;
			grid-template-areas: 'in boven' 'in kern' 'in onder';
		}
		.in {
			grid-area: in;
		}
		.in li {
			position: relative;
			display: grid;
			grid-template-columns: minmax(0, 15rem) minmax(0, 1fr);
			padding: var(--s-2) 0;
		}
		/* The line to the Hoge Raad at the height of the middle of the court; under it, how. */
		.lijn {
			margin-top: calc(var(--kaart-h) / 2 - 1px);
			padding: var(--s-1) var(--s-3) 0;
			border-top: var(--lijn);
		}
		.stippel .lijn {
			border-top-style: dashed;
		}
		/* The upright line, from the first court's line to the last. */
		.in li::after {
			content: '';
			position: absolute;
			right: 0;
			top: 0;
			bottom: 0;
			border-right: var(--lijn);
		}
		.in li:first-child::after {
			top: calc(var(--s-2) + var(--kaart-h) / 2 - 1px);
		}
		.in li:last-child::after {
			bottom: auto;
			height: calc(var(--s-2) + var(--kaart-h) / 2 + 1px);
		}
		.in li:only-child::after {
			display: none;
		}
		.boven,
		.onder {
			display: flex;
			flex-direction: column;
			padding-left: var(--tussen);
		}
		.boven {
			grid-area: boven;
			padding-top: var(--s-2);
		}
		.onder {
			grid-area: onder;
			padding-bottom: var(--s-2);
		}
		.kern {
			grid-area: kern;
			position: relative;
			margin-left: var(--tussen);
		}
		/* From the upright line into the Hoge Raad. */
		.kern::before {
			content: '';
			position: absolute;
			right: 100%;
			top: 50%;
			width: var(--tussen);
			border-top: var(--lijn);
		}
		.kern::after {
			content: '';
			position: absolute;
			right: 100%;
			top: calc(50% - 5px);
			border: 5px solid transparent;
			border-left: 7px solid var(--ink-3);
			border-right: 0;
		}
		/* Down into the Hoge Raad, and down out of it. */
		.pijl-neer {
			position: relative;
			flex: 1 0 var(--s-5);
			align-self: center;
			border-left: var(--lijn);
		}
		.pijl-neer::after {
			content: '';
			position: absolute;
			bottom: 0;
			left: -6px;
			border: 5px solid transparent;
			border-top: 7px solid var(--ink-3);
			border-bottom: 0;
		}
	}

	/* A phone: each court a card with how it goes to the Hoge Raad; then the Hoge Raad. */
	@media (max-width: 768px) {
		.in {
			display: flex;
			flex-direction: column;
			gap: var(--s-2);
		}
		.in li {
			padding: var(--s-2) var(--s-3);
			border: 1px solid var(--ink-3);
			border-radius: var(--r-2);
		}
		.in li.stippel {
			border-style: dashed;
		}
		.in .kaart {
			min-height: 0;
			padding: 0;
			border: 0;
		}
		.lijn::before {
			content: '→ ';
		}
		.boven {
			margin-top: var(--s-2);
		}
		.kaart {
			min-height: 0;
		}
		.pijl-neer {
			display: block;
			padding: var(--s-2) 0;
			text-align: center;
			color: var(--ink-3);
		}
		.pijl-neer::before {
			content: '↓';
		}
	}
</style>

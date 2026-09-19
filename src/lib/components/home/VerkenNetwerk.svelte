<script lang="ts">
	// Homepage-sectie: drie ingangen tot het netwerk in één coherente grid.
	// Wetgeving (wetboek-tiles), Rechtspraak (instantie-pyramide),
	// Parlement (hemicycle). Drie panels delen dezelfde header-grammar
	// (kicker · titel · sub) en sluiten af met een "Alle X →"-rij.
	import { onMount } from 'svelte';
	import { fetchZetels } from '$lib/api/parliamentary-client';
	import type { ZetelsResponse } from '$lib/api/parliamentary';
	import { goto } from '$app/navigation';
	import Hemicycle from '$lib/components/explore/Hemicycle.svelte';
	import InstantiePyramide from './InstantiePyramide.svelte';

	// ── Wetboek-tiles ────────────────────────────────────────────────────────
	// Zes wetboeken in twee kolommen; "Alle wetgeving →" als overflow.
	// De `spine`-property kleurt de linker rand van de tile (BW indigo,
	// Sr/Sv spine-rood, Awb olive, Gw ochre, AWR sepia).
	type Wetboek = {
		code: string;
		bwb: string;
		naam: string;
		domein: string;
		spine: 'indigo' | 'spine' | 'olive' | 'ochre' | 'sepia';
	};
	const WETBOEKEN: Wetboek[] = [
		{
			code: 'BW',
			bwb: 'BWBR0005289',
			naam: 'Burgerlijk Wetboek',
			domein: 'Civiel',
			spine: 'indigo'
		},
		{
			code: 'Sr',
			bwb: 'BWBR0001854',
			naam: 'Wetboek van Strafrecht',
			domein: 'Strafrecht',
			spine: 'spine'
		},
		{
			code: 'Sv',
			bwb: 'BWBR0001903',
			naam: 'Wetboek van Strafvordering',
			domein: 'Strafrecht',
			spine: 'spine'
		},
		{
			code: 'Awb',
			bwb: 'BWBR0005537',
			naam: 'Algemene wet bestuursrecht',
			domein: 'Bestuursrecht',
			spine: 'olive'
		},
		{ code: 'Gw', bwb: 'BWBR0001840', naam: 'Grondwet', domein: 'Staatsrecht', spine: 'ochre' },
		{
			code: 'AWR',
			bwb: 'BWBR0002320',
			naam: 'Algemene wet inzake rijksbelastingen',
			domein: 'Belastingrecht',
			spine: 'sepia'
		}
	];

	// ── Hemicycle-data — Tweede Kamer-zetels, live via /api/parlement/zetels.
	let zetels = $state<ZetelsResponse | null>(null);
	onMount(() => {
		fetchZetels()
			.then((r) => {
				zetels = r;
			})
			.catch(() => {
				/* silent — sectie blijft bruikbaar zonder hemicycle */
			});
	});

	function openFractie(key: string) {
		goto(`/explore?mode=split&focus=${encodeURIComponent(`fracties/${key}`)}`);
	}
</script>

<section class="vn-section" id="verken">
	<header class="vn-section-head">
		<div class="vn-section-kicker">Verken het netwerk</div>
		<div>
			<h2 class="vn-section-title">Drie ingangen, één netwerk</h2>
			<p class="vn-section-lede">
				Voor wie weet waar te beginnen. Open een wetboek voor de artikelen, klim de instanties op
				naar een arrest, of klik op een fractie voor haar leden en stemgedrag.
			</p>
		</div>
	</header>

	<div class="vn-grid">
		<!-- ── Wetgeving ───────────────────────────────────────────────── -->
		<div class="vn-cell">
			<section class="vn-panel">
				<div class="vn-panel-head">
					<div class="vn-panel-kicker">Wetgeving</div>
					<h3 class="vn-panel-title">Open een wetboek</h3>
				</div>
				<div class="vn-panel-visual">
					<div class="vn-tiles">
						{#each WETBOEKEN as w (w.code)}
							<a
								class="vn-tile"
								data-spine={w.spine}
								href={`/explore?focus=instruments%2F${w.bwb}`}
							>
								<div class="vn-tile-code">{w.code}</div>
								<div class="vn-tile-name">{w.naam}</div>
								<div class="vn-tile-foot">
									<span class="vn-tile-domein">{w.domein}</span>
									<span class="vn-tile-arrow" aria-hidden="true">→</span>
								</div>
							</a>
						{/each}
					</div>
				</div>
			</section>
		</div>

		<!-- ── Rechtspraak ─────────────────────────────────────────────── -->
		<div class="vn-cell">
			<section class="vn-panel">
				<div class="vn-panel-head">
					<div class="vn-panel-kicker">Rechtspraak</div>
					<h3 class="vn-panel-title">Klim de instanties op</h3>
				</div>
				<div class="vn-panel-visual">
					<div class="vn-frame vn-frame--pyramide">
						<InstantiePyramide />
					</div>
				</div>
			</section>
		</div>

		<!-- ── Parlement ───────────────────────────────────────────────── -->
		<div class="vn-cell">
			<section class="vn-panel">
				<div class="vn-panel-head">
					<div class="vn-panel-kicker">Parlement</div>
					<h3 class="vn-panel-title">Klik op een fractie</h3>
				</div>
				<div class="vn-panel-visual">
					{#if zetels}
						<Hemicycle data={zetels} onSelect={openFractie} />
					{:else}
						<div class="vn-hemicycle-placeholder" aria-hidden="true"></div>
					{/if}
				</div>
			</section>
		</div>
	</div>
</section>

<style>
	.vn-section {
		padding: 56px 0 40px;
		border-bottom: 1px solid var(--rule);
	}

	/* Sectie-header: smal kicker-label links, titel + lede rechts. Volgt
     dezelfde grid-grammar én max-width (1200px) als de andere
     homepage-secties — niet 1440px zoals het prototype suggereerde. */
	.vn-section-head {
		max-width: 1200px;
		margin: 0 auto 32px;
		padding: 0 32px 24px;
		display: grid;
		grid-template-columns: 220px 1fr;
		gap: 56px;
		align-items: start;
	}
	.vn-section-kicker {
		font-family: var(--font-sans);
		font-size: 11px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-3);
		padding-top: 10px;
		border-top: 1px solid var(--ink);
		width: fit-content;
	}
	.vn-section-title {
		margin: 0 0 16px;
		font-family: var(--font-serif);
		font-size: 40px;
		font-weight: 500;
		line-height: 1.08;
		letter-spacing: -0.012em;
		color: var(--ink);
	}
	.vn-section-lede {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 19px;
		line-height: 1.6;
		color: var(--ink-2);
		max-width: 58ch;
	}

	/* ── Drie-koloms grid ──────────────────────────────────────────── */
	.vn-grid {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 32px;
		display: grid;
		grid-template-columns: 1fr 1.05fr 1.15fr;
		align-items: stretch;
	}
	.vn-cell {
		padding: 24px 14px 18px;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.vn-cell:last-child {
		border-right: 0;
	}

	/* ── Panel-header (gelijk voor alle drie) ──────────────────────── */
	.vn-panel {
		display: flex;
		flex-direction: column;
		gap: 18px;
		min-width: 0;
		height: 100%;
	}
	.vn-panel-head {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.vn-panel-kicker {
		font-family: var(--font-sans);
		font-size: 10.5px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--fg-3);
		padding-bottom: 10px;
		border-bottom: 1px solid var(--rule);
		margin-bottom: 2px;
	}
	.vn-panel-title {
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: 24px;
		line-height: 1.12;
		letter-spacing: -0.01em;
		color: var(--ink);
		margin: 0;
		text-wrap: pretty;
	}

	.vn-panel-visual {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 0;
	}

	/* ── Wetgeving-tiles ──────────────────────────────────────────── */
	.vn-tiles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		background: var(--rule);
		border: 1px solid var(--rule);
		flex: 1;
		align-content: stretch;
	}
	.vn-tile {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding: 12px 12px 10px 14px;
		background: var(--paper);
		text-decoration: none;
		color: inherit;
		min-height: 86px;
		border-left: 2px solid var(--paper-edge, var(--rule));
		transition: background 120ms var(--ease);
	}
	.vn-tile:hover {
		background: var(--paper-2);
	}
	.vn-tile[data-spine='indigo'] {
		border-left-color: var(--indigo);
	}
	.vn-tile[data-spine='spine'] {
		border-left-color: var(--spine);
	}
	.vn-tile[data-spine='olive'] {
		border-left-color: var(--olive);
	}
	.vn-tile[data-spine='ochre'] {
		border-left-color: var(--ochre);
	}
	.vn-tile[data-spine='sepia'] {
		border-left-color: var(--sepia);
	}
	.vn-tile-code {
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--fg-3);
		letter-spacing: 0.02em;
	}
	.vn-tile-name {
		font-family: var(--font-serif);
		font-size: 17px;
		line-height: 1.15;
		color: var(--ink);
		font-weight: 500;
		letter-spacing: -0.005em;
		text-wrap: pretty;
		flex: 1;
	}
	.vn-tile-foot {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		margin-top: 4px;
	}
	.vn-tile-domein {
		font-family: var(--font-sans);
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.vn-tile-arrow {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--fg-4);
		transition:
			color 120ms var(--ease),
			transform 120ms var(--ease);
	}
	.vn-tile:hover .vn-tile-arrow {
		color: var(--accent);
		transform: translateX(2px);
	}
	.vn-tile:hover .vn-tile-name {
		color: var(--accent);
	}

	/* Pyramide-frame (rechtspraak) — paper-2 kaart die de cel-hoogte
	   vult. De Hemicycle heeft zijn eigen kaart (zie component CSS); we
	   matchen de styling daar zodat beide ingangen visueel rijmen. */
	.vn-frame--pyramide {
		background: var(--paper-2);
		border: 1px solid var(--rule);
		flex: 1;
		display: flex;
		padding: 22px 20px;
		align-items: center;
		min-height: 0;
	}
	.vn-frame--pyramide :global(.pyr) {
		width: 100%;
	}

	.vn-hemicycle-placeholder {
		/* Lege staat zolang /api/parlement/zetels nog niet geladen is —
       behoudt de visuele ruimte zodat de layout niet hapert. */
		min-height: 240px;
		flex: 1;
	}

	/* ── Responsive ────────────────────────────────────────────────── */
	@media (max-width: 1024px) {
		.vn-section-head {
			grid-template-columns: 1fr;
			gap: 24px;
		}
		.vn-section-kicker {
			border-top: none;
			border-bottom: 1px solid var(--ink);
			padding-top: 0;
			padding-bottom: 8px;
		}
		.vn-grid {
			grid-template-columns: 1fr;
		}
		.vn-cell {
			border-right: 0;
			border-bottom: 1px solid var(--rule);
			min-height: 0;
			padding: 32px 0;
		}
		.vn-cell:last-child {
			border-bottom: 0;
		}
	}

	@media (max-width: 640px) {
		.vn-section {
			padding: 56px 0;
		}
		.vn-section-head {
			padding: 0 20px 24px;
		}
		.vn-grid {
			padding: 0 20px;
		}
		.vn-section-title {
			font-size: 30px;
		}
		.vn-panel-title {
			font-size: 22px;
		}
	}
</style>

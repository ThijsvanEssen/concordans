<script lang="ts">
	// Ontwerpstudie ronde 4 (prototype): de gedeelde tijdlijn. Datum links in een vaste
	// kolom, een teken op een doorlopende lijn, dan de zin. Een besluit krijgt het vakje van
	// Uitkomst (vorm en kleur); wat nog kan volgen staat gestippeld en zegt dat het kan volgen.
	import { dagMaand, type TijdGroep } from './tijdlijn';

	let {
		groepen,
		jaar = false,
		datums = true
	}: { groepen: TijdGroep[]; jaar?: boolean; /** Zonder datumkolom als de kop de dag al noemt. */ datums?: boolean } = $props();
</script>

<div class="tl" class:zonder={!datums}>
	{#each groepen as g (g.id)}
		<section class="groep">
			<h4 class="kop">{g.titel}{#if g.sub}<span class="sub">{g.sub}</span>{/if}</h4>
			<ol class="regels">
				{#each g.regels as r (r.id)}
					<li class="regel regel--{r.teken}" class:groot={r.groot}>
						<span class="datum">{r.datum ? dagMaand(r.datum) : ''}{#if jaar && r.datum}<span class="j"> {r.datum.slice(0, 4)}</span>{/if}</span>
						<span class="teken" aria-hidden="true"></span>
						<span class="tekst">
							{#if r.label}<span class="label">{r.label}</span>{/if}
							{#if r.href}<a href={r.href} class="zin">{r.zin}</a>{:else}<span class="zin">{r.zin}</span>{/if}
							{#if r.meta}<span class="meta">{r.meta}</span>{/if}
						</span>
					</li>
				{/each}
			</ol>
			{#if g.noot}<p class="noot">{g.noot}</p>{/if}
		</section>
	{/each}
</div>

<style>
	.tl {
		display: flex;
		flex-direction: column;
		gap: var(--s-5);
	}
	.kop {
		margin: 0;
		padding-bottom: var(--s-2);
		border-bottom: 2px solid var(--ink);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
		display: flex;
		gap: var(--s-2);
		align-items: baseline;
	}
	.sub {
		font-weight: 400;
		color: var(--ink-3);
	}
	.regels {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.regel {
		display: grid;
		grid-template-columns: 4rem 20px minmax(0, 1fr);
		gap: 0 var(--s-2);
		position: relative;
	}
	/* De doorlopende lijn door de tekens. */
	.regel::before {
		content: '';
		position: absolute;
		left: calc(4rem + var(--s-2) + 9px);
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--rule);
	}
	.regel:first-child::before {
		top: var(--s-3);
	}
	.regel:last-child::before {
		bottom: calc(100% - var(--s-3) - 6px);
	}
	.datum {
		padding: var(--s-2) 0;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-2);
		font-variant-numeric: tabular-nums;
		text-align: right;
		line-height: 1.6;
	}
	.j {
		color: var(--ink-3);
	}
	.teken {
		position: relative;
		z-index: 1;
		justify-self: center;
		margin-top: calc(var(--s-2) + 5px);
		width: 9px;
		height: 9px;
		box-sizing: border-box;
		background: var(--paper);
		border: 1.5px solid var(--ink-2);
		border-radius: 50%;
	}
	.regel--stuk .teken {
		background: var(--ink-2);
	}
	.regel--ja .teken {
		border-radius: 0;
		width: 11px;
		height: 11px;
		border: 0;
		background: var(--uitkomst-ja, #456247);
	}
	.regel--nee .teken {
		border-radius: 0;
		width: 11px;
		height: 11px;
		border: 2px solid var(--uitkomst-nee, #8c2f28);
	}
	/* Openstaand: het vakje van Uitkomst (gestippeld), de tekst gewoon. */
	.regel--open .teken {
		border-radius: 0;
		width: 11px;
		height: 11px;
		border: 1.5px dashed var(--ink-2);
	}
	.regel--verwacht .teken {
		border-radius: 0;
		border: 1.5px dashed var(--ink-3);
	}
	.tekst {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--s-2) 0;
		border-bottom: 1px solid var(--rule);
		min-width: 0;
	}
	.label {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-2);
	}
	.regel--ja .label {
		color: var(--uitkomst-ja, #456247);
	}
	.regel--nee .label {
		color: var(--uitkomst-nee, #8c2f28);
	}
	.zin {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: var(--lh-snug);
		color: var(--ink);
		text-decoration: none;
		text-wrap: pretty;
	}
	a.zin:hover {
		color: var(--accent);
	}
	.groot .zin {
		font-size: var(--t-h3);
		font-weight: 500;
	}
	.regel--verwacht .zin {
		color: var(--ink-3);
		font-style: italic;
	}
	.meta {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.noot {
		margin: var(--s-2) 0 0 calc(4rem + 20px + var(--s-4));
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.zonder .regel {
		grid-template-columns: 0 20px minmax(0, 1fr);
		gap: 0 var(--s-2);
	}
	.zonder .datum {
		visibility: hidden;
	}
	.zonder .regel::before {
		left: calc(var(--s-2) + 9px);
	}
	.zonder .noot {
		margin-left: calc(20px + var(--s-4));
	}
</style>

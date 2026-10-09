<script lang="ts">
	import BronLink from '$lib/bron/BronLink.svelte';
	// De gedeelde tijdlijn. Datum links in een vaste
	// kolom, een teken op een doorlopende lijn, dan de zin. Een besluit krijgt het vakje van
	// Uitkomst (vorm en kleur); wat nog kan volgen staat gestippeld en zegt dat het kan volgen.
	import { dagMaand, type TijdGroep } from './tijdlijn';
	import { vandaag } from '$lib/text/datum';
	import Caret from '$lib/components/ui/Caret.svelte';
	import { isOpen, zetOpen } from '$lib/components/ui/dicht.svelte';
	import { VORMEN, VORM_VAN } from '$lib/bron/vormen';
	// Het teken op de lijn is het bronteken zelf; de uitkomst zit in vulling en kleur.
	const vormVanSoort = (s: string | null | undefined) =>
		s ? VORMEN[VORM_VAN[s as keyof typeof VORM_VAN] ?? 'overig'] : null;

	let {
		groepen,
		jaar = 'anders',
		datums = true,
		inklapbaar = false
	}: {
		groepen: TijdGroep[];
		/** The year under the day: always, never, or only when it is not this year. */
		jaar?: boolean | 'anders';
		/** Zonder datumkolom als de kop de dag al noemt. */ datums?: boolean;
		/** Each group's heading opens and closes it (the procedure of a dossier: the Raad van
		 *  State, the Tweede and the Eerste Kamer); open until closed, kept per heading. */
		inklapbaar?: boolean;
	} = $props();
	const ditJaar = vandaag().slice(0, 4);
	const metJaar = (iso: string) =>
		jaar === true || (jaar === 'anders' && iso.slice(0, 4) !== ditJaar);
</script>

<div class="tl" class:zonder={!datums}>
	{#each groepen as g (g.id)}
		{@const sleutel = `sub:${g.titel}`}
		{@const open = !inklapbaar || isOpen(sleutel, true)}
		<section class="groep">
			<h4 class="kop">
				{#if inklapbaar}
					<button
						type="button"
						class="kop-knop"
						aria-expanded={open}
						onclick={() => zetOpen(sleutel, !open)}
						>{g.titel}{#if g.sub}<span class="sub">{g.sub}</span>{/if}<Caret {open} side /></button
					>
				{:else}
					{g.titel}{#if g.sub}<span class="sub">{g.sub}</span>{/if}
				{/if}
			</h4>
			{#if open}
				<ol class="regels">
					{#each g.regels as r (r.id)}
						{@const v = vormVanSoort(r.soort)}
						<li class="regel regel--{r.teken}" class:groot={r.groot}>
							<span class="datum"
								>{r.datum ? dagMaand(r.datum) : ''}{#if r.datum && metJaar(r.datum)}<span class="j"
										>{r.datum.slice(0, 4)}</span
									>{/if}</span
							>
							{#if v}
								<svg class="bteken" width="14" height="14" viewBox="-1 -1 18 18" aria-hidden="true"
									><path
										d={v.d}
										fill-rule={v.wijze === 'gat' ? 'evenodd' : 'nonzero'}
										class:vol={v.wijze !== 'lijn' &&
											(r.teken === 'ja' || r.teken === 'stuk' || r.teken === 'activiteit')}
									/></svg
								>
							{:else}
								<span class="teken" aria-hidden="true"></span>
							{/if}
							<span class="tekst">
								{#if r.label}<span class="label">{r.label}</span>{/if}
								{#if r.ref}<BronLink ref={r.ref} class="zin">{r.zin}</BronLink>{:else if r.href}<a
										href={r.href}
										rel={/^https?:/.test(r.href) ? 'external' : undefined}
										class="zin">{r.zin}</a
									>{:else if r.actie}<button type="button" class="zin zin--actie" onclick={r.actie}
										>{r.zin}</button
									>{:else}<span class="zin">{r.zin}</span>{/if}
								{#if r.meta}<span class="meta">{r.meta}</span>{/if}
							</span>
						</li>
					{/each}
				</ol>
				{#if g.noot}<p class="noot">{g.noot}</p>{/if}
			{/if}
		</section>
	{/each}
</div>

<style>
	/* A line that leads to a list on the page: read as the other lines, underlined as a link. */
	.zin--actie {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		text-align: left;
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.zin--actie:hover {
		text-decoration-color: currentColor;
	}
	.tl {
		display: flex;
		flex-direction: column;
		gap: var(--s-5);
	}
	.kop {
		margin: 0;
		padding-bottom: var(--s-2);
		border-bottom: 2px solid var(--ink);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
		display: flex;
		gap: var(--s-2);
		align-items: baseline;
	}
	/* The heading is the button: its own letter, no frame. */
	.kop-knop {
		display: inline-flex;
		align-items: baseline;
		gap: var(--s-2);
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
		text-align: left;
	}
	.kop-knop:hover {
		color: var(--accent);
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
		/* Where the line opens for the teken of the row: the teken stands on the page
		   itself, with no plate of its own, in light and dark alike. */
		--gat-van: calc(var(--s-2) + 1px);
		--gat-tot: calc(var(--s-2) + 19px);
	}
	.regel:has(.teken) {
		--gat-van: calc(var(--s-2) + 3px);
		--gat-tot: calc(var(--s-2) + 18px);
	}
	/* De doorlopende lijn door de tekens, open waar het teken staat. */
	.regel::before {
		content: '';
		position: absolute;
		left: calc(4rem + var(--s-2) + 9px);
		top: 0;
		bottom: 0;
		width: 1px;
		background: linear-gradient(
			to bottom,
			var(--rule) var(--gat-van),
			transparent var(--gat-van) var(--gat-tot),
			var(--rule) var(--gat-tot)
		);
	}
	.regel:first-child::before {
		top: var(--gat-tot);
		background: var(--rule);
	}
	.regel:last-child::before {
		bottom: calc(100% - var(--s-3) - 6px);
	}
	.datum {
		padding: var(--s-2) 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
		text-align: right;
		line-height: 1.6;
	}
	.j {
		display: block;
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
		background: transparent;
		border: 1.5px solid var(--ink-2);
		border-radius: 50%;
	}
	/* Het bronteken op de lijn: gevuld in inkt; aangenomen of afgedaan in mos; verworpen als
	   omtrek in het accent; openstaand of verwacht als gestippelde omtrek. */
	.bteken {
		position: relative;
		z-index: 1;
		justify-self: center;
		margin-top: calc(var(--s-2) + 3px);
		overflow: visible;
	}
	.bteken path {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1.6;
	}
	.bteken path.vol {
		fill: var(--ink);
		stroke: none;
	}
	.regel--ja .bteken path.vol {
		fill: var(--uitkomst-ja);
	}
	.regel--nee .bteken path {
		stroke: var(--uitkomst-nee);
		stroke-width: 2;
	}
	.regel--open .bteken path,
	.regel--verwacht .bteken path {
		stroke-dasharray: 2 1.5;
		stroke: var(--ink-2);
	}
	.regel--stuk .teken {
		background: var(--ink-2);
	}
	.regel--ja .teken {
		border-radius: 0;
		width: 11px;
		height: 11px;
		border: 0;
		background: var(--uitkomst-ja);
	}
	.regel--nee .teken {
		border-radius: 0;
		width: 11px;
		height: 11px;
		border: 2px solid var(--uitkomst-nee);
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
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-2);
	}
	.regel--ja .label {
		color: var(--uitkomst-ja);
	}
	.regel--nee .label {
		color: var(--uitkomst-nee);
	}
	.zin,
	.tekst :global(a.zin) {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: var(--lh-snug);
		color: var(--ink);
		text-decoration: none;
		text-wrap: pretty;
	}
	.tekst :global(a.zin:hover) {
		color: var(--accent);
	}
	.groot .zin,
	.groot :global(a.zin) {
		font-size: var(--t-h3);
		font-weight: 600;
	}
	.regel--verwacht .zin,
	.regel--verwacht :global(a.zin) {
		color: var(--ink-3);
		font-style: italic;
	}
	.meta {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.noot {
		margin: var(--s-2) 0 0 calc(4rem + 20px + var(--s-4));
		font-family: var(--font-serif);
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

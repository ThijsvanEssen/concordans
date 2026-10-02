<script lang="ts">
	import BronLink from '$lib/bron/BronLink.svelte';
	// Één vorm voor elke geopende rij in Bladeren.
	// Bovenaan wat het is in één zin; dan wat er recent gebeurde in de gedeelde tijdlijn,
	// zodat zonder klikken te zien is wat iemand of iets deed; dan links met aantallen; dan
	// dezelfde twee knoppen als bij een dossier.
	import type { Snippet } from 'svelte';
	import Tijdlijn from '$lib/components/tijdlijn/Tijdlijn.svelte';
	import Picto from '$lib/components/ui/Picto.svelte';
	import type { TijdGroep } from '$lib/components/tijdlijn/tijdlijn';

	let {
		zin = null,
		groepen = [],
		laden = false,
		links = [],
		lezen,
		lezenLabel,
		netwerk,
		boven,
		opmerkingen = []
	}: {
		/** Alleen wat de rij zelf nog niet zegt. */
		zin?: string | null;
		groepen?: TijdGroep[];
		laden?: boolean;
		/** With `ref`, the link is a bron: a click opens it in place (BronLink). */
		links?: { label: string; href?: string | null; ref?: string | null }[];
		lezen: string;
		lezenLabel: string;
		netwerk: string;
		/** Iets dat boven de tijdlijn hoort, zoals de standbalk van een dossier. */
		boven?: Snippet;
		/** Korte kanttekeningen onder de zin, zoals waarom iemand waarnam. */
		opmerkingen?: string[];
	} = $props();
</script>

<div class="or">
	{#if zin}<p class="zin">{zin}</p>{/if}
	{#each opmerkingen as o (o)}<p class="opmerking">{o}</p>{/each}
	{@render boven?.()}
	{#if laden}
		<p class="laden">Laden…</p>
	{:else if groepen.some((g) => g.regels.length)}
		<Tijdlijn {groepen} />
	{/if}
	{#if links.length}
		<p class="links">
			{#each links as l, i (l.label)}{#if i > 0}<span class="sep">,</span>{/if}{#if l.ref}<BronLink
						ref={l.ref}>{l.label}</BronLink
					>{:else if l.href}<a href={l.href}>{l.label}</a>{:else}<span>{l.label}</span>{/if}{/each}
		</p>
	{/if}
	<div class="acts">
		<a class="act act--pri" href={lezen}><Picto naam="tekst" size={13} />{lezenLabel}</a>
		<a class="act" href={netwerk}><Picto naam="netwerk" size={13} />In het netwerk</a>
	</div>
</div>

<style>
	.or {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		padding: var(--s-4) var(--s-4) var(--s-5);
		max-width: 52rem;
	}
	.zin {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-snug);
		color: var(--ink);
	}
	.opmerking {
		margin: calc(-1 * var(--s-2)) 0 0;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.laden {
		margin: 0;
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--ink-3);
	}
	.links {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.links :global(a) {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.sep {
		color: var(--ink-3);
	}
	.acts {
		display: flex;
		gap: var(--s-2);
		flex-wrap: wrap;
	}
	.act {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-weight: 500;
		padding: var(--s-2) var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		color: var(--ink);
		text-decoration: none;
	}
	.act--pri {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--paper);
	}
</style>

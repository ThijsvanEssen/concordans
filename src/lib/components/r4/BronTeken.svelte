<script lang="ts">
	// Ontwerpstudie ronde 4 (prototype): het teken van een bron. De vorm zegt wat het is,
	// de kleur in welk domein het hoort (recht, parlement, regering). Wie iets deed, krijgt
	// geen teken: dat staat als naam in de zin.
	export type Vorm = 'regel' | 'regel-o' | 'uitspraak' | 'stuk' | 'dossier' | 'besluit' | 'toezegging' | 'persoon' | 'orgaan' | 'orgaan-o';
	export type Domein = 'recht' | 'parlement' | 'regering';
	let {
		vorm,
		domein,
		size = 14,
		kleur = false
	}: {
		vorm: Vorm;
		domein: Domein;
		size?: number;
		/** Ronde 4b: standaard in inkt; de vorm draagt de betekenis, er valt geen kleur te onthouden. */
		kleur?: boolean;
	} = $props();
</script>

<svg class="bt" class:bt--recht={kleur && domein === 'recht'} class:bt--parlement={kleur && domein === 'parlement'} class:bt--regering={kleur && domein === 'regering'} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
	{#if vorm === 'regel'}<rect x="2" y="2" width="12" height="12" />
	{:else if vorm === 'regel-o'}<rect x="3" y="3" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" />
	{:else if vorm === 'uitspraak'}<circle cx="8" cy="8" r="6.5" />
	{:else if vorm === 'stuk'}<path d="M3.5 1h6.5l3 3v11H3.5z" />
	{:else if vorm === 'dossier'}<path d="M1 3.5h5l1.5 1.5H15V14H1z" />
	{:else if vorm === 'besluit'}<path d="M8 1.5 15 14.5H1z" />
	{:else if vorm === 'toezegging'}<path d="M3 1h1.6v14H3zM4.6 2H14l-3 3.5L14 9H4.6z" />
	{:else if vorm === 'persoon'}<circle cx="8" cy="4.6" r="3.2" /><path d="M1.5 15c0-4.2 2.9-6.4 6.5-6.4s6.5 2.2 6.5 6.4z" />
	{:else if vorm === 'orgaan'}<path d="M8 1 14.5 4.75v7.5L8 16 1.5 12.25v-7.5z" />
	{:else}<path d="M8 2.2 13.5 5.4v5.2L8 13.8 2.5 10.6V5.4z" fill="none" stroke="currentColor" stroke-width="2" />{/if}
</svg>

<style>
	.bt {
		flex: none;
		color: var(--ink);
		fill: currentColor;
		vertical-align: -2px;
	}
	.bt--recht {
		color: var(--domein-recht, #2f3e5e);
	}
	.bt--parlement {
		color: var(--domein-parlement, #5e3a55);
	}
	.bt--regering {
		color: var(--domein-regering, #7a5410);
	}
</style>

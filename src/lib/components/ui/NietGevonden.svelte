<script lang="ts">
	// The page for what Concordans does not have: an unknown path (+error.svelte, 404) and a
	// readable address of a bron the data lacks (the Verkenner). One page for both, with the
	// title the server gives its 404 ("Niet gevonden, Concordans"), and noindex, so a search
	// engine keeps no empty page. The SEO plan: ~/Development/marktonderzoek-seo.md, part 2.
	// A page that failed (+error.svelte, 5xx or no connection) has the same frame: its title
	// and its own way on, no text.
	import type { Snippet } from 'svelte';
	import { serverKop, siteTitle } from '$lib/seo/server-head.svelte';

	let {
		status = 404,
		title = 'Pagina niet gevonden',
		kop = true,
		code = String(status),
		children,
		actions
	}: {
		status?: number;
		title?: string;
		/** Whether this page sets the title; the Verkenner sets its own. */
		kop?: boolean;
		/** The small line above the title: the status, or nothing where there is none. */
		code?: string | null;
		/** What is missing, in a sentence or two; for a 404 a default where none is given. */
		children?: Snippet;
		/** The ways on; by default the startpagina and Samenhang. */
		actions?: Snippet;
	} = $props();

	const fout = $derived(status !== 404);
</script>

<svelte:head>
	{#if kop}
		{#if !serverKop.actief}<title>{siteTitle(fout ? title : 'Niet gevonden')}</title>{/if}
		{#if !fout}<meta name="robots" content="noindex" />{/if}
	{/if}
</svelte:head>

<div class="niet-gevonden">
	<div class="inner">
		{#if code}<span class="code">{code}</span>{/if}
		<h1>{title}</h1>
		{#if children || !fout}
			<div class="tekst">
				{#if children}
					{@render children()}
				{:else}
					<p>Deze pagina bestaat niet of is verplaatst.</p>
				{/if}
			</div>
		{/if}
		<div class="acties">
			{#if actions}
				{@render actions()}
			{:else}
				<a href="/" class="btn is-primary">Naar de startpagina</a>
				<a href="/explore" class="btn">Open Samenhang</a>
			{/if}
		</div>
	</div>
</div>

<style>
	.niet-gevonden {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--s-8) var(--s-5);
	}
	.inner {
		max-width: 480px;
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}
	.code {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	h1 {
		font-weight: 600;
		font-size: var(--t-h1);
		line-height: var(--lh-tight);
		margin: 0;
		color: var(--ink);
	}
	.tekst {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink-2);
	}
	.tekst :global(p) {
		margin: 0;
	}
	.acties {
		display: flex;
		gap: var(--s-2);
		margin-top: var(--s-2);
		flex-wrap: wrap;
	}
</style>

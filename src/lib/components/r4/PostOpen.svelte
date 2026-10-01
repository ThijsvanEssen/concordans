<script lang="ts">
	// Ontwerpstudie ronde 4 (prototype): een geopende post in Bewindspersonen. Eerst wie en
	// wat in één zin, dan drie ingangen met aantallen (altijd, ook bij nul), dan twee knoppen.
	import { api, unwrap } from '$lib/api/client';
	import { bronHref, indexHref } from '$lib/bron/href';
	import { datum } from '$lib/components/parliamentary/stand';

	let {
		memberKey,
		naam,
		partij,
		functie,
		van,
		tot,
		dossiers,
		wetsvoorstellen
	}: {
		memberKey: string;
		naam: string;
		partij: string | null;
		functie: string;
		van: string | null;
		tot: string | null;
		dossiers: number;
		wetsvoorstellen: number;
	} = $props();

	let toezeggingen = $state<{ total: number; open: number } | null>(null);
	$effect(() => {
		const ac = new AbortController();
		unwrap(api.GET('/api/commitments', { params: { query: { member: memberKey, limit: 1 } }, signal: ac.signal }))
			.then((r) => {
				const open = r.facets?.status?.find((s) => s.value === 'Openstaand')?.count ?? 0;
				toezeggingen = { total: r.total, open };
			})
			.catch(() => (toezeggingen = null));
		return () => ac.abort();
	});
	const bron = $derived(`members/${memberKey}`);
</script>

<div class="po">
	<p class="wie"><a href={bronHref(bron, { keepMode: false, mode: 'read' }) + '&ontwerp=r4'}>{naam}</a>{#if partij}<span class="p">{partij}</span>{/if}</p>
	<p class="zin">{functie}, {tot ? `van ${datum(van)} tot ${datum(tot)}` : `sinds ${datum(van)}`}.</p>
	<ul class="ing">
		<li>
			{#if toezeggingen && toezeggingen.total}
				<a href={indexHref('commitments', { member: memberKey })}><b>{toezeggingen.total}</b> toezeggingen</a>
				<span class="s">{toezeggingen.open ? `${toezeggingen.open} openstaand` : 'geen openstaand'}</span>
			{:else}
				<span class="leeg"><b>0</b> toezeggingen in de gegevens</span>
			{/if}
		</li>
		<li><span><b>{dossiers}</b> dossiers ondertekend</span><span class="s">als bewindspersoon in deze post</span></li>
		<li><span><b>{wetsvoorstellen}</b> wetsvoorstellen</span><span class="s">daarvan</span></li>
	</ul>
	<div class="acts">
		<a class="act act--pri" href={bronHref(bron, { keepMode: false, mode: 'read' }) + '&ontwerp=r4'}>Bewindspersoon lezen →</a>
		<a class="act" href={bronHref(bron, { keepMode: false, mode: 'graph' })}>Toon in netwerk →</a>
	</div>
</div>

<style>
	.po {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		padding: var(--s-4);
		background: var(--paper);
		border-left: 4px solid var(--ink);
	}
	.wie {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 500;
	}
	.wie a {
		color: var(--ink);
		text-decoration: none;
	}
	.wie a:hover {
		color: var(--accent);
	}
	.p {
		margin-left: var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.zin {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	.ing {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--s-3);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
	}
	.ing li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		border-top: 2px solid var(--ink);
		padding-top: var(--s-2);
	}
	.ing a {
		color: var(--ink);
	}
	.ing b {
		display: block;
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 500;
	}
	.s,
	.leeg {
		color: var(--ink-3);
		font-size: var(--t-micro);
	}
	.acts {
		display: flex;
		gap: var(--s-2);
		flex-wrap: wrap;
	}
	.act {
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

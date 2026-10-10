<script lang="ts">
	// Toelichting: what the memorie says about the text on screen, read in place, under it
	// (Thijs, 10 Oct: "zo eigenstandig mogelijk lezen"). The memorie itself, one step further,
	// opens under the article as before. The passages are asked once the section is open
	// (`/api/documents/{key}/passages`), in document order, each under its heading.
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';

	let {
		document: doc,
		bwbId,
		artikel,
		href,
		perDossier
	}: {
		/** The memorie: its key, its kind and its dossier. */
		document: { key: string; kind: string | null; dossier: string | null };
		bwbId: string;
		artikel: string;
		/** Where the memorie opens in full, under the article. */
		href: string | null;
		/** It explains the change of its wet as a whole, not this article by name. */
		perDossier: boolean;
	} = $props();

	type Passage = Schema<'PassageDTO'>;
	let open = $state(false);
	let stand = $state<'wacht' | 'laden' | 'klaar' | 'fout'>('wacht');
	let passages = $state<Passage[]>([]);
	/** The longest a passage shows before "Hele passage"; the memorie has the rest. */
	const KORT = 1400;
	let heel = $state<Record<string, boolean>>({});

	$effect(() => {
		const key = doc.key;
		const bwb = bwbId;
		const art = artikel;
		passages = [];
		stand = 'wacht';
		heel = {};
		if (!open || !bwb || !art) return;
		const ac = new AbortController();
		stand = 'laden';
		unwrap(
			api.GET('/api/documents/{key}/passages', {
				params: { path: { key }, query: { bwb_id: bwb, article: art } },
				signal: ac.signal
			})
		)
			.then((r) => {
				passages = r.items;
				stand = 'klaar';
			})
			.catch(() => {
				if (!ac.signal.aborted) stand = 'fout';
			});
		return () => ac.abort();
	});
	const naam = $derived(doc.kind ?? 'Memorie van toelichting');
</script>

<Sectie titel="Toelichting" id="toelichting" sleutel="Toelichting" standaardOpen bind:open>
	<p class="bron">
		{#if href}<a {href} data-sveltekit-noscroll>{naam}</a>{:else}{naam}{/if}{doc.dossier
			? `, Kamerstukken ${doc.dossier}`
			: ''}
	</p>
	{#if stand === 'laden'}
		<p class="stil">Laden…</p>
	{:else if stand === 'fout'}
		<p class="stil">De passage kon niet worden geladen.</p>
	{:else if stand === 'klaar' && passages.length === 0}
		<p class="stil">
			Geen passage over dit artikel; de memorie licht {perDossier ? 'de wijziging' : 'het artikel'}
			als geheel toe.
		</p>
	{:else}
		{#each passages as p (p.section_id + ':' + p.char_start)}
			{@const lang = (p.text ?? '').length > KORT && !heel[p.section_id]}
			<section class="passage">
				{#if p.heading}<h3>{p.heading}</h3>{/if}
				<p class="tekst">{lang ? `${(p.text ?? '').slice(0, KORT).trimEnd()}…` : p.text}</p>
				{#if lang}
					<button
						type="button"
						class="meer"
						onclick={() => (heel = { ...heel, [p.section_id]: true })}>Hele passage</button
					>
				{/if}
			</section>
		{/each}
	{/if}
</Sectie>

<style>
	.bron {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	.bron a {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 2px;
	}
	.bron a:hover {
		color: var(--accent);
	}
	.stil {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.passage h3 {
		margin: var(--s-2) 0 var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
	}
	/* The memorie's words as it writes them, the reader's measure. */
	.tekst {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: var(--lh-body);
		color: var(--ink-2);
		white-space: pre-line;
	}
	.meer {
		margin-top: var(--s-1);
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
	}
	.meer:hover {
		color: var(--accent);
	}
</style>

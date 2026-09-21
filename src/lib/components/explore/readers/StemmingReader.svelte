<script lang="ts">
	// Reader for stemming nodes (collection 'stemmingen', kind 'other' in
	// GraphNodeKind). Loads detail + chases the underlying motie/amendement
	// text via stemming → besluit → publication.
	import type { GraphNode } from '$lib/graph/types';
	import { fetchStemming } from '$lib/api/parliamentary-client';
	import { getNodeGraph } from '$lib/api/nodes';
	import { getPublicationText } from '$lib/api/mvt';
	import type { StemmingDetailDTO } from '$lib/api/parliamentary';
	import { formatLongDate, seatTotal } from './_shared';

	let { node }: { node: GraphNode } = $props();

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| { kind: 'loaded'; s: StemmingDetailDTO; motieText: string | null; motieTitle: string | null };

	let view = $state<State>({ kind: 'loading' });
	let token = 0;

	$effect(() => {
		const n = node;
		const t = ++token;
		view = { kind: 'loading' };

		fetchStemming(n.key)
			.then(async (s) => {
				if (t !== token) return;
				// Walk stemming → publications (direct) or stemming → besluit → publication
				// to recover the motie/amendement text. Same chain as the legacy page.
				let motieText: string | null = null;
				let motieTitle: string | null = null;
				try {
					const sg = await getNodeGraph('stemmingen', n.key);
					const neighbors = sg.neighbors?.all ?? [];
					const direct = neighbors.find((nb) => nb.collection === 'publications');
					if (direct) {
						const pub = await getPublicationText(direct.key).catch(() => null);
						motieText = pub?.text ?? null;
						motieTitle = pub?.title ?? null;
					} else {
						const besluiten = neighbors.filter(
							(nb) => nb.collection === 'besluiten' || nb.type === 'besluit'
						);
						for (const b of besluiten) {
							const bg = await getNodeGraph(b.collection, b.key).catch(() => null);
							const pubN = bg?.neighbors?.all?.find((nb) => nb.collection === 'publications');
							if (pubN) {
								const pub = await getPublicationText(pubN.key).catch(() => null);
								if (pub) {
									motieText = pub.text;
									motieTitle = pub.title;
									break;
								}
							}
						}
					}
				} catch {
					/* swallow */
				}
				if (t !== token) return;
				view = { kind: 'loaded', s, motieText, motieTitle };
			})
			.catch(() => {
				if (t === token) view = { kind: 'error', message: 'Stemming kon niet geladen worden.' };
			});
	});
</script>

<div class="r-stemming">
	{#if view.kind === 'loading'}
		<p class="loading">Laden…</p>
	{:else if view.kind === 'error'}
		<p class="error">{view.message}</p>
	{:else}
		{@const s = view.s}
		{@const voorTotal = seatTotal(s.voor)}
		{@const tegenTotal = seatTotal(s.tegen)}
		{@const totalCast = voorTotal + tegenTotal}
		{@const voorPct = totalCast > 0 ? Math.round((voorTotal / totalCast) * 100) : 50}

		<header class="head">
			<span class="kicker">Stemming · {formatLongDate(s.datum)}</span>
			<h2 class="title">{view.motieTitle ?? s.onderwerp ?? 'Onderwerp niet beschikbaar'}</h2>
			<div class="chips">
				<span
					class="uitslag-chip"
					class:uitslag-chip--ja={s.aangenomen}
					class:uitslag-chip--nee={!s.aangenomen}
				>
					{s.aangenomen ? 'Aangenomen' : 'Verworpen'}
				</span>
				{#if s.dossier_nummers?.length}
					{#each s.dossier_nummers.slice(0, 3) as nr, i (i)}
						<a href="/explore?focus=kamerstukdossiers/{nr}" class="dossier-chip">{nr}</a>
					{/each}
				{/if}
			</div>
		</header>

		{#if view.motieText}
			{@const docType = (() => {
				const t = (view.motieTitle ?? s.onderwerp ?? '').toLowerCase();
				if (t.includes('amendement')) return 'Amendement';
				if (t.includes('motie')) return 'Motie';
				return 'Document';
			})()}
			<section class="sec">
				<h3 class="sec-title">{docType}</h3>
				<p class="motie-text">{view.motieText}</p>
			</section>
		{:else}
			<p class="motie-unavail">Tekst niet beschikbaar.</p>
		{/if}

		<div class="vote-summary">
			<div class="vote-bar" title="Voor: {voorTotal} · Tegen: {tegenTotal}">
				<div class="vote-bar-voor" style="width: {voorPct}%"></div>
			</div>
			<div class="vote-totals">
				<span class="vote-total vote-total--voor">{voorTotal} voor</span>
				<span class="vote-total-sep">·</span>
				<span class="vote-total vote-total--tegen">{tegenTotal} tegen</span>
				{#if s.onthouding.length > 0}
					<span class="vote-total-sep">·</span>
					<span class="vote-total vote-total--onth">{seatTotal(s.onthouding)} onthouding</span>
				{/if}
			</div>
		</div>

		{#if s.voor.length > 0 || s.tegen.length > 0}
			{@const allParties = [
				...s.voor.map((v) => ({ ...v, stem: 'voor' as const })),
				...s.tegen.map((v) => ({ ...v, stem: 'tegen' as const })),
				...s.onthouding.map((v) => ({ ...v, stem: 'onth' as const }))
			].sort((a, b) => b.aantal_zetels - a.aantal_zetels)}
			<section class="sec">
				<h3 class="sec-title">Stemverdeling per fractie</h3>
				<ul class="party-list">
					{#each allParties as p, i (i)}
						<li class="party-row party-row--{p.stem}">
							<span class="party-stem"
								>{p.stem === 'voor' ? 'Voor' : p.stem === 'tegen' ? 'Tegen' : 'Onth.'}</span
							>
							<span class="party-name">{p.partij}</span>
							<span class="party-seats">{p.aantal_zetels}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</div>

<style>
	.r-stemming {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		padding: var(--s-5) var(--s-5) var(--s-6);
		color: var(--ink-2);
		height: 100%;
		overflow-y: auto;
	}
	.loading,
	.error {
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--ink-4);
		margin: 0;
	}

	.head {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.kicker {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-4);
	}
	.title {
		font-family: var(--font-serif);
		font-size: 19px;
		font-weight: 400;
		color: var(--ink);
		margin: 0;
		line-height: 1.25;
	}
	.chips {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.uitslag-chip,
	.dossier-chip {
		display: inline-flex;
		align-items: center;
		height: 18px;
		padding: 0 7px;
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		border: 1px solid var(--rule);
		text-decoration: none;
	}
	.uitslag-chip--ja {
		color: var(--moss);
		border-color: color-mix(in srgb, var(--moss) 25%, transparent);
		background: color-mix(in srgb, var(--moss) 10%, var(--paper));
	}
	.uitslag-chip--nee {
		color: var(--red, #dc2626);
		border-color: color-mix(in srgb, var(--red, #dc2626) 25%, transparent);
		background: color-mix(in srgb, var(--red, #dc2626) 10%, var(--paper));
	}
	.dossier-chip {
		font-family: var(--font-mono);
		text-transform: none;
		letter-spacing: 0;
		color: var(--ink-3);
		background: var(--paper-2);
	}
	.dossier-chip:hover {
		color: var(--spine);
		border-color: var(--spine);
	}

	.sec {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.sec-title {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-4);
		margin: 0;
	}
	.motie-text {
		font-family: var(--font-serif);
		font-size: 14px;
		line-height: 1.65;
		color: var(--ink-2);
		white-space: pre-wrap;
		margin: 0;
	}
	.motie-unavail {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 13px;
		color: var(--ink-4);
		margin: 0;
	}

	.vote-summary {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.vote-bar {
		height: 14px;
		background: color-mix(in srgb, var(--spine) 18%, var(--paper-3));
		border-radius: 4px;
		overflow: hidden;
	}
	.vote-bar-voor {
		height: 100%;
		background: var(--moss);
		transition: width 200ms ease;
	}
	.vote-totals {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		font-family: var(--font-sans);
		font-size: 11px;
	}
	.vote-total--voor {
		color: var(--moss);
		font-weight: 600;
	}
	.vote-total--tegen {
		color: var(--red, #dc2626);
		font-weight: 600;
	}
	.vote-total--onth {
		color: var(--ink-3);
	}
	.vote-total-sep {
		color: var(--ink-4);
	}

	.party-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.party-row {
		display: grid;
		grid-template-columns: 50px 1fr auto;
		gap: 8px;
		padding: 3px 0;
		align-items: baseline;
		border-bottom: 1px dotted var(--rule);
		font-size: 12px;
	}
	.party-stem {
		font-family: var(--font-sans);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.party-row--voor .party-stem {
		color: var(--moss);
	}
	.party-row--tegen .party-stem {
		color: var(--red, #dc2626);
	}
	.party-row--onth .party-stem {
		color: var(--ink-4);
	}
	.party-name {
		font-family: var(--font-serif);
		color: var(--ink-2);
	}
	.party-seats {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-3);
	}
</style>

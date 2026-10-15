<script lang="ts">
	// The three ways in on the start page, each shown by one example (product decision of
	// 16 Oct): an article with its reading, origin and text; a vote per party; a Bundel.
	// Fixed, so they stand in the first paint without a request, as the server can show them.
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Stem from '$lib/components/parliamentary/Stem.svelte';
	import Uitkomst from '$lib/components/parliamentary/Uitkomst.svelte';

	/** The motion of 16 June 2026 (decision_495fd69d…), its parties as the vote gave them. */
	const VOTE = {
		title: 'Motie De Hoop en Grinwis over de WOZ-cap niet versoepelen',
		href: '/kamerstukken/27926/413',
		date: '16 juni 2026, Tweede Kamer',
		tally: '54 voor, 96 tegen',
		sides: [
			{
				choice: 'Voor',
				parties: 'PRO, PVV, ChristenUnie, DENK, PvdD, SP, 50PLUS, Volt'
			},
			{
				choice: 'Tegen',
				parties: 'D66, VVD, CDA, JA21, FVD, Groep Markuszower, BBB, SGP, Lid Keijzer'
			}
		]
	};
</script>

<div class="entrances">
	<section class="entrance" aria-labelledby="entrance-article">
		<h2 id="entrance-article">Artikel</h2>
		<a class="title" href="/wetten/BWBR0005289/artikel/6:162">Art. 6:162 BW, Onrechtmatige daad</a>
		<ul class="rows">
			<li><KindGlyph collection="articles" /> Wat het zegt</li>
			<li><KindGlyph collection="judgments" /> Hoe het is uitgelegd</li>
			<li><KindGlyph collection="documents" /> Waar het vandaan komt</li>
		</ul>
	</section>

	<section class="entrance" aria-labelledby="entrance-vote">
		<h2 id="entrance-vote">Stemming</h2>
		<a class="title" href={VOTE.href}>{VOTE.title}</a>
		<p class="meta">{VOTE.date}</p>
		<p class="outcome"><Uitkomst tone="nee" woord="Verworpen" /> <span>{VOTE.tally}</span></p>
		<dl class="sides">
			{#each VOTE.sides as side (side.choice)}
				<dt><Stem keuze={side.choice} /></dt>
				<dd>{side.parties}</dd>
			{/each}
		</dl>
	</section>

	<section class="entrance" aria-labelledby="entrance-bundle">
		<h2 id="entrance-bundle">Bundel</h2>
		<a class="title" href="/gemarkeerd">Aansprakelijkheid werkgever thuiswerk</a>
		<ul class="rows">
			<li>
				<KindGlyph collection="articles" />
				<a href="/wetten/BWBR0005290/artikel/7:658">Art. 7:658 BW</a>
			</li>
			<li>
				<KindGlyph collection="judgments" />
				<a href="/uitspraken/ECLI:NL:HR:2005:AU3313">HR 11 november 2005</a>
			</li>
			<li class="note"><span class="note-label">Aantekening</span> Zorgplicht, ook thuis?</li>
		</ul>
	</section>
</div>

<style>
	.entrances {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--s-5);
	}
	@media (max-width: 1024px) {
		.entrances {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--s-4);
		}
	}
	.entrance {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		padding: var(--s-4);
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
	}
	h2 {
		margin: 0;
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink-3);
	}
	.title {
		font-size: var(--t-body-2);
		font-weight: 600;
		line-height: var(--lh-snug);
		color: var(--ink);
		text-decoration: none;
	}
	.title:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.meta {
		margin: 0;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.rows li {
		display: flex;
		align-items: center;
		gap: var(--s-2);
	}
	.rows a {
		color: var(--ink);
	}
	.note {
		font-style: italic;
	}
	.note-label {
		font-style: normal;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.outcome {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin: 0;
		font-size: var(--t-meta);
	}
	.sides {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--s-1) var(--s-3);
		margin: 0;
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
	}
	.sides dd {
		margin: 0;
		color: var(--ink-2);
	}
</style>

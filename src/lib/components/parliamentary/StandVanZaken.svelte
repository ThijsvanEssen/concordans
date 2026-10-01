<script lang="ts">
	// Ontwerpstudie ronde 3 (prototype): de stand van een wetsvoorstel per instantie, in
	// zinnen uit velden. Bovenaan één zin die ook in de rij van Bladeren staat; daaronder
	// Raad van State, Tweede Kamer, Eerste Kamer, elk met een zin en een regel ernaast.
	import type { Schema } from '$lib/api/types';
	import { stand, datum } from './stand';

	type Detail = Schema<'DossierDetailResponse'>;
	let { d }: { d: Detail } = $props();

	type Row = { name: string; state: 'done' | 'now' | 'open' | 'none'; zin: string; meta: string };

	const st = $derived(stand(d));
	const count = (needle: string) =>
		Object.entries(d.documents_by_kind ?? {})
			.filter(([k]) => k.toLowerCase().startsWith(needle))
			.reduce((n, [, v]) => n + (v as number), 0);
	const n = (k: number, een: string, meer: string) => (k === 1 ? `1 ${een}` : `${k} ${meer}`);
	const dateOf = (name: string) => d.phases?.find((p) => p.name === name)?.date ?? null;

	const rows = $derived.by<Row[]>(() => {
		if (!st) return [];
		const [rvs, tk, ek] = st.bodies;
		const lead = d.committees?.find((c) => c.role === 'lead');
		const rvsDoc = count('advies afdeling advisering');
		const rvsRow: Row = {
			name: 'Raad van State',
			state: rvs.state,
			zin:
				rvs.state === 'done'
					? `Advies uitgebracht${dateOf('Advies Raad van State') ? `, ${datum(dateOf('Advies Raad van State'))}` : ''}.`
					: d.kind === 'Initiatiefwetgeving'
						? 'Nog geen advies bekend.'
						: 'Advies niet in de gegevens.',
			meta: rvsDoc ? `${n(rvsDoc, 'stuk', 'stukken')}: advies en nader rapport.` : ''
		};

		const nvw = count('nota van wijziging');
		const am = count('amendement');
		const mo = count('motie');
		const parts = [nvw && n(nvw, 'nota van wijziging', "nota's van wijziging"), am && n(am, 'amendement', 'amendementen'), mo && n(mo, 'motie', 'moties')].filter(Boolean);
		let tkZin: string;
		if (d.tk_decision) {
			const how = d.tk_decision.kind?.includes('zonder stemming') ? ' zonder stemming' : '';
			tkZin = `Aangenomen${how}${d.tk_decision.date ? `, ${datum(d.tk_decision.date)}` : ''}.`;
		} else if (d.outcome === 'verworpen') {
			tkZin = `Verworpen${d.closed_on ? `, ${datum(d.closed_on)}` : ''}.`;
		} else if (tk.state === 'done') {
			tkZin = `Eindtekst vastgesteld${dateOf('Eindtekst') ? `, ${datum(dateOf('Eindtekst'))}` : ''}.`;
		} else {
			tkZin = st.zin.replace(/^Bij de Tweede Kamer: /, 'In behandeling: ');
		}
		const tkRow: Row = {
			name: 'Tweede Kamer',
			state: tk.state,
			zin: tkZin,
			meta: [lead ? lead.name : '', parts.join(', ')].filter(Boolean).join('. ') + (lead || parts.length ? '.' : '')
		};

		let ekZin: string;
		let ekMeta = '';
		if (d.ek_outcome) {
			const m = d.ek_outcome.method ?? '';
			const how = m === 'Hamerstuk' ? ' als hamerstuk' : m.startsWith('Stemming bij zitten') ? ' bij zitten en opstaan' : '';
			ekZin = `${d.ek_outcome.outcome}${how}, ${datum(d.ek_outcome.date)}.`;
			ekMeta = 'Bron: eerstekamer.nl.';
		} else if (ek.state === 'now') {
			const s = d.senate;
			ekZin = s?.document_count
				? `In behandeling sinds ${datum(s.first_date)}.`
				: 'Nog niet in behandeling genomen.';
			if (s?.document_count) ekMeta = `${n(s.document_count, 'stuk', 'stukken')} van de Eerste Kamer.`;
		} else if (ek.state === 'none') {
			ekZin = 'Niet aan de orde: verworpen door de Tweede Kamer.';
		} else {
			ekZin = 'Nog niet aan de orde.';
		}
		return [rvsRow, tkRow, { name: 'Eerste Kamer', state: ek.state, zin: ekZin, meta: ekMeta }];
	});
</script>

{#if st}
	<section class="stand" aria-label="Stand van zaken">
		<p class="kop">{st.zin}</p>
		<ol class="rows">
			{#each rows as r (r.name)}
				<li class="row row--{r.state}">
					<span class="name">{r.name}</span>
					<span class="zin">{r.zin}{#if r.meta}<span class="meta">{r.meta}</span>{/if}</span>
				</li>
			{/each}
		</ol>
	</section>
{/if}

<style>
	.stand {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}
	.kop {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		line-height: var(--lh-snug);
		color: var(--ink);
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 2px solid var(--ink);
	}
	.row {
		display: grid;
		grid-template-columns: 9rem minmax(0, 1fr);
		gap: var(--s-4);
		padding: var(--s-2) 0 var(--s-2) var(--s-3);
		border-bottom: 1px solid var(--rule);
		border-left: 4px solid var(--rule);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
	}
	.name {
		font-weight: 500;
		color: var(--ink-2);
	}
	.zin {
		color: var(--ink-2);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.meta {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.row--done {
		border-left-color: var(--ink-2);
	}
	.row--now {
		border-left-color: var(--ink);
		background: var(--paper-2);
	}
	.row--now .name,
	.row--now .zin {
		color: var(--ink);
		font-weight: 600;
	}
	.row--now .meta {
		font-weight: 400;
	}
	.row--open .name,
	.row--open .zin,
	.row--none .name,
	.row--none .zin {
		color: var(--ink-3);
	}
	.row--none {
		border-left-style: dotted;
	}
	@media (max-width: 560px) {
		.row {
			grid-template-columns: 1fr;
			gap: 2px;
		}
	}
</style>

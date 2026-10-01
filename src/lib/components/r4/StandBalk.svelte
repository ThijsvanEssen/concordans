<script lang="ts">
	// Ontwerpstudie ronde 4 (prototype): de stand van een wetsvoorstel als balk in drie
	// gelijke vakken, in de volgorde van de procedure. Afgerond met een uitkomst: mos met een
	// gevuld vakje. Afgerond zonder uitkomst: inkt 2. Nu: inkt, vet, met een vlak. Nog niet:
	// gestippeld. Onder elk vak één zin met de datum. Werkt op een lijstitem en op het detail.
	import type { Schema } from '$lib/api/types';
	import { stand, datum } from '$lib/components/parliamentary/stand';
	import Uitkomst from './Uitkomst.svelte';

	type Item = Schema<'DossierSummaryDTO'> | Schema<'DossierDetailResponse'>;
	let { d, kop = true }: { d: Item; kop?: boolean } = $props();

	type Vak = { naam: string; soort: 'ja' | 'nee' | 'nu' | 'open' | 'klaar'; woord: string; zin: string };
	const st = $derived(stand(d));
	const dateOf = (name: string) => d.phases?.find((p) => p.name === name)?.date ?? null;

	const vakken = $derived.by<Vak[]>(() => {
		if (!st) return [];
		const [rvs, tk, ek] = st.bodies;
		const a = dateOf('Advies Raad van State');
		const v1: Vak =
			rvs.state === 'done'
				? { naam: 'Raad van State', soort: 'klaar', woord: 'Advies', zin: a ? `Uitgebracht, ${datum(a)}` : 'Uitgebracht' }
				: { naam: 'Raad van State', soort: 'open', woord: 'Nog niet', zin: d.kind === 'Initiatiefwetgeving' ? 'Advies kan nog volgen' : 'Niet in de gegevens' };
		let v2: Vak;
		if (d.tk_decision) {
			const how = d.tk_decision.kind?.includes('zonder stemming') ? ', zonder stemming' : '';
			v2 = { naam: 'Tweede Kamer', soort: 'ja', woord: 'Aangenomen', zin: `${datum(d.tk_decision.date)}${how}` };
		} else if (d.outcome === 'verworpen') {
			v2 = { naam: 'Tweede Kamer', soort: 'nee', woord: 'Verworpen', zin: datum(d.closed_on) };
		} else if (tk.state === 'done') {
			v2 = { naam: 'Tweede Kamer', soort: 'ja', woord: 'Aangenomen', zin: datum(dateOf('Eindtekst')) };
		} else {
			const fase = (st.zin.match(/: (.*?)(,|\.)/)?.[1] ?? '').trim();
			const when = st.zin.match(/(\d+ \w+\.? \d{4})/)?.[1] ?? '';
			v2 = {
				naam: 'Tweede Kamer',
				soort: 'nu',
				woord: st.group === 'ingediend' ? 'Ingediend' : 'In behandeling',
				zin: st.group === 'ingediend' ? when : `${fase.charAt(0).toUpperCase() + fase.slice(1)}${when ? `, ${when}` : ''}`
			};
		}
		let v3: Vak;
		if (d.ek_outcome) {
			const m = d.ek_outcome.method ?? '';
			const how = m === 'Hamerstuk' ? ', hamerstuk' : m.startsWith('Stemming bij zitten') ? ', zitten en opstaan' : '';
			const ja = d.ek_outcome.outcome !== 'Verworpen';
			v3 = { naam: 'Eerste Kamer', soort: ja ? 'ja' : 'nee', woord: d.ek_outcome.outcome, zin: `${datum(d.ek_outcome.date)}${how}` };
		} else if (ek.state === 'now') {
			v3 = { naam: 'Eerste Kamer', soort: 'nu', woord: 'In behandeling', zin: 'Sinds aanneming door de Tweede Kamer' };
		} else if (ek.state === 'none') {
			v3 = { naam: 'Eerste Kamer', soort: 'open', woord: 'Niet aan de orde', zin: 'Verworpen door de Tweede Kamer' };
		} else {
			v3 = { naam: 'Eerste Kamer', soort: 'open', woord: 'Nog niet', zin: 'Na de Tweede Kamer' };
		}
		return [v1, v2, v3];
	});
</script>

{#if st}
	<section class="stand" aria-label="Stand van zaken">
		{#if kop}<p class="zin">{st.zin}</p>{/if}
		<ol class="balk">
			{#each vakken as v (v.naam)}
				<li class="vak vak--{v.soort}">
					<span class="naam">{v.naam}</span>
					<span class="streep" aria-hidden="true"></span>
					<Uitkomst soort={v.soort} woord={v.woord} />
					<span class="wanneer">{v.zin}</span>
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
	.zin {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		line-height: var(--lh-snug);
		color: var(--ink);
	}
	.balk {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--s-1);
	}
	.vak {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		padding: var(--s-2) var(--s-3) var(--s-3);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
	}
	.naam {
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-2);
	}
	.streep {
		height: 6px;
		margin: 2px 0 var(--s-1);
		background: var(--ink-2);
	}
	.wanneer {
		font-size: var(--t-micro);
		color: var(--ink-2);
		font-variant-numeric: tabular-nums;
	}
	.vak--ja .streep {
		background: var(--uitkomst-ja, #456247);
	}
	.vak--nee .streep {
		background: transparent;
		border: 2px solid var(--uitkomst-nee, #8c2f28);
		box-sizing: border-box;
	}
	.vak--nu {
		background: var(--paper-2);
	}
	.vak--nu .naam {
		color: var(--ink);
		font-weight: 600;
	}
	.vak--nu .streep {
		background: var(--ink);
	}
	.vak--nu .wanneer {
		color: var(--ink);
	}
	.vak--open .streep {
		background: transparent;
		border-top: 2px dashed var(--ink-3);
		height: 0;
		margin: 4px 0 var(--s-2);
	}
	.vak--open .naam,
	.vak--open .wanneer {
		color: var(--ink-3);
	}
	@media (max-width: 560px) {
		.balk {
			grid-template-columns: 1fr;
		}
	}
</style>

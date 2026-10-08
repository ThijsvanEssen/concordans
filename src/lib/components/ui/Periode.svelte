<script lang="ts">
	// The period of a list, the same in every filter pane (Thijs, 9 Oct: "een tijdsfilter
	// systematisch doorvoeren in alle filterpanes"): Alles, three periods back from today,
	// and a van and tot. Days as the URL and the API hold them; `jaar` asks for years where
	// a list counts in years (uitspraken, kabinetten), which go out as their first and last
	// day. docs/typografie.md, the rule for lists with dates.
	import { vandaag } from '$lib/text/datum';
	import { VOORKEUZEN, gekozen, maandenTerug } from '$lib/text/periode';

	let {
		van,
		tot,
		onChange,
		jaar = false,
		label = 'Periode'
	}: {
		van: string;
		tot: string;
		onChange: (van: string, tot: string) => void;
		/** Years in the boxes; the bounds stay days. */
		jaar?: boolean;
		/** For the group of buttons and the boxes, where no heading names them. */
		label?: string;
	} = $props();

	const dag = vandaag();
	const keuze = $derived(gekozen(van, tot, dag));
	const naarDag = (v: string, eind: boolean) =>
		jaar && /^\d{4}$/.test(v) ? `${v}-${eind ? '12-31' : '01-01'}` : v;
</script>

<div class="periode">
	<div class="chips" role="group" aria-label={label}>
		<button
			type="button"
			class="btn"
			class:is-primary={keuze === 'alles'}
			aria-pressed={keuze === 'alles'}
			onclick={() => onChange('', '')}>Alles</button
		>
		{#each VOORKEUZEN as v (v.id)}
			<button
				type="button"
				class="btn"
				class:is-primary={keuze === v.id}
				aria-pressed={keuze === v.id}
				onclick={() => onChange(maandenTerug(dag, v.maanden), '')}>{v.label}</button
			>
		{/each}
	</div>
	<!-- Below each other, each with its word: a day fits in a narrow facet column too. -->
	<div class="range">
		<label class="bound">
			<span class="sep">van</span>
			<input
				type={jaar ? 'number' : 'date'}
				inputmode="numeric"
				placeholder="begin"
				value={jaar ? van.slice(0, 4) : van}
				onchange={(e) => onChange(naarDag(e.currentTarget.value, false), tot)}
			/>
		</label>
		<label class="bound">
			<span class="sep">tot</span>
			<input
				type={jaar ? 'number' : 'date'}
				inputmode="numeric"
				placeholder="nu"
				value={jaar ? tot.slice(0, 4) : tot}
				onchange={(e) => onChange(van, naarDag(e.currentTarget.value, true))}
			/>
		</label>
	</div>
</div>

<style>
	.periode {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1);
	}
	.range {
		display: grid;
		gap: var(--s-1);
	}
	.bound {
		display: grid;
		grid-template-columns: var(--s-6) minmax(0, 1fr);
		align-items: center;
		gap: var(--s-2);
	}
	.sep {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	input {
		width: 100%;
		box-sizing: border-box;
		height: var(--veld-h);
		padding: 0 var(--s-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font: inherit;
		font-size: var(--t-meta);
		color: var(--ink);
	}
	input::placeholder {
		color: var(--ink-3);
	}
</style>

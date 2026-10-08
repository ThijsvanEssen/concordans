<script lang="ts">
	// The period of a list, the same in every filter pane and first in it (Thijs, 9 Oct: "een
	// tijdsfilter systematisch doorvoeren", "bovenaan en iets eleganter, en het zijn
	// datumvelden"): Alles, Maand, Kwartaal or Jaar back from today as one segmented row
	// (Keuze), and van and tot as day fields. Days as the URL and the API hold them. The rule
	// is in docs/README.md, Conventions.
	import Keuze from './Keuze.svelte';
	import { vandaag } from '$lib/text/datum';
	import { VOORKEUZEN, gekozen, maandenTerug } from '$lib/text/periode';

	let {
		van,
		tot,
		onChange,
		label = 'Periode'
	}: {
		van: string;
		tot: string;
		onChange: (van: string, tot: string) => void;
		/** For the row of choices, where no heading names it. */
		label?: string;
	} = $props();

	const dag = vandaag();
	const keuze = $derived(gekozen(van, tot, dag));
	const opties = [
		{ waarde: 'alles', label: 'Alles', titel: 'Zonder begin of eind' },
		...VOORKEUZEN.map((v) => ({ waarde: v.id, label: v.label, titel: v.titel }))
	];
	function kies(w: string) {
		const v = VOORKEUZEN.find((x) => x.id === w);
		onChange(v ? maandenTerug(dag, v.maanden) : '', '');
	}
</script>

<div class="periode">
	<Keuze klein {label} {opties} waarde={keuze} onKies={kies} />
	<!-- Van and tot on one line where the column has room, each with its word. -->
	<div class="range">
		<label class="bound">
			<span>van</span>
			<input
				type="date"
				value={van}
				max={tot || undefined}
				aria-label="Van"
				onchange={(e) => onChange(e.currentTarget.value, tot)}
			/>
		</label>
		<label class="bound">
			<span>tot</span>
			<input
				type="date"
				value={tot}
				min={van || undefined}
				aria-label="Tot"
				onchange={(e) => onChange(van, e.currentTarget.value)}
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
	.range {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-3);
	}
	.bound {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	input {
		box-sizing: border-box;
		height: var(--veld-h-klein);
		padding: 0 var(--s-1);
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
		background: var(--paper);
		font: inherit;
		font-size: var(--t-micro);
		color: var(--ink);
	}
	input:hover,
	input:focus-visible {
		border-color: var(--rule-strong);
	}
</style>

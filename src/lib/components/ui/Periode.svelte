<script lang="ts">
	// The period of a list, the same in every filter pane and first in it (Thijs, 9 Oct: "een
	// tijdsfilter systematisch doorvoeren", "bovenaan en iets eleganter, en het zijn
	// datumvelden"): Alles, Maand, Kwartaal or Jaar back from today, or Eigen, as one row of
	// equal segments over the column (Keuze vol). Van and tot only under Eigen, on one line
	// with the row's edges (Thijs: two empty date fields under Alles read as one day). Days
	// as the URL and the API hold them. The rule is in docs/README.md, Conventions.
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

	const uid = $props.id();
	const dag = vandaag();
	/** Eigen chosen before a day is filled in: the fields open, the list as it was. */
	let eigenOpen = $state(false);
	const keuze = $derived(gekozen(van, tot, dag) ?? 'eigen');
	const toon = $derived(eigenOpen && keuze === 'alles' ? 'eigen' : keuze);
	const opties = [
		{ waarde: 'alles', label: 'Alles', titel: 'Zonder begin of eind' },
		...VOORKEUZEN.map((v) => ({ waarde: v.id, label: v.label, titel: v.titel })),
		{ waarde: 'eigen', label: 'Eigen', titel: 'Van en tot zelf kiezen' }
	];
	function kies(w: string) {
		eigenOpen = w === 'eigen';
		if (eigenOpen) return;
		const v = VOORKEUZEN.find((x) => x.id === w);
		onChange(v ? maandenTerug(dag, v.maanden) : '', '');
	}
</script>

<div class="periode">
	<Keuze klein vol {label} {opties} waarde={toon} onKies={kies} />
	{#if toon === 'eigen'}
		<div class="range">
			<label for="{uid}-van">van</label>
			<input
				id="{uid}-van"
				type="date"
				class:leeg={!van}
				value={van}
				max={tot || undefined}
				onchange={(e) => onChange(e.currentTarget.value, tot)}
			/>
			<label for="{uid}-tot">tot</label>
			<input
				id="{uid}-tot"
				type="date"
				class:leeg={!tot}
				value={tot}
				min={van || undefined}
				onchange={(e) => onChange(van, e.currentTarget.value)}
			/>
		</div>
	{/if}
</div>

<style>
	.periode {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		container-type: inline-size;
	}
	/* Van and tot under each other in a narrow column, the words in one column and the
	   fields to the row's right edge; on one line where both fields fit. */
	.range {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	@container (min-width: 320px) {
		.range {
			grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr);
		}
	}
	input {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		height: var(--veld-h-klein);
		padding: 0 var(--s-1);
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
		background: var(--paper);
		font: inherit;
		font-size: var(--t-micro);
		color: var(--ink);
	}
	/* One colour for the whole field, digits and dashes alike: ink when filled, the quiet
	   ink when empty (Safari fills an empty field with today's date). */
	input::-webkit-datetime-edit,
	input::-webkit-datetime-edit-text,
	input::-webkit-datetime-edit-day-field,
	input::-webkit-datetime-edit-month-field,
	input::-webkit-datetime-edit-year-field {
		color: var(--ink);
	}
	input.leeg,
	input.leeg::-webkit-datetime-edit,
	input.leeg::-webkit-datetime-edit-text,
	input.leeg::-webkit-datetime-edit-day-field,
	input.leeg::-webkit-datetime-edit-month-field,
	input.leeg::-webkit-datetime-edit-year-field {
		color: var(--ink-3);
	}
	input:hover,
	input:focus-visible {
		border-color: var(--rule-strong);
	}
</style>

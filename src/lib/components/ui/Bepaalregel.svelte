<script lang="ts">
	// The choose-line of a full-width page (docs/bediening.md; Thijs, 10 Oct: "Dan hebben we
	// overal netjes een zelfde soort zoekbalk"): what the list is of, in at most three labelled
	// controls on one line, Zoeken, Periode and Kamer, each 32 px high, its label above its
	// left edge. On a phone they stand under each other, the width of the page. The facets
	// hold the rest.
	import type { Option } from './option';
	import Periode from './Periode.svelte';
	import Keuze from './Keuze.svelte';

	let {
		zoek = null,
		periode = null,
		kamer = null
	}: {
		zoek?: {
			waarde: string;
			placeholder: string;
			/** What the field searches, for a screen reader: `Zoek in Actueel`. */
			naam: string;
			onInput: (v: string) => void;
			/** The label above it: Zoeken, or what the field takes (`Onderwerp`). */
			label?: string;
			/** A field that adds rather than searches: its button beside it, Enter submits. */
			knop?: { label: string; disabled?: boolean; onSubmit: () => void } | null;
		} | null;
		periode?: {
			/** Its own name where the list has one (`Datum van uitspraak`); else Periode. */
			label?: string;
			van: string;
			tot: string;
			onChange: (van: string, tot: string) => void;
		} | null;
		kamer?: { waarde: string; opties: Option[]; onKies: (v: string) => void } | null;
	} = $props();
	const uid = $props.id();
</script>

<div class="bepaal">
	{#if zoek}
		<div class="vak vak--zoek">
			<label class="kop" for="{uid}-zoek">{zoek.label ?? 'Zoeken'}</label>
			<form
				class="veld"
				onsubmit={(e) => {
					e.preventDefault();
					if (zoek.knop && !zoek.knop.disabled) zoek.knop.onSubmit();
				}}
			>
				<input
					id="{uid}-zoek"
					type={zoek.knop ? 'text' : 'search'}
					aria-label={zoek.naam}
					placeholder={zoek.placeholder}
					value={zoek.waarde}
					oninput={(e) => zoek.onInput(e.currentTarget.value)}
				/>
				{#if zoek.knop}<button type="submit" class="btn is-groot" disabled={zoek.knop.disabled}
						>{zoek.knop.label}</button
					>{/if}
			</form>
		</div>
	{/if}
	{#if periode}
		<div class="vak vak--periode">
			<span class="kop" aria-hidden="true">{periode.label ?? 'Periode'}</span>
			<Periode
				from={periode.van}
				to={periode.tot}
				label={periode.label ?? 'Periode'}
				klein={false}
				onChange={periode.onChange}
			/>
		</div>
	{/if}
	{#if kamer}
		<div class="vak vak--kamer">
			<span class="kop" aria-hidden="true">Kamer</span>
			<Keuze
				vol
				label="Kamer"
				waarde={kamer.waarde}
				opties={kamer.opties}
				onSelect={kamer.onKies}
			/>
		</div>
	{/if}
</div>

<style>
	.bepaal {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--s-3) var(--s-5);
	}
	.vak {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		min-width: 0;
	}
	.vak--zoek {
		flex: 1 1 320px;
	}
	.vak--periode {
		flex: 0 1 380px;
	}
	.vak--kamer {
		flex: 0 1 360px;
	}
	/* The label as a facet's heading names its group: one line, at the control's left edge. */
	.kop {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		line-height: 1.3;
		color: var(--ink);
		white-space: nowrap;
	}
	.veld {
		display: flex;
		gap: var(--s-2);
		margin: 0;
	}
	input {
		box-sizing: border-box;
		flex: 1;
		min-width: 0;
		width: 100%;
		height: var(--veld-h);
		padding: 0 var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		color: var(--ink);
	}
	input::placeholder {
		color: var(--ink-3);
	}
	input:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 1px;
	}
	/* A finger's 44 px: a field has no target outside its box. */
	@media (pointer: coarse), (max-width: 768px) {
		input {
			height: var(--veld-h-raak);
		}
	}
	@media (max-width: 768px) {
		.vak {
			flex: 1 1 100%;
		}
	}
</style>

<script lang="ts">
	// The reader's own note in a map, one form for an item's, a group's and the map's (Thijs,
	// 12 Oct: "nu lijkt het alsof het bij de wet hoort"): set apart from the text it is about
	// by a rule at its left and the label Aantekening with the sign of Bewaar, as the network
	// marks a bron with a note; the note itself upright, in the reader's letter. Where it can
	// be changed a click opens it in place: Enter keeps it, Escape leaves it, leaving the
	// field keeps it.
	import Picto from '$lib/components/ui/Picto.svelte';

	let {
		tekst,
		bij,
		open = $bindable(false),
		onBewaar
	}: {
		tekst: string | null | undefined;
		/** What it is a note on, for the field's name: `art. 21 lid 3 Cbw`, `Cyberbeveiligingswet`. */
		bij: string;
		/** The field open; without `onBewaar` it never opens. */
		open?: boolean;
		/** Keeps the note; without it the note is read only (a shared map). */
		onBewaar?: (tekst: string) => void;
	} = $props();

	/** The field takes the focus on opening. */
	const focus = (veld: HTMLTextAreaElement) => veld.focus();

	function klaar(waarde: string) {
		if (!open) return;
		onBewaar?.(waarde);
		open = false;
	}
	function toets(e: KeyboardEvent) {
		const veld = e.currentTarget as HTMLTextAreaElement;
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			klaar(veld.value);
		} else if (e.key === 'Escape') {
			// The field's own Escape (isEscape leaves a field alone): the note as it was.
			e.preventDefault();
			veld.value = tekst ?? '';
			open = false;
		}
	}
</script>

{#if (open && onBewaar) || tekst}
	<div class="aantekening">
		<span class="label"><Picto naam="bewaard" size={10} />Aantekening</span>
		{#if open && onBewaar}
			<textarea
				class="aantekening-veld"
				rows="2"
				aria-label="Aantekening bij {bij}"
				placeholder="Aantekening bij {bij}"
				value={tekst ?? ''}
				use:focus
				onkeydown={toets}
				onblur={(e) => klaar(e.currentTarget.value)}
			></textarea>
		{:else if onBewaar}
			<button
				type="button"
				class="tekst"
				title="Aantekening wijzigen"
				onclick={(e) => {
					e.stopPropagation();
					open = true;
				}}>{tekst}</button
			>
		{:else}
			<p class="tekst">{tekst}</p>
		{/if}
	</div>
{/if}

<style>
	/* A margin note: the rule at its left, the label over it, the note in the reader's letter. */
	.aantekening {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		max-width: 68ch;
		margin: var(--s-2) 0 0;
		padding: 0 0 0 var(--s-3);
		border-left: 2px solid var(--rule-strong);
	}
	.label {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.tekst {
		display: block;
		margin: 0;
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-style: normal;
		line-height: var(--lh-body);
		color: var(--ink-2);
		text-align: left;
		white-space: pre-line;
	}
	button.tekst {
		cursor: text;
	}
	button.tekst:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	/* The field at 16px: below that a phone zooms in on focus. */
	.aantekening-veld {
		box-sizing: border-box;
		width: 100%;
		padding: var(--s-1) var(--s-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-family: var(--font-serif);
		font-size: var(--t-input);
		line-height: var(--lh-body);
		color: var(--ink);
		resize: vertical;
	}
</style>

<script lang="ts">
	// The reader's own note in a map, one form for an item's, a group's and the map's (Thijs,
	// 12 Oct: "nu lijkt het alsof het bij de wet hoort"): set apart from the text it is about
	// by a rule at its left and the label Aantekening with the sign of Bewaar, as the network
	// marks a bron with a note; the note itself upright, in the reader's letter. Where it can
	// be changed a click opens it in place: Enter keeps it, Escape leaves it, leaving the
	// field keeps it. Read only, as on a network card, the label names its place. With a
	// placeholder an empty note is an empty field that says what goes in it (a bundel's
	// research question). The note of an arcering (O4) stands under its place in the text, and
	// a click opens the menu of its arcering (`onOpen`), where it is changed.
	import Picto from '$lib/components/ui/Picto.svelte';

	let {
		tekst,
		bij,
		waar = null,
		bundel = null,
		compact = false,
		open = $bindable(false),
		placeholder = null,
		onBewaar,
		onOpen
	}: {
		tekst: string | null | undefined;
		/** What it is a note on, for the field's name: `art. 21 lid 3 Cbw`, `Cyberbeveiligingswet`. */
		bij: string;
		/** Its place in the label, where the note stands apart from it: `lid 3`, a law, a map. */
		waar?: string | null;
		/** The bundel it is kept in, in the label, where the text shows notes of more than one. */
		bundel?: string | null;
		/** Without its own margin and measure, in a card that spaces its lines itself. */
		compact?: boolean;
		/** The field open; without `onBewaar` it never opens. */
		open?: boolean;
		/** Where there is no note: an empty field with these words, in place of nothing. */
		placeholder?: string | null;
		/** Keeps the note; without it the note is read only (a shared map). */
		onBewaar?: (tekst: string) => void;
		/** A click on the note opens this menu (an arcering's), the note its button. */
		onOpen?: (button: HTMLElement) => void;
	} = $props();

	const label = $derived(
		bundel ? `Aantekening, ${bundel}` : waar ? `Aantekening bij ${waar}` : 'Aantekening'
	);

	/** The field takes the focus on opening. */
	const focus = (field: HTMLTextAreaElement) => field.focus();

	function done(value: string) {
		if (!open) return;
		onBewaar?.(value);
		open = false;
	}
	function onKey(e: KeyboardEvent) {
		const field = e.currentTarget as HTMLTextAreaElement;
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			done(field.value);
		} else if (e.key === 'Escape') {
			// The field's own Escape (isEscape leaves a field alone): the note as it was.
			e.preventDefault();
			field.value = tekst ?? '';
			open = false;
		}
	}
	/** The empty field: Enter or leaving it keeps what was typed, Escape leaves it empty. */
	function emptyKey(e: KeyboardEvent) {
		const field = e.currentTarget as HTMLTextAreaElement;
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			field.blur();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			field.value = '';
			field.blur();
		}
	}
</script>

{#if !tekst && !open && placeholder && onBewaar}
	<div class="aantekening" class:compact>
		<textarea
			class="aantekening-veld"
			rows="2"
			aria-label="Aantekening bij {bij}"
			{placeholder}
			onkeydown={emptyKey}
			onblur={(e) => {
				if (e.currentTarget.value.trim()) onBewaar(e.currentTarget.value);
			}}
		></textarea>
	</div>
{:else if (open && onBewaar) || tekst}
	<div class="aantekening" class:compact>
		<span class="label"><Picto naam="bewaard" size={10} />{label}</span>
		{#if onOpen}
			<button
				type="button"
				class="tekst"
				aria-haspopup="menu"
				onclick={(e) => {
					e.stopPropagation();
					onOpen(e.currentTarget);
				}}>{tekst}</button
			>
		{:else if open && onBewaar}
			<textarea
				class="aantekening-veld"
				rows="2"
				aria-label="Aantekening bij {bij}"
				placeholder="Aantekening bij {bij}"
				value={tekst ?? ''}
				use:focus
				onkeydown={onKey}
				onblur={(e) => done(e.currentTarget.value)}
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
	.aantekening.compact {
		max-width: none;
		margin: 0;
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
	button.tekst[aria-haspopup] {
		cursor: pointer;
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

<script lang="ts">
	// The reader's own note in a map, one form for an item's, a group's and the map's (Thijs,
	// 12 Oct: "nu lijkt het alsof het bij de wet hoort"): set apart from the text it is about
	// by a rule at its left and a label: the sign of Bewaar and the name of the bundel it is kept
	// in (DS Aantekening), as the network marks a bron with a note; the note itself upright, in the reader's letter,
	// in its opmaak (B62: koppen, lists, citaat, vet, cursief; a verwijzing a link). Where it can
	// be changed a click on it opens it in place (NoteField), its label the button for the
	// keys: ⌘↵ or leaving the field keeps it, Escape leaves it. Read only, as on a network card,
	// the label names its place and the note is one run of words. With `field` an empty note is an
	// empty field under its label (a bundel's research question). The note of an arcering (O4)
	// stands under its place in the text, and a click opens the menu of its arcering (`onOpen`),
	// where it is changed.
	import Picto from '$lib/components/ui/Picto.svelte';
	import NoteField from './NoteField.svelte';
	import NoteText from './NoteText.svelte';
	import type { References } from './map';

	let {
		tekst,
		bij,
		waar = null,
		bundel = null,
		references = null,
		compact = false,
		open = $bindable(false),
		field = false,
		onBewaar,
		onOpen
	}: {
		tekst: string | null | undefined;
		/** What it is a note on, for the field's name: `art. 21 lid 3 Cbw`, `Cyberbeveiligingswet`. */
		bij: string;
		/** Its place in the label, where the note stands apart from it: `lid 3`, a law, a map. */
		waar?: string | null;
		/** The bundel it is kept in: the label is its name. */
		bundel?: string | null;
		/** The addresses the bundel keeps for the verwijzingen in its notes. */
		references?: References | null;
		/** Without its own margin and measure, in a card that spaces its lines itself: one run
		 *  of words, three lines at most. */
		compact?: boolean;
		/** The field open; without `onBewaar` it never opens. */
		open?: boolean;
		/** Where there is no note: an empty field under its label, in place of nothing. */
		field?: boolean;
		/** Keeps the note; without it the note is read only (a shared map). */
		onBewaar?: (tekst: string) => void;
		/** A click on the note opens this menu (an arcering's), the note its button. */
		onOpen?: (button: HTMLElement) => void;
	} = $props();

	const label = $derived(bundel ?? (waar ? `Aantekening bij ${waar}` : 'Aantekening'));
	/** Escape in the empty field: a new, empty field in its place. */
	let fresh = $state(0);

	function done(value: string) {
		if (!open) return;
		onBewaar?.(value);
		open = false;
	}
	/** A click on the note opens it, one on a link in it follows the link. */
	function openAt(e: MouseEvent) {
		if ((e.target as Element).closest('a')) return;
		e.stopPropagation();
		open = true;
	}
</script>

{#if !tekst && !open && field && onBewaar}
	<div class="aantekening" class:compact>
		<span class="label"><Picto naam="bewaard" size={10} />{label}</span>
		{#key fresh}
			<NoteField
				label="Aantekening bij {bij}"
				onDone={(t) => {
					if (t.trim()) onBewaar(t);
				}}
				onBack={() => {
					fresh++;
					(document.activeElement as HTMLElement | null)?.blur();
				}}
			/>
		{/key}
	</div>
{:else if (open && onBewaar) || tekst}
	<div class="aantekening" class:compact>
		{#if onBewaar && !onOpen && !open}
			<button
				type="button"
				class="label"
				aria-label="{label} wijzigen"
				onclick={(e) => {
					e.stopPropagation();
					open = true;
				}}><Picto naam="bewaard" size={10} />{label}</button
			>
		{:else}
			<span class="label"><Picto naam="bewaard" size={10} />{label}</span>
		{/if}
		{#if onOpen}
			<button
				type="button"
				class="tekst"
				aria-haspopup="menu"
				onclick={(e) => {
					e.stopPropagation();
					onOpen(e.currentTarget);
				}}><NoteText text={tekst ?? ''} run /></button
			>
		{:else if open && onBewaar}
			<NoteField
				focus
				label="Aantekening bij {bij}"
				text={tekst ?? ''}
				onDone={done}
				onBack={() => (open = false)}
			/>
		{:else if compact}
			<p class="tekst kort"><NoteText text={tekst ?? ''} run /></p>
		{:else if onBewaar}
			<!-- The label is the button for the keys; a click anywhere on the note opens it too. -->
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<div class="tekst bewerkbaar" title="Aantekening wijzigen" onclick={openAt}>
				<NoteText text={tekst ?? ''} {references} />
			</div>
		{:else}
			<div class="tekst"><NoteText text={tekst ?? ''} {references} /></div>
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
		align-self: flex-start;
		gap: var(--s-1);
		margin: 0;
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	button.label {
		cursor: text;
	}
	button.label:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
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
	}
	.bewerkbaar {
		cursor: text;
	}
	/* On a card: three lines at most. */
	.kort {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	button.tekst[aria-haspopup] {
		cursor: pointer;
	}
	button.tekst:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
</style>

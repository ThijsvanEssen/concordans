<script lang="ts">
	// The field of a note of the reader's own (B62): it shows the very characters typed, the
	// signs of its opmaak dimmed and a verwijzing on the dotted line of Verwijzing, in a mirror
	// under the text field (Tekstveld), whose text is clear and whose caret is seen; it grows
	// with the note. Enter is a new line (a list goes on), ⌘↵ or leaving the field keeps it,
	// Escape leaves it as it was. Under it, while it has the focus, what it recognized and the
	// keys of the opmaak; on a phone a row of buttons in their place.
	import Tekstveld from '$lib/components/ui/Tekstveld.svelte';
	import { modKey } from '$lib/util/platform';
	import { segmentsOfLine } from './markup';
	import { recognizedIn } from './references';
	import {
		changeOf,
		continueList,
		toggleLineSign,
		wrapSelection,
		type FieldState,
		type LineSign
	} from './note-edit';

	let {
		text = '',
		label,
		focus = false,
		onDone,
		onBack
	}: {
		/** The note as kept. */
		text?: string;
		/** What the field is, for a screen reader: `Aantekening bij art. 6:162 BW`. */
		label: string;
		/** Takes the focus when it appears. */
		focus?: boolean;
		/** Keeps what was typed: ⌘↵, Bewaren or leaving the field. */
		onDone: (text: string) => void;
		/** Escape: the note as it was. */
		onBack: () => void;
	} = $props();

	// The field begins at the note as kept; what is typed is its own.
	let value = $state(text);
	let input: HTMLInputElement | HTMLTextAreaElement | null = $state(null);
	let wrap: HTMLDivElement | null = $state(null);
	/** Kept or left: what comes after (the blur of a field taken away) does nothing. */
	let done = false;
	/** Between the mirror's lines, and after its last, so an empty last line has its height:
	 *  in the markup the template would fold them away. */
	const NL = '\n';
	const END = ' ';

	const lines = $derived(value.split('\n'));
	// Opened on a note, the caret at its end.
	$effect(() => {
		if (focus && input) input.setSelectionRange(input.value.length, input.value.length);
	});
	const recognized = $derived(recognizedIn(value));

	function keep() {
		if (done) return;
		done = true;
		onDone(value);
	}
	function back() {
		done = true;
		value = text;
		onBack();
	}

	/**
	 * A change of the keys or the buttons, as typing it would be: the field's own undo keeps
	 * it where the browser types it in (`insertText`), else the text is set.
	 */
	function apply(next: FieldState) {
		if (!input) return;
		const d = changeOf(value, next.text);
		input.focus();
		input.setSelectionRange(d.from, d.to);
		const typed = document.execCommand?.('insertText', false, d.text) ?? false;
		if (!typed || input.value !== next.text) value = input.value = next.text;
		input.setSelectionRange(next.start, next.end);
	}
	const selection = (): FieldState => ({
		text: value,
		start: input?.selectionStart ?? value.length,
		end: input?.selectionEnd ?? value.length
	});
	const bold = () => apply(wrapSelection(selection(), '**'));
	const italic = () => apply(wrapSelection(selection(), '*'));
	const sign = (kind: LineSign) => apply(toggleLineSign(selection(), kind));

	/** The field's own keys; ⌘B and ⌘I by the key's place (`code`), as the register matches. */
	function onkeydown(e: KeyboardEvent) {
		const mod = e.metaKey || e.ctrlKey;
		if (e.key === 'Escape') {
			// The field's own Escape (isEscape leaves a field alone): the note as it was.
			e.preventDefault();
			back();
		} else if (e.key === 'Enter' && mod) {
			e.preventDefault();
			keep();
		} else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
			const next = continueList(selection());
			if (next) {
				e.preventDefault();
				apply(next);
			}
		} else if (mod && !e.altKey && (e.code === 'KeyB' || e.code === 'KeyI')) {
			e.preventDefault();
			if (e.code === 'KeyB') bold();
			else italic();
		}
	}
	/** Leaving the field keeps it; a step to its own buttons does not leave it. */
	function onfocusout(e: FocusEvent) {
		if (!wrap?.contains(e.relatedTarget as Node | null)) keep();
	}
	/** A button of the row keeps the focus in the field, so the keyboard of a phone stays. */
	const holdFocus = (e: PointerEvent) => e.preventDefault();
</script>

<div class="note-field" bind:this={wrap} {onfocusout}>
	<div class="layer">
		<div class="mirror" aria-hidden="true">
			{#each lines as line, i (i)}{#if i}{NL}{/if}{#each segmentsOfLine(line) as s, j (j)}<span
						class={s.kind}>{s.text}</span
					>{/each}{/each}{END}
		</div>
		<Tekstveld
			multiline
			class="note-input"
			bind:value
			bind:el={input}
			{label}
			{focus}
			spellcheck="true"
			{onkeydown}
		/>
	</div>
	{#if recognized.length}
		<p class="recognized">Herkend: {recognized.join(', ')}</p>
	{/if}
	<p class="keys">
		<span><kbd>{modKey}B</kbd> vet</span>
		<span><kbd>{modKey}I</kbd> cursief</span>
		<span><kbd>#</kbd> kop</span>
		<span><kbd>-</kbd> opsomming</span>
		<span><kbd>1.</kbd> lijst</span>
		<span><kbd>&gt;</kbd> citaat</span>
		<span class="end"><kbd>{modKey}↵</kbd> Bewaren</span>
	</p>
	<div class="buttons" role="toolbar" aria-label="Opmaak">
		<button type="button" aria-label="Vet" class="bold" onpointerdown={holdFocus} onclick={bold}
			>B</button
		>
		<button
			type="button"
			aria-label="Cursief"
			class="italic"
			onpointerdown={holdFocus}
			onclick={italic}>I</button
		>
		<button type="button" aria-label="Kop" onpointerdown={holdFocus} onclick={() => sign('heading')}
			>Kop</button
		>
		<button
			type="button"
			aria-label="Opsomming"
			onpointerdown={holdFocus}
			onclick={() => sign('bullets')}
			><svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"
				><circle cx="3.5" cy="5" r="1" fill="currentColor" /><circle
					cx="3.5"
					cy="9"
					r="1"
					fill="currentColor"
				/><circle cx="3.5" cy="13" r="1" fill="currentColor" /><path
					d="M7 5h9M7 9h9M7 13h9"
					stroke="currentColor"
					stroke-width="1.4"
				/></svg
			></button
		>
		<button
			type="button"
			aria-label="Genummerde lijst"
			onpointerdown={holdFocus}
			onclick={() => sign('numbered')}>1.</button
		>
		<button
			type="button"
			aria-label="Citaat"
			onpointerdown={holdFocus}
			onclick={() => sign('quote')}
			><svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"
				><path d="M3 4v10M7 6h8M7 9h8M7 12h5" stroke="currentColor" stroke-width="1.4" /></svg
			></button
		>
		<button type="button" aria-label="Bewaren" class="keep" onpointerdown={holdFocus} onclick={keep}
			>Bewaren</button
		>
	</div>
</div>

<style>
	.note-field {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}
	/* The text field over its mirror in one cell: the mirror's lines make the height. The
	   field keeps its frame and its ring; its text is clear, the mirror's is read. */
	.layer {
		display: grid;
		border-radius: var(--r-1);
		background: var(--paper);
	}
	.mirror,
	.layer :global(.note-input.note-input) {
		grid-area: 1 / 1;
		box-sizing: border-box;
		min-width: 0;
		min-height: calc(3lh + 2 * var(--s-1) + 2px);
		margin: 0;
		padding: var(--s-1) var(--s-2);
		border: 1px solid transparent;
		font-family: var(--font-serif);
		font-size: var(--t-input);
		line-height: var(--lh-body);
		letter-spacing: normal;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		tab-size: 4;
	}
	.mirror {
		color: var(--ink);
		pointer-events: none;
	}
	.layer :global(.note-input.note-input) {
		height: 100%;
		overflow: hidden;
		resize: none;
		border-color: var(--rule-strong);
		background: transparent;
		color: transparent;
		caret-color: var(--ink);
	}
	.layer :global(.note-input.note-input::selection) {
		background: var(--mark-ins);
	}
	.sign {
		color: var(--ink-3);
	}
	.reference {
		text-decoration: underline dotted var(--ink);
		text-underline-offset: 3px;
	}
	.recognized {
		margin: 0;
		font-size: var(--t-micro);
		line-height: var(--lh-snug);
		color: var(--ink-3);
	}
	/* The keys of the opmaak, only while the field has the focus. */
	.keys,
	.buttons {
		display: none;
	}
	.keys {
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-3);
		margin: 0;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.keys kbd {
		color: var(--ink-2);
	}
	.keys .end {
		margin-left: auto;
	}
	.note-field:focus-within .keys {
		display: flex;
	}
	.buttons {
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-1);
		padding-top: var(--s-2);
		border-top: 1px solid var(--rule);
	}
	.buttons button {
		min-width: var(--veld-h-raak);
		height: var(--veld-h-raak);
		padding: 0 var(--s-2);
		border: 0;
		border-radius: var(--r-1);
		background: none;
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		font-weight: 500;
		color: var(--ink);
	}
	.buttons button:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 1px;
	}
	.buttons button.bold {
		font-weight: 700;
	}
	.buttons button.italic {
		font-family: var(--font-serif);
		font-size: var(--t-input);
		font-style: italic;
	}
	.buttons button.keep {
		margin-left: auto;
		border: 1px solid var(--rule-strong);
		background: var(--paper);
	}
	/* A phone: the row of buttons in place of the keys. */
	@media (pointer: coarse), (max-width: 768px) {
		.note-field:focus-within .keys {
			display: none;
		}
		.note-field:focus-within .buttons {
			display: flex;
		}
	}
</style>

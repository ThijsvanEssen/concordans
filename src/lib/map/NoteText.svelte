<script lang="ts">
	// A note of the reader's own as it reads (B62): its koppen, lists and citaat, vet and
	// cursief, a verwijzing a link to its bron with the dotted line of Verwijzing. `run` gives
	// one run of words, for a card or a button that holds no blocks: vet and cursief stay, the
	// links go (./markup).
	import { asRun, noteBlocks, type NoteInline } from './markup';
	import { referencePath } from './references';
	import type { References } from './map';

	let {
		text,
		references = null,
		run = false
	}: {
		text: string;
		/** The addresses the bundel keeps for its verwijzingen. */
		references?: References | null;
		/** One run of words, without links. */
		run?: boolean;
	} = $props();

	const words = $derived(run ? asRun(text) : []);
	const blocks = $derived(run ? [] : noteBlocks(text));
</script>

{#snippet inline(parts: NoteInline[])}{#each parts as d, i (i)}{#if d.kind === 'bold'}<strong
				>{@render inline(d.parts)}</strong
			>{:else if d.kind === 'italic'}<em>{@render inline(d.parts)}</em
			>{:else if run || d.kind === 'text'}{d.text}{:else if d.kind === 'url'}<a
				class="ref"
				href={d.text}
				rel="noopener noreferrer external"
				target="_blank">{d.text}</a
			>{:else}{@const href = referencePath(d.ref, references)}{#if href}<a class="ref" {href}
					>{d.text}</a
				>{:else}{d.text}{/if}{/if}{/each}{/snippet}

{#if run}
	{@render inline(words)}
{:else}
	{#each blocks as b, i (i)}
		{#if b.kind === 'heading'}
			<span class="ok" role="heading" aria-level="3">{@render inline(b.line)}</span>
		{:else if b.kind === 'bullets'}
			<ul>
				{#each b.items as item, j (j)}<li>{@render inline(item)}</li>{/each}
			</ul>
		{:else if b.kind === 'numbered'}
			<ol start={b.start > 1 ? b.start : undefined}>
				{#each b.items as item, j (j)}<li>{@render inline(item)}</li>{/each}
			</ol>
		{:else if b.kind === 'quote'}
			<blockquote>
				{#each b.lines as l, j (j)}{#if j}<br />{/if}{@render inline(l)}{/each}
			</blockquote>
		{:else}
			<p>
				{#each b.lines as l, j (j)}{#if j}<br />{/if}{@render inline(l)}{/each}
			</p>
		{/if}
	{/each}
{/if}

<style>
	/* A kop of the note: its own line in the semibold, as the koppen of a text. */
	.ok {
		display: block;
		margin: var(--s-3) 0 0;
		font-weight: 600;
		line-height: var(--lh-tight);
		color: var(--ink);
	}
	.ok:first-child {
		margin-top: 0;
	}
	p,
	ul,
	ol,
	blockquote {
		margin: 0;
	}
	* + p,
	* + ul,
	* + ol {
		margin-top: var(--s-2);
	}
	.ok + p,
	.ok + ul,
	.ok + ol {
		margin-top: 0;
	}
	ul,
	ol {
		padding-left: var(--s-5);
	}
	ul {
		list-style: disc;
	}
	/* A citaat: the words of another, on the ground of quoted text. */
	blockquote {
		margin-top: var(--s-1);
		padding: var(--s-2) var(--s-3);
		background: var(--paper-2);
		border-radius: var(--r-1);
		color: var(--ink);
	}
	/* A verwijzing: the dotted line of Verwijzing, solid with a ground on hover. */
	.ref {
		color: var(--ink);
		text-decoration: underline dotted;
		text-underline-offset: 3px;
		border-radius: var(--r-1);
	}
	.ref:hover {
		background: var(--paper-2);
		text-decoration-style: solid;
	}
	.ref:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 1px;
	}
</style>

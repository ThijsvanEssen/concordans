<script lang="ts" module>
	/** What a row of the group will hold, for its height: a judgment beside an article holds its passage. */
	export type PendingKind =
		| 'passage'
		| 'verwijzing'
		| 'kamerstuk'
		| 'uitspraak'
		| 'artikel'
		| 'stuk';
</script>

<script lang="ts">
	// The place of a group's rows while they come: as many blank rows as it will show, each as
	// high as such a row measures, and the line of its "Alle" link where it will have one. What
	// comes fills them in, and nothing below moves (UX-toets e7a2f95, #1).
	let { count, shown, kind }: { count: number; shown: number; kind: PendingKind } = $props();
</script>

<ul class="pending" data-kind={kind} aria-hidden="true">
	{#each { length: Math.min(count, shown) } as _, k (k)}
		<li class="pending__row"><span class="pending__bar"></span></li>
	{/each}
</ul>
{#if count > shown}
	<!-- As high as the group's line Alle n uitspraken. -->
	<p class="pending__all" aria-hidden="true">&nbsp;</p>
{/if}

<style>
	/* The heights as the rows measure on 6:162 BW: a row with a title over two lines and its
	   meta line 112 px; a judgment's row holding its passage 142 to 163 px. On an article (6:74,
	   6:98 and 7:611 BW, UX-toets 0.79.47, #1): a judgment's row 142 to 163 px, an article's 77
	   to 119, a Kamerstuk's 163. A judgment beside a judgment holds no passage (95), an article
	   cited by a judgment a title and a line (77). */
	.pending {
		--pending-h: 112px;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.pending[data-kind='passage'] {
		--pending-h: 156px;
	}
	.pending[data-kind='verwijzing'] {
		--pending-h: 96px;
	}
	.pending[data-kind='kamerstuk'] {
		--pending-h: 164px;
	}
	.pending[data-kind='uitspraak'] {
		--pending-h: 95px;
	}
	.pending[data-kind='artikel'] {
		--pending-h: 77px;
	}
	/* On a phone the rows wrap more (6:98 BW at 375 px): a judgment's 188, an article's 148 to
	   176, a Kamerstuk's 172. */
	@media (max-width: 768px) {
		.pending[data-kind='passage'] {
			--pending-h: 188px;
		}
		.pending[data-kind='verwijzing'] {
			--pending-h: 148px;
		}
		.pending[data-kind='kamerstuk'] {
			--pending-h: 172px;
		}
	}
	.pending__row {
		height: var(--pending-h);
		padding: var(--s-2) var(--s-4);
	}
	.pending__bar {
		display: block;
		width: 70%;
		height: var(--s-2);
		margin-top: var(--s-2);
		background: var(--paper-2);
	}
	/* The box of Verbonden's .group__alle. */
	.pending__all {
		margin: 0;
		padding: var(--s-1) var(--s-4) var(--s-3);
		font-size: var(--t-meta);
	}
</style>

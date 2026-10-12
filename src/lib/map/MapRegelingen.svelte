<script lang="ts">
	// The regulations under an opened item or law of a map (verbonden.ts): a heading, then per
	// regulation its name, a link to its reader, with its kind and date after it. First the
	// names, as the list gives them; kind and date fill in after. Nothing where there are none.
	import { buildBronHref } from '$lib/bron/href';
	import { korteDatum } from '$lib/text/datum';
	import { aangevuld, type Regeling } from './verbonden';

	let { titel, laad }: { titel: string; laad: () => Promise<Regeling[]> } = $props();

	let lijst = $state<Regeling[]>([]);

	$effect(() => {
		let stale = false;
		lijst = [];
		laad()
			.then((rs) => {
				if (stale) return;
				lijst = rs;
				rs.forEach((r, k) =>
					aangevuld(r)
						.then((v) => {
							if (!stale && lijst[k]?.id === v.id) lijst[k] = v;
						})
						.catch(() => {})
				);
			})
			.catch(() => {});
		return () => (stale = true);
	});

	const bij = (r: Regeling) =>
		[r.soort, r.datum ? korteDatum(r.datum) : null].filter(Boolean).join(', ');
</script>

{#if lijst.length}
	<section class="regelingen" aria-label={titel}>
		<h4 class="kop">{titel}</h4>
		<ul>
			{#each lijst as r (r.id)}
				<li>
					<a href={buildBronHref(null, r.id)} data-sveltekit-noscroll>{r.naam}</a>
					{#if bij(r)}<span class="bij">{bij(r)}</span>{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.regelingen {
		margin: 0;
	}
	/* A label over the list, in the meta's letter. */
	.kop {
		margin: 0 0 var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	ul {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		margin: 0;
		padding: 0;
		list-style: none;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 var(--s-2);
	}
	a {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	a:hover {
		text-decoration-color: currentColor;
	}
	.bij {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
</style>

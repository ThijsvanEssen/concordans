<script lang="ts">
	// The regulations under an opened item or law of a map (verbonden.ts): a heading, then per
	// regulation its name, a link to its reader, with its kind and date after it and, under a
	// law, the articles it rests on below. First the names, as the list gives them; kind and
	// date fill in after. Nothing where there are none.
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { buildBronHref } from '$lib/bron/href';
	import { report } from '$lib/api/errors';
	import { korteDatum } from '$lib/text/datum';
	import { aangevuld, type Regeling, type Regelingen } from './verbonden';

	let { laad }: { laad: () => Promise<Regelingen> } = $props();

	let titel = $state('');
	let lijst = $state<Regeling[]>([]);

	$effect(() => {
		let stale = false;
		lijst = [];
		laad()
			.then(({ titel: kop, regelingen: rs }) => {
				if (stale) return;
				titel = kop;
				lijst = rs;
				rs.forEach((r, k) =>
					aangevuld(r)
						.then((v) => {
							if (!stale && lijst[k]?.id === v.id) lijst[k] = v;
						})
						.catch(() => {})
				);
			})
			.catch((e) => report('Regelingen', e));
		return () => (stale = true);
	});

	const bij = (r: Regeling) =>
		[r.soort, r.datum ? korteDatum(r.datum) : null].filter(Boolean).join(', ');
</script>

{#if lijst.length}
	<Sectie title={titel} niveau={4} inklapbaar={false}>
		<ul>
			{#each lijst as r (r.id)}
				<li>
					<a href={buildBronHref(null, r.id)} data-sveltekit-noscroll>{r.naam}</a>
					{#if bij(r)}<span class="bij">{bij(r)}</span>{/if}
					{#if r.artikelen}<span class="op">{r.artikelen}</span>{/if}
				</li>
			{/each}
		</ul>
	</Sectie>
{/if}

<style>
	ul {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		margin: 0;
		padding: 0;
		list-style: none;
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
	.bij,
	.op {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* The articles it rests on, on a line of their own under its name. */
	.op {
		flex-basis: 100%;
	}
</style>

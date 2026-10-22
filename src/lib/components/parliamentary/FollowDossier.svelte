<script lang="ts">
	// Volg in a dossier's head, beside Bewaar: its Atom link, and the dossier kept under Gevolgd
	// in this browser (onderwerpen.ts), as a law is followed from Actueel. Followed, a link
	// leads to Gevolgd and Volg keeps the Atom link,
	// and what Actueel holds of the dossier since the visit before is marked beside it, a link
	// to those days; the visit is then today's (API 0.80.1, #866). Asked after the first paint.
	import { getFeed } from '$lib/api/feed';
	import { report } from '$lib/api/errors';
	import NewMark from '$lib/components/ui/NewMark.svelte';
	import Volg from '$lib/components/ui/Volg.svelte';
	import { atomHref } from '$lib/components/actueel/feed';
	import { vandaag } from '$lib/text/datum';
	import {
		followDossier,
		followsDossier,
		visitDossier,
		type FollowedDossier
	} from '$lib/onderwerpen/onderwerpen';

	let { dossier }: { dossier: FollowedDossier } = $props();

	const today = vandaag();
	const number = $derived(dossier.number);
	const atom = $derived(atomHref({ dossier: number }));
	let followed = $state(false);
	/** The visit before, where Actueel has something of the dossier since. */
	let newSince = $state<string | null>(null);

	$effect(() => {
		const n = number;
		followed = followsDossier(n);
		newSince = null;
		const before = visitDossier(n, today);
		if (!before) return;
		const ac = new AbortController();
		getFeed(
			{ dossier: n, since: before, facets: false, limit: 1 },
			{ signal: ac.signal, wait: 'short' }
		)
			.then((r) => {
				if (r.items.length) newSince = before;
			})
			.catch((e) => {
				if (!ac.signal.aborted) report('Nieuw in dossier', e);
			});
		return () => ac.abort();
	});

	function follow() {
		followDossier(dossier, today);
		followed = followsDossier(dossier.number);
	}
</script>

{#if followed}
	<a class="btn" href="/onderwerpen">Gevolgd</a>
	{#if newSince}<a
			class="new-since"
			href="/actueel?{new URLSearchParams([
				['dossier', number],
				['van', newSince]
			])}"><NewMark since={newSince} /></a
		>{/if}
	<Volg href={atom} />
{:else}
	<Volg href={atom}>
		{#snippet lokaal(close)}
			<button
				type="button"
				role="menuitem"
				class="tekstmenu__item"
				title="Volg dit dossier onder Gevolgd"
				onclick={() => {
					close();
					follow();
				}}>Bewaar bij Gevolgd</button
			>
		{/snippet}
	</Volg>
{/if}

<style>
	.new-since {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
</style>

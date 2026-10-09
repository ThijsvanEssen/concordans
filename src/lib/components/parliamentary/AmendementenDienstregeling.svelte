<script lang="ts">
	// The amendments of a bill, each with its route in one line (amendementen.ts): submitted
	// on a day (nr. 22), changed on the next (nr. 30), voted on a day, and its outcome. The
	// days written out, so it can be told at a glance when something happened (Thijs, 10 Oct:
	// "De datum is nog niet echt duidelijk, omdat de schaal zo fragiel is"); the columns of
	// days that stood here before said nothing of the time between them. Asked once the
	// section comes into view: one request, the dossier's neighbourhood.
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import Uitkomst from './Uitkomst.svelte';
	import { dagMaand, korteDatum } from '$lib/text/datum';
	import {
		getAmendementen,
		stappen,
		type Dienstregeling,
		type Rij,
		type Stuk
	} from './amendementen';

	let { dossierKey }: { dossierKey: string } = $props();

	let regeling = $state<Dienstregeling | null>(null);
	let fout = $state(false);
	let zichtbaar = $state(false);

	$effect(() => {
		if (!zichtbaar) return;
		const key = dossierKey;
		let weg = false;
		regeling = null;
		fout = false;
		getAmendementen(key)
			.then((r) => {
				if (!weg) regeling = r;
			})
			.catch(() => {
				if (!weg) fout = true;
			});
		return () => {
			weg = true;
		};
	});

	function inBeeld(el: HTMLElement) {
		const kijk = new IntersectionObserver(
			([e]) => {
				if (!e.isIntersecting) return;
				zichtbaar = true;
				kijk.disconnect();
			},
			{ rootMargin: '200px' }
		);
		kijk.observe(el);
		return { destroy: () => kijk.disconnect() };
	}

	/** The day in full where the route begins or the year changes; else day and month. */
	const dag = (iso: string, vorige: string | null) =>
		!vorige || vorige.slice(0, 4) !== iso.slice(0, 4) ? korteDatum(iso) : dagMaand(iso);

	const uitkomst = (r: Rij) =>
		!r.uitslag || r.uitslag.aangenomen === null
			? { soort: 'open' as const, woord: r.uitslag ? 'gestemd' : 'geen stemming' }
			: r.uitslag.aangenomen
				? { soort: 'ja' as const, woord: 'aangenomen' }
				: { soort: 'nee' as const, woord: 'verworpen' };
</script>

{#snippet nummers(lijst: Stuk[])}
	({lijst.length === 1 ? 'nr.' : 'nrs.'}
	{#each lijst as h, i (h.id)}{#if i > 0}{i === lijst.length - 1 ? ' en ' : ', '}{/if}<BronLink
			ref={h.id}
			title={h.titel}>{h.nummer}</BronLink
		>{/each})
{/snippet}

<div class="amendementen" use:inBeeld>
	<Sectie titel="Amendementen" soort="documents" aantal={regeling?.rijen.length ?? null}>
		{#if fout}
			<p class="stand">De amendementen konden niet worden geladen.</p>
		{:else if !regeling}
			<p class="stand">Amendementen laden…</p>
		{:else}
			<ol class="lijst">
				{#each regeling.rijen as r (r.stuk.id)}
					{@const route = stappen(r)}
					{@const u = uitkomst(r)}
					<li class="am">
						{#if r.indiener}
							<span class="indiener"
								>{r.indiener.naam}{r.indiener.fractie ? ` (${r.indiener.fractie})` : ''}{r.indiener
									.anderen > 0
									? ' c.s.'
									: ''}</span
							>
						{/if}
						<span class="titel">{r.stuk.titel}</span>
						<p class="route">
							{#each route as s, i (s.datum + s.wat)}
								{#if i > 0}<span class="pijl" aria-hidden="true">›</span>{/if}<span class="stap"
									>{s.wat}
									<time datetime={s.datum}>{dag(s.datum, i > 0 ? route[i - 1].datum : null)}</time>
									{@render nummers(s.stukken)}</span
								>
							{/each}
							{#if r.uitslag}
								<span class="pijl" aria-hidden="true">›</span><span class="stap"
									>gestemd
									<time datetime={r.uitslag.datum}
										>{dag(r.uitslag.datum, route.at(-1)?.datum ?? null)}</time
									>:
									<BronLink ref={r.uitslag.id} class="uitslag" preview={false}
										><Uitkomst soort={u.soort} woord={u.woord} /></BronLink
									>{#if r.uitslag.voor != null && r.uitslag.tegen != null}, {r.uitslag.voor} voor,
										{r.uitslag.tegen} tegen{/if}</span
								>
							{:else if regeling.metVervanging}
								<!-- Not replaced and never voted: withdrawn or still open. Without the
								     chains a paper without a vote may have been replaced: nothing said. -->
								<span class="pijl" aria-hidden="true">›</span><span class="stap"
									><Uitkomst soort={u.soort} woord={u.woord} /></span
								>
							{/if}
						</p>
					</li>
				{/each}
			</ol>
		{/if}
	</Sectie>
</div>

<style>
	/* A state line under the heading, at rung 6. */
	.stand {
		margin: 0;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.lijst {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.am {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--s-3) 0;
		border-bottom: 1px solid var(--rule);
	}
	/* The amendment: its first signer at rung 4, its title under it at rung 5. */
	.indiener {
		font-size: var(--t-body-2);
		font-weight: 600;
		color: var(--ink);
	}
	.titel {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		font-size: var(--t-micro);
		color: var(--ink-3);
		line-height: 1.35;
	}
	/* The route: each step a word, its day (what the eye looks for, in the deciding weight)
	   and its papers; the vote and its outcome at the end. */
	.route {
		margin: var(--s-1) 0 0;
		font-size: var(--t-meta);
		color: var(--ink-3);
		line-height: 1.6;
	}
	.route time {
		font-weight: 600;
		color: var(--ink);
		white-space: nowrap;
	}
	.pijl {
		margin: 0 0.35em;
		color: var(--ink-3);
	}
	.route :global(.uitslag) {
		color: inherit;
		text-decoration: none;
	}
	.route :global(.uitslag:hover) {
		text-decoration: underline;
	}
</style>

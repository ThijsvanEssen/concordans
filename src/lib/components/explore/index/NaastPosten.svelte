<script lang="ts">
	import { capitalize, escapeRegExp } from '$lib/text/words';
	// Bewindspersonen side by side: the ministers per post across cabinets. A row per post of
	// a minister, a column per cabinet, the column heads as in the Kruiswoord and the rows as
	// IndexRow. Who stayed on from the cabinet before is grey, who came new is in ink. Under
	// each name its share of that cabinet (Strookje). One click opens the post in place under
	// its row (PostOpen), as on one cabinet. Lazy: each column fills when its cabinet is in,
	// the newest first. On a phone: per post the shared Tijdlijn in the form of terms (as
	// Loopbaan), one line per person across the cabinets.
	import { naamVan } from '$lib/bron/menselijk';
	import CabinetPostOpen from './CabinetPostOpen.svelte';
	import Tijdlijn from '$lib/components/tijdlijn/Tijdlijn.svelte';
	import type { TijdGroep } from '$lib/components/tijdlijn/tijdlijn';
	import { getCabinet } from '$lib/api/records';
	import { cabinetShortName, laterPosts, period, type Cabinet } from './government';
	import { getMinistries } from '$lib/api/government';
	import { sideBySideRows, type SideBySideRow } from './side-by-side';
	import { load } from '$lib/util/load.svelte';
	import { smalScherm } from '$lib/util/smal.svelte';
	import { partyColor } from '$lib/components/explore/party-color.svelte';
	import { DAY_MS, vandaag } from '$lib/text/datum';
	import type { Schema } from '$lib/api/types';
	import Strookje from '$lib/components/tijdlijn/Strookje.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import type { LoadState as State } from '$lib/util/load.svelte';
	import { report } from '$lib/api/errors';
	import { untrack } from 'svelte';

	type Detail = Schema<'CabinetDetailDTO'>;
	type Seat = NonNullable<Detail['ministries']>[number]['seats'][number];
	type Post = Seat['posts'][number];

	let {
		kabinetten,
		openId,
		onToggle,
		zoek = '',
		commitmentsHref
	}: {
		/** The cabinets of the columns, oldest first. */
		kabinetten: Cabinet[];
		openId: string | null;
		onToggle: (id: string) => void;
		/** The search text of Bladeren: only the people whose name holds it. */
		zoek?: string;
		/** Where the open toezeggingen of a person are listed. */
		commitmentsHref: (memberKey: string) => string;
	} = $props();

	const scherm = smalScherm();

	/** Each column's cabinet; a failed one says so above the matrix, with Opnieuw. */
	let details = $state<Record<string, State<Detail>>>({});
	const ask = (key: string) => {
		details = { ...details, [key]: { status: 'loading' } };
		getCabinet(key).then(
			(data) => (details = { ...details, [key]: { status: 'ready', data } }),
			(error) => {
				report('Kabinet naast de andere', error);
				details = { ...details, [key]: { status: 'error', error } };
			}
		);
	};
	$effect(() => {
		// The newest first: the one asked most, and in the cache from the list of one cabinet.
		const nieuw = [...kabinetten].reverse().filter((k) => !untrack(() => details[k.key]));
		untrack(() => nieuw.forEach((k) => ask(k.key)));
	});
	const ready = (key: string) => {
		const d = details[key];
		return d?.status === 'ready' ? d.data : null;
	};

	/** The ministries, for the order of the rows and the row of a renamed one. */
	const ministries = load(
		() => true,
		() => getMinistries(),
		'Ministeries naast elkaar'
	);

	const waiting = (key: string) => (details[key]?.status ?? 'loading') === 'loading';
	/** Every column is in (or failed): an empty matrix is then the search, not the wait. */
	const binnen = $derived(
		ministries.state.status === 'ready' && kabinetten.every((k) => !waiting(k.key))
	);
	const mislukt = $derived(kabinetten.filter((k) => details[k.key]?.status === 'error'));
	const NU = vandaag();

	type Cel = { posts: Post[]; van: string; tot: string; later: Set<Post> };
	type Rij = SideBySideRow<Cel>;

	const zoekt = $derived(zoek.trim() ? new RegExp(escapeRegExp(zoek.trim()), 'i') : null);
	const rijen = $derived.by(() => {
		if (ministries.state.status !== 'ready') return [];
		const columns = kabinetten.map((k) => ready(k.key));
		const later = columns.map((d) =>
			laterPosts((d?.ministries ?? []).flatMap((x) => x.seats.flatMap((s) => s.posts)))
		);
		return sideBySideRows(columns, ministries.state.data, (seat, d, i) => {
			const posts = zoekt ? seat.posts.filter((p) => zoekt.test(naam(p))) : seat.posts;
			return posts.length
				? { posts, van: d.from_date ?? '', tot: d.to_date ?? NU, later: later[i] }
				: null;
		});
	});

	const dag = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS;
	const plek = (c: Cel, p: Post) => {
		const span = Math.max(1, dag(c.tot) - dag(c.van));
		const van = (dag(p.from_date ?? c.van) - dag(c.van)) / span;
		const tot = (dag(p.to_date ?? c.tot) - dag(c.van)) / span;
		return { van: Math.max(0, van), tot: Math.min(1, tot) };
	};
	/** Stayed on: the same person on this post in the cabinet before, from the first day. */
	const blijft = (r: Rij, i: number, p: Post) => {
		const vorige = r.cells[i - 1];
		if (!vorige || (p.from_date && p.from_date > kabinetten[i].from_date!)) return false;
		return vorige.posts.some((q) => q.member.key === p.member.key);
	};
	const postId = (seat: string, i: number, p: Post) =>
		`naast/${seat}/${kabinetten[i].key}/${p.member.key}/${p.from_date ?? ''}`;
	const naam = (p: Post) => p.member.name ?? naamVan('members', p.member);
	const partij = (p: Post) => p.party?.short ?? null;
	const kleur = (p: Post) => (partij(p) ? partyColor(partij(p)!) : 'var(--rule-strong)');

	const geopend = $derived.by(() => {
		if (!openId?.startsWith('naast/')) return null;
		for (const r of rijen)
			for (const [i, c] of r.cells.entries())
				for (const p of c?.posts ?? []) if (postId(r.key, i, p) === openId) return { r, p, c: c! };
		return null;
	});

	// Phone: per post the people as terms, newest on top. Who held the post in two cabinets
	// in a row is one line ("VVD, Schoof tot Jetten").
	const groepen = $derived.by((): TijdGroep[] =>
		rijen.map((r) => {
			type Termijn = { id: string; p: Post; van: string; tot: string | null; kab: string[] };
			const termijnen: Termijn[] = [];
			r.cells.forEach((c, i) => {
				for (const p of c?.posts ?? []) {
					const vorige = termijnen.findLast((t) => t.p.member.key === p.member.key);
					if (vorige && blijft(r, i, p) && !p.acting) {
						vorige.tot = p.to_date ?? (kabinetten[i].to_date ? c!.tot : null);
						vorige.kab.push(cabinetShortName(kabinetten[i].name));
						vorige.p = p;
						vorige.id = postId(r.key, i, p);
						continue;
					}
					termijnen.push({
						id: postId(r.key, i, p),
						p,
						van: p.from_date ?? c!.van,
						tot: p.to_date ?? (kabinetten[i].to_date ? c!.tot : null),
						kab: [cabinetShortName(kabinetten[i].name)]
					});
				}
			});
			return {
				id: r.key,
				titel: r.title,
				sub: r.primeMinister ? 'minister-president' : null,
				regels: termijnen.map((t) => ({
					id: t.id,
					datum: t.van,
					periode: { van: t.van, tot: t.tot },
					teken: 'stuk' as const,
					zin: naam(t.p),
					meta: [
						partij(t.p),
						t.kab.length > 1 ? `${t.kab[0]} tot ${t.kab.at(-1)}` : t.kab[0],
						t.p.acting ? 'waarnemend' : null
					]
						.filter(Boolean)
						.join(', '),
					inhoud: open
				}))
			};
		})
	);
	const postVan = (id: string) => {
		for (const r of rijen)
			for (const [i, c] of r.cells.entries())
				for (const p of c?.posts ?? []) if (postId(r.key, i, p) === id) return { p, c: c! };
		return null;
	};
</script>

{#snippet postOpen(p: Post, c: Cel)}
	<CabinetPostOpen post={p} counted={!c.later.has(p)} {commitmentsHref} />
{/snippet}

{#snippet open(id: string)}
	{@const g = postVan(id)}
	{#if g}{@render postOpen(g.p, g.c)}{/if}
{/snippet}

{#each mislukt as k (k.key)}
	<LoadState state={details[k.key]!} what={capitalize(k.name)} retry={() => ask(k.key)} />
{/each}

{#if ministries.state.status === 'error'}
	<LoadState state={ministries.state} what="De ministeries" plural retry={ministries.retry} />
{:else if scherm.smal}
	<Tijdlijn
		{groepen}
		perioden
		volgorde="aflopend"
		{openId}
		{onToggle}
		leeg={binnen ? 'Geen ministers met deze naam.' : 'Laden…'}
	/>
{:else}
	<div class="matrix" style:--kol={kabinetten.length} data-zijscroll>
		<div class="rij rij--kop">
			<span class="k k--post">Post</span>
			{#each kabinetten as k (k.key)}
				<span class="k"
					><span class="k-naam">{cabinetShortName(k.name)}</span><span class="k-jaren"
						>{period(k.from_date, k.to_date)}</span
					></span
				>
			{/each}
		</div>
		{#each rijen as r (r.key)}
			{@const isOpen = geopend?.r === r}
			<div class="rij" class:rij--open={isOpen}>
				<span class="post"
					>{r.title}{#if r.primeMinister}<span class="post-sub">, minister-president</span
						>{/if}</span
				>
				{#each r.cells as c, i (i)}
					<span class="cel">
						{#if c}
							{#each c.posts as p (postId(r.key, i, p))}
								{@const id = postId(r.key, i, p)}
								{@const b = plek(c, p)}
								<button
									type="button"
									class="pers"
									class:pers--blijft={blijft(r, i, p)}
									aria-expanded={openId === id}
									onclick={() => onToggle(id)}
								>
									<span class="naam">{naam(p)}</span>
									<span class="meta"
										>{[partij(p), p.acting ? 'waarnemend' : null].filter(Boolean).join(', ')}</span
									>
									<Strookje
										from={b.van}
										to={b.tot}
										kleur={kleur(p)}
										open={openId === id}
										waarnemend={p.acting}
									/>
								</button>
							{/each}
						{:else if waiting(kabinetten[i].key)}
							<span class="wacht" aria-hidden="true"></span>
						{/if}
					</span>
				{/each}
			</div>
			{#if isOpen && geopend}
				<!-- As an opened row in Bladeren: the same ground, under the row. -->
				<div class="open">{@render postOpen(geopend.p, geopend.c)}</div>
			{/if}
		{:else}
			<p class="stil">{binnen ? 'Geen ministers met deze naam.' : 'Laden…'}</p>
		{/each}
	</div>
{/if}

<style>
	/* A cabinet's column holds its name and "Rutte-Verhagen" whole; where the column of the
	   page is narrower than all of them, the cabinets scroll within it beside the post (#81). */
	.matrix {
		--post: 176px;
		--cel: 112px;
		overflow-x: auto;
	}
	.rij {
		display: grid;
		grid-template-columns: var(--post) repeat(var(--kol), minmax(var(--cel), 1fr));
		column-gap: var(--s-3);
		min-width: calc(var(--post) + var(--kol) * (var(--cel) + var(--s-3)));
		border-bottom: 1px solid var(--rule);
	}
	.rij--open {
		background: var(--paper-2);
	}
	/* The heads as in the Kruiswoord: rung 3 for the cabinet, rung 6 for its years, each
	   with its own line in rule-strong. */
	.rij--kop {
		border-bottom: 0;
		align-items: end;
	}
	.k {
		display: flex;
		flex-direction: column;
		padding: 0 0 var(--s-1);
		border-bottom: 1px solid var(--rule-strong);
		font-family: var(--font-serif);
	}
	.k--post {
		/* The whole height of the head, so the cabinets pass under it. */
		align-self: stretch;
		justify-content: flex-end;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.k--post,
	.post {
		position: sticky;
		left: 0;
		z-index: 1;
		background: var(--paper);
	}
	.rij--open .post {
		background: var(--paper-2);
	}
	.k-naam {
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
	}
	.k-jaren {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.post {
		padding: var(--s-3) 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		line-height: var(--lh-snug);
		color: var(--ink);
	}
	.post-sub {
		font-weight: 400;
		color: var(--ink-3);
	}
	.cel {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		padding: var(--s-3) 0;
		min-width: 0;
	}
	.pers {
		display: flex;
		flex-direction: column;
		gap: 0;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		text-align: left;
		color: var(--ink);
		cursor: pointer;
	}
	.naam {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: var(--lh-snug);
		color: var(--ink);
	}
	.pers:hover .naam {
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.pers:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	/* Stayed on: the name grey, the Strookje as ever; who came new stands in ink. */
	.pers--blijft .naam {
		color: var(--ink-3);
	}
	.meta {
		margin-bottom: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.wacht {
		display: block;
		height: var(--s-4);
		background: var(--paper-2);
	}
	.open {
		position: sticky;
		left: 0;
		padding-left: calc(var(--post) + var(--s-3));
		background: var(--paper-2);
		border-bottom: 1px solid var(--rule);
	}
</style>

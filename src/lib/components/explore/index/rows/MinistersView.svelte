<script lang="ts">
	import type { Schema } from '$lib/api/types';
	import { openHref } from '$lib/bron/href';
	import NameLink from '$lib/bron/NameLink.svelte';
	import { capitalize, plural } from '$lib/text/words';
	import CabinetOccupancy from '../CabinetOccupancy.svelte';
	import NaastPosten from '../NaastPosten.svelte';
	import { OPEN_STATUS, inOffice, period, type Cabinet } from '../government';
	import { matches, type ViewProps } from '../lists/list';
	import type { MinisterRow } from '../lists/ministers';

	let { ctx }: ViewProps<MinisterRow, object> = $props();
	const { p } = $derived(ctx);
	const isOpen = (c: Cabinet) => inOffice(c, ctx.shared.cabinets);

	/** Side by side: six cabinets, oldest first, ending at the one chosen or the one in office. */
	const sideBySide = $derived.by(() => {
		if (!p.sideBySide) return [];
		const rows = [...ctx.shared.cabinets]
			.filter((c) => c.from_date)
			.sort((a, b) => a.from_date!.localeCompare(b.from_date!));
		const i = rows.findIndex((c) => c.key === p.cabinet);
		const end = i < 0 ? rows.length : i + 1;
		return rows.slice(Math.max(0, end - 6), end);
	});

	/** The cabinet whose bewindspersonen are listed. */
	const shown = $derived((ctx.page?.of ?? null) as Schema<'CabinetDetailDTO'> | null);
	/** The cabinet as the chart draws it: its seats with the posts the filters let through. */
	const occupancy = $derived.by(() => {
		if (!shown || (!p.post && !p.q)) return shown;
		const keep = (x: Schema<'CabinetPostDTO'>) =>
			(!p.post || x.post === p.post) && (!p.q || matches(p.q, x.member.name));
		return {
			...shown,
			ministries: (shown.ministries ?? [])
				.map((m) => ({
					...m,
					seats: m.seats
						.map((seat) => ({ ...seat, posts: seat.posts.filter(keep) }))
						.filter((seat) => seat.posts.length)
				}))
				.filter((m) => m.seats.length)
		};
	});
	const commitmentsHref = (key: string) =>
		ctx.tabHref('commitments', { persoon: key, status: OPEN_STATUS });
</script>

{#if p.sideBySide}
	<!-- Side by side: the ministers of six cabinets, a row per post. -->
	{#if sideBySide.length}
		{@const eerste = sideBySide[0]}
		{@const laatste = sideBySide.at(-1)!}
		<h2 class="gov-title">Ministers</h2>
		<p class="gov-sub">
			{period(eerste.from_date, laatste.to_date, isOpen(laatste))}, {eerste.name} tot {laatste.name}
		</p>
		<NaastPosten
			kabinetten={sideBySide}
			openId={p.open}
			onToggle={ctx.toggleOpen}
			zoek={p.q}
			{commitmentsHref}
		/>
	{/if}
{:else if shown && occupancy}
	<!-- One title line; the chart is the list: a block opens its details. -->
	<h2 class="gov-title">
		<a href={openHref(`cabinets/${shown.key}`)}>{capitalize(shown.name)}</a>
	</h2>
	<!-- "sinds 2026, minister-president Rob Jetten, 28 bewindspersonen": no space before a comma. -->
	<p class="gov-sub">
		{period(shown.from_date, shown.to_date, isOpen(shown))}{#if shown.prime_minister?.name},
			minister-president <NameLink
				collection="members"
				name={shown.prime_minister.name}
				key={shown.prime_minister.key}
			/>{/if}, {shown.members}
		{plural(shown.members, 'bewindspersoon', 'bewindspersonen')}
	</p>
	{#if !ctx.rows?.length && !ctx.loading}
		{@render ctx.empty('bewindspersonen')}
	{:else}
		<CabinetOccupancy
			cabinet={occupancy}
			openId={p.open}
			onToggle={ctx.toggleOpen}
			{commitmentsHref}
		/>
	{/if}
{/if}

<style>
	/* Bewindspersonen: the cabinet as the title of its chart. */
	.gov-title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		font-weight: 600;
	}
	.gov-title a {
		color: var(--ink);
		text-decoration: none;
	}
	.gov-title a:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.gov-sub {
		margin: var(--s-1) 0 var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
</style>

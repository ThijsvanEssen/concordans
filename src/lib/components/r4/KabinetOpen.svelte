<script lang="ts">
	// Ontwerpstudie ronde 4b (prototype): een geopend kabinet in de vorm van OpenRij. Wat het
	// kabinet is in één zin; wat er gebeurde (formatie, beëdiging, demissionair) en de laatste
	// toezeggingen in de tijdlijn; links naar bewindspersonen, toezeggingen en wetsvoorstellen.
	import { api, unwrap } from '$lib/api/client';
	import { bronHref, indexHref } from '$lib/bron/href';
	import { datum } from '$lib/components/parliamentary/stand';
	import OpenRij from './OpenRij.svelte';
	import type { TijdRegel } from './tijdlijn';

	let { cabinetKey, naam, inFunctie, bron, ministersHref }: { cabinetKey: string; naam: string; inFunctie: boolean; bron: string; ministersHref: string } = $props();

	type Detail = Awaited<ReturnType<typeof load>>;
	const load = (key: string, signal: AbortSignal) => unwrap(api.GET('/api/cabinets/{key}', { params: { path: { key } }, signal }));
	let d = $state<Detail | null>(null);
	let regels = $state<TijdRegel[] | null>(null);

	const FASE: Record<string, string> = { formatie: 'Formatie', in_functie: 'In functie', beediging: 'Beëdigd', 'beëdiging': 'Beëdigd', demissionair: 'Demissionair', ontslag: 'Ontslagen' };

	$effect(() => {
		const key = cabinetKey;
		const ac = new AbortController();
		regels = null;
		Promise.all([
			load(key, ac.signal).catch(() => null),
			unwrap(api.GET('/api/commitments', { params: { query: { cabinet: key, limit: 3, sort: 'date' } }, signal: ac.signal })).catch(() => null)
		]).then(([det, c]) => {
			if (ac.signal.aborted) return;
			d = det;
			const out: TijdRegel[] = [];
			for (const f of det?.phases ?? []) {
				const k = f.kind ?? '';
				out.push({ id: `f-${k}-${f.from_date}`, datum: f.from_date ?? null, teken: 'activiteit', label: FASE[k] ?? k, zin: f.label ?? FASE[k] ?? k });
			}
			for (const t of c?.items ?? [])
				out.push({
					id: t.key,
					datum: t.date ?? null,
					teken: t.status === 'Afgedaan' ? 'ja' : t.status === 'Vervallen' ? 'nee' : 'open',
					label: `Toezegging van ${(t.minister_name ?? '').replace(/,.*$/, '')}, ${(t.status ?? '').toLowerCase()}`,
					zin: t.text ?? '',
					href: bronHref(`commitments/${t.key}`, { keepMode: false, mode: 'read' })
				});
			regels = out.sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? '')).slice(0, 5);
		});
		return () => ac.abort();
	});

	const zin = $derived(
		d
			? `${inFunctie ? `In functie sinds ${datum(d.from_date)}` : `Van ${datum(d.from_date)} tot ${datum(d.to_date)}`}${d.demissionary_from ? `, demissionair sinds ${datum(d.demissionary_from)}` : ''}.`
			: naam
	);
</script>

<OpenRij
	{zin}
	laden={regels === null}
	groepen={regels ? [{ id: 'recent', titel: 'Recent', regels }] : []}
	links={d
		? [
				{ label: `${d.members} bewindspersonen, per ministerie`, href: ministersHref },
				{ label: `${d.commitments} toezeggingen`, href: d.commitments ? indexHref('commitments', { cabinet: cabinetKey }) : null },
				{ label: `${d.bills} wetsvoorstellen ingediend` }
			]
		: []}
	lezen={bronHref(bron, { keepMode: false, mode: 'read' })}
	lezenLabel="Kabinet lezen"
	netwerk={bronHref(bron, { keepMode: false, mode: 'graph' })}
/>

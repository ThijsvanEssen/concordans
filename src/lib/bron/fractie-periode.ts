// The fracties of a lid with their periods, for the kern line "Fractie: Volt, sinds 2021"
// (Thijs, 9 Oct). From the lid's own `faction_memberships`, one record per role and term as
// the source gives them; records that follow on from each other (a new role the next day) are
// one period. The years only: the days are in the reader.
import { DAY_MS } from '$lib/text/datum';
import { naamVan } from '$lib/bron/menselijk';

export type Lidmaatschap = {
	faction_key?: string | null;
	abbreviation?: string | null;
	name?: string | null;
	from_date?: string | null;
	to_date?: string | null;
};

export type FractiePeriode = {
	key: string;
	naam: string;
	/** `sinds 2021`, `2017–2021`, `2017–2022, 2023–2026`. */
	periode: string;
	/** The last day of the latest period, null while it runs. */
	tot: string | null;
};

const jaar = (d: string) => d.slice(0, 4);

/** Whether `next` starts the day after `prev` ends, or before. */
const sluitAan = (prevTo: string | null, nextFrom: string | null) =>
	prevTo === null || nextFrom === null || Date.parse(nextFrom) - Date.parse(prevTo) <= DAY_MS;

/** Each fractie once, the latest first, with its periods. */
export function fractiePeriodes(list: unknown): FractiePeriode[] {
	if (!Array.isArray(list)) return [];
	const per = new Map<string, Lidmaatschap[]>();
	for (const m of list as Lidmaatschap[]) {
		const key = m.faction_key?.trim();
		if (!key) continue;
		per.set(key, [...(per.get(key) ?? []), m]);
	}
	const uit: FractiePeriode[] = [];
	for (const [key, ms] of per) {
		const sorted = [...ms].sort((a, b) => (a.from_date ?? '').localeCompare(b.from_date ?? ''));
		const spans: { from: string | null; to: string | null }[] = [];
		for (const m of sorted) {
			const last = spans.at(-1);
			if (last && sluitAan(last.to, m.from_date ?? null)) {
				last.to =
					last.to === null || m.to_date == null ? null : m.to_date > last.to ? m.to_date : last.to;
			} else spans.push({ from: m.from_date ?? null, to: m.to_date ?? null });
		}
		const periode = spans
			.map(({ from, to }) =>
				!from
					? to
						? `tot ${jaar(to)}`
						: ''
					: to === null
						? `sinds ${jaar(from)}`
						: jaar(from) === jaar(to)
							? jaar(from)
							: `${jaar(from)}–${jaar(to)}`
			)
			.filter(Boolean)
			.join(', ');
		const m = sorted[0];
		uit.push({
			key,
			naam: m.abbreviation?.trim() || m.name?.trim() || naamVan('factions', { key }),
			periode,
			tot: spans.at(-1)?.to ?? null
		});
	}
	// The current fractie first, then by the end of the latest period.
	return uit.sort((a, b) =>
		a.tot === b.tot ? 0 : a.tot === null ? -1 : b.tot === null ? 1 : b.tot.localeCompare(a.tot)
	);
}

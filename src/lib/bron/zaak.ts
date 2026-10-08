// The papers of the same zaak (the Kamer's case) as a stuk: a geleidende brief and the nota it
// offers share one, as the source files them (PART_OF). The substance first, the cover letter
// last, by the kind the source gives (Thijs, 9 Oct: "het gaat om de nota's"). Shared by
// Verbonden (`document-same-case`) and the band Behoort bij (beside a Kamerstuk).
import { getBuckets } from '$lib/api/nodes';
import { abortable, once } from '$lib/api/records';
import type { Neighbor } from '$lib/api/nodes';
import { rowOfNeighbor, type Row } from '$lib/verbonden/rows';

/** The zaken of a stuk asked for their papers: one is the rule, a few at most. */
export const ZAKEN_MAX = 3;

const NAAR_ZAAK = { relation: 'PART_OF', direction: 'outbound', collection: 'cases' } as const;

/**
 * Where a paper of a zaak stands, by the kind the source gives (`props.kind`): the substance
 * (a nota, a voorstel, a memorie, a bijlage, a rapport) first, then letters, the geleidende
 * brief last.
 */
export function zaakRang(row: Pick<Row, 'props'>): number {
	const soort = String(row.props?.kind ?? '').toLowerCase();
	if (/geleidende brief|aanbiedingsbrief/.test(soort)) return 2;
	if (/^brief/.test(soort)) return 1;
	return 0;
}

/**
 * A paper that changes or explains a bill (nota van wijziging, memorie van toelichting,
 * nader rapport, nota naar aanleiding van het verslag): its voorstel van wet is a kern line,
 * Bij wetsvoorstel, and so not one of the papers listed beside it.
 */
export const isBijWetsvoorstel = (kind: unknown) =>
	/nota van wijziging|memorie van toelichting|nader rapport|naar aanleiding van het verslag/i.test(
		typeof kind === 'string' ? kind : ''
	);

const isWetsvoorstel = (r: Pick<Row, 'props'>) =>
	/^voorstel van wet/i.test(String(r.props?.kind ?? ''));

/** The voorstel van wet of the zaak, the one Bij wetsvoorstel names; null without one. */
export const wetsvoorstelVan = (rows: Row[]): Row | null => rows.find(isWetsvoorstel) ?? null;

/**
 * The papers beside a stuk: for a paper of a bill without the voorstel its kern line names
 * (Thijs, 9 Oct: kern in the reader, not again in Verbonden).
 */
export function naastHetStuk(kind: unknown, zaak: DezelfdeZaak): DezelfdeZaak {
	if (!isBijWetsvoorstel(kind)) return zaak;
	const voorstel = wetsvoorstelVan(zaak.rows);
	if (!voorstel) return zaak;
	const rows = zaak.rows.filter((r) => r !== voorstel);
	return {
		rows,
		order: new Set(rows.map(zaakRang)).size > 1 ? zaak.order : undefined
	};
}

export type DezelfdeZaak = {
	/** The other papers, without the stuk itself; empty where its zaak holds only it. */
	rows: Row[];
	/** Said only where the list holds both the substance and a letter. */
	order?: string;
};

/**
 * The other papers of the zaken a stuk belongs to. `zaken`: the stuk's PART_OF neighbours
 * when the caller has them (Verbonden); otherwise asked here, one request.
 */
export async function stukkenInDezelfdeZaak(
	stuk: { key: string },
	signal?: AbortSignal,
	zaken?: Neighbor[]
): Promise<DezelfdeZaak> {
	// Asked once per stuk and per zaak: Verbonden, the line Bij wetsvoorstel and the group In
	// dezelfde zaak all want them on one page.
	const cases = (
		zaken ??
		(await abortable(
			once(`zaken-van/${stuk.key}`, () => getBuckets('documents', stuk.key, [NAAR_ZAAK])),
			signal
		))
	)
		.filter(
			(n) => n.relation === 'PART_OF' && n.direction === 'outbound' && n.collection === 'cases'
		)
		.slice(0, ZAKEN_MAX);
	const rows = new Map<string, Row>();
	for (const c of cases) {
		const docs = await abortable(
			once(`stukken-van-zaak/${c.key}`, () =>
				getBuckets('cases', c.key, [
					{ relation: 'PART_OF', direction: 'inbound', collection: 'documents' }
				])
			),
			signal
		);
		for (const d of docs) {
			if (d.collection !== 'documents' || d.key === stuk.key || rows.has(d.key)) continue;
			const row = rowOfNeighbor(d);
			// No edge joins it to this stuk: it is not drawn around it.
			if (row) rows.set(d.key, { ...row, relation: undefined, direction: undefined });
		}
	}
	const lijst = [...rows.values()].sort(
		(a, b) => zaakRang(a) - zaakRang(b) || (a.date ?? '').localeCompare(b.date ?? '') || 0
	);
	return {
		rows: lijst,
		order:
			new Set(lijst.map(zaakRang)).size > 1
				? 'Het stuk zelf eerst, de begeleidende brief als laatste'
				: undefined
	};
}

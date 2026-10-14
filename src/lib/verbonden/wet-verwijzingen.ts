// The references between the articles of two laws (`.../references/{other}`), as a row of
// Wetten die met deze wet verbonden zijn lists them when it opens: per referring article the
// articles it refers to, with the leden and onderdelen named, `art. 2` naar `art. 16 lid 1`
// en `art. 17`. The articles of this law first refer outward, then those of the other law
// refer here, as the API orders them.
import type { Schema } from '$lib/api/types';
import { artikelDelen } from '$lib/text/delegaties';
import { naamVan } from '$lib/bron/menselijk';

type Verwijzing = Schema<'InstrumentReferenceDTO'>;

/** An article a line names: its node key and how it is cited, `art. 16 lid 1`. */
export type Genoemd = { key: string; label: string };

/**
 * One referring article and the articles it refers to, those without `art.`: the line says it
 * once, `art. 2 verwijst naar art. 16 lid 1 en 17`.
 */
export type Regel = { bron: Genoemd; doelen: Genoemd[] };

/** The lines of one direction: `outbound` from this law, `inbound` to it. */
export type Richting = { richting: 'outbound' | 'inbound'; regels: Regel[] };

const label = (
	a: Schema<'InstrumentReferenceArticleDTO'>,
	delen: Pick<Verwijzing, 'leden' | 'onderdelen'> | null = null,
	art = 'art. '
): string => {
	const [deel] = artikelDelen(
		[{ article_number: a.article_number, leden: delen?.leden, onderdelen: delen?.onderdelen }],
		a.bwb_id
	);
	return deel ? `${art}${deel}` : naamVan('articles', a);
};

/**
 * The references grouped by direction and referring article, in the API's order; a target
 * named twice by one article stands once, with the leden of both.
 */
export function verwijzingenPerRichting(items: readonly Verwijzing[]): Richting[] {
	const per = new Map<string, Map<string, { bron: Genoemd; doelen: Map<string, Verwijzing[]> }>>();
	for (const v of items) {
		const r = v.direction === 'inbound' ? 'inbound' : 'outbound';
		const regels = per.get(r) ?? new Map();
		per.set(r, regels);
		const regel = regels.get(v.source.key) ?? {
			bron: { key: v.source.key, label: label(v.source) },
			doelen: new Map()
		};
		regels.set(v.source.key, regel);
		regel.doelen.set(v.target.key, [...(regel.doelen.get(v.target.key) ?? []), v]);
	}
	return (['outbound', 'inbound'] as const)
		.filter((r) => per.has(r))
		.map((richting) => ({
			richting,
			regels: [...per.get(richting)!.values()].map(({ bron, doelen }) => ({
				bron,
				doelen: [...doelen.values()].map((vs) => {
					// Named once whole: the whole article (artikelDelen).
					const heel = vs.some((v) => !v.leden?.length);
					const target = vs[0].target;
					return {
						key: target.key,
						label: label(
							target,
							{
								leden: heel ? [] : vs.flatMap((v) => v.leden ?? []),
								onderdelen: heel ? [] : vs.flatMap((v) => v.onderdelen ?? [])
							},
							''
						)
					};
				})
			}))
		}));
}

/** The kicker over a direction, where both are listed: `Vanuit deze wet`, `Naar deze wet`. */
export const richtingKop = (r: Richting['richting'], dit: string): string =>
	r === 'outbound' ? `Vanuit ${dit}` : `Naar ${dit}`;

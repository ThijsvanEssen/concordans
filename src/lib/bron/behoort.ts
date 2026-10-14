// Where a bron stands, for the band "Behoort bij" above every reader: the kern, the relations
// without which the bron does not read (Procesgang, Ingediend bij, Wet), as lines in the
// reading column; under them the groups of its context, folded. The lines per kind of bron
// are a table (behoort-rules); a layer the data lacks is left out without a word.
// Thijs, 9 Oct: "maak het consistent en klikbaar", and the conclusie and eerdere aanleg of an
// arrest are "vrij cruciale info", not extra data.
import { findBucket, type Bucket, type NodeGraph } from '$lib/api/nodes';
import { ifExists } from '$lib/api/errors';
import { getDossier } from '$lib/components/parliamentary/data';
import type { Collection } from '$lib/vocabulary';
import { dossierNummer, laagVan, type Behoort, type Regel } from './behoort-layer';
import { procesgangIds } from './behoort-procesgang';
import { BANDS, kernOf, type BucketLine, type Context } from './behoort-rules';

export {
	dossierNummer,
	laagVan,
	uitkomstVan,
	type Bak,
	type Behoort,
	type Groep,
	type Laag,
	type Regel
} from './behoort-layer';
export { conclusieVan, procesgangIds } from './behoort-procesgang';
export { metEersteKamer } from './behoort-rules';

/** An ordinary line of the table: the first bron of its bucket, where it has one. */
function bucketLine(line: BucketLine, c: Context): Regel[] {
	const n = findBucket(c.light, line.bak)?.items?.[0];
	if (!n) return [];
	const label = typeof line.label === 'string' ? line.label : line.label(n);
	return [{ id: line.id, label, lagen: [laagVan(n, line.soort)] }];
}

/**
 * The band of a bron from its light node (`limit=1`: every bucket with its total and its
 * first row), which the reader has asked already. A layer above is the first row of a
 * bucket that holds one; a group is a bucket with its total, its rows asked when opened.
 */
export function behoort(
	collection: Collection,
	props: Record<string, unknown>,
	light: NodeGraph | null
): Behoort {
	const band = BANDS[collection];
	const c: Context = { props, light };
	return {
		regels: (band?.lines ?? []).flatMap((l) => ('bak' in l ? bucketLine(l, c) : l.lines(c))),
		onder: (band?.groups ?? []).flatMap(({ id, label, bak, atLeast }) => {
			const aantal = findBucket(light, bak)?.total ?? 0;
			return aantal >= atLeast ? [{ id, label, aantal, bak }] : [];
		})
	};
}

/**
 * The ids the band's lazy kern lines name, for Verbonden not to list them again: the
 * procesgang of a uitspraak, what a dossier's bill amends and implements (`legal_effect`,
 * from the detail the reader asks already).
 */
export async function lazeKernIds(
	collection: Collection,
	key: string,
	props: Record<string, unknown>
): Promise<string[]> {
	if (collection === 'judgments') return procesgangIds(key);
	if (collection !== 'dossiers') return [];
	const nummer = dossierNummer(props) ?? key;
	const d = await ifExists(getDossier(nummer));
	const e = d?.legal_effect;
	return [...(e?.amends ?? []), ...(e?.implements ?? [])].map((w) => `instruments/${w.key}`);
}

/**
 * The buckets of the kern per kind of bron: what the lines of the band and the reader's status
 * line name. Verbonden leaves a group out that reads only these (Thijs, 9 Oct: "dubbelop");
 * Verbonden is the context.
 */
export const KERN: Partial<Record<Collection, ReturnType<typeof kernOf>>> = Object.fromEntries(
	Object.entries(BANDS).map(([c, band]) => [c, kernOf(band)])
);

/**
 * Whether a group of Verbonden reads only the kern: every bucket it matches is in `KERN`,
 * and it has no loader of its own.
 */
export function isKernGroep(
	collection: Collection,
	g: { load?: string; match?: readonly Bucket[] }
): boolean {
	const kern = KERN[collection] ?? [];
	if (g.load || !g.match?.length) return false;
	const lijst = <T>(v: T | T[]) => (Array.isArray(v) ? v : [v]);
	return g.match.every((m) =>
		lijst(m.relation).every((relation) =>
			lijst(m.collection).every((coll) =>
				kern.some(
					(k) => k.relation === relation && k.direction === m.direction && k.collection === coll
				)
			)
		)
	);
}

/**
 * Groups that are the bron's own content, not its context: a law's articles are its table
 * of contents and its text (Thijs, 9 Oct: "overdreven als we al een inhoudsopgave hebben").
 * Verbonden leaves them out; the table and an export keep them.
 */
const INHOUD: Partial<Record<Collection, string[]>> = {
	instruments: ['articles'],
	// A fractie's reader lists all its leden (Thijs, 10 Oct: "Leden is hier nu ook dubbelop").
	// A commissie names only its officers and a kabinet counts its bewindspersonen: their
	// lists stay in Verbonden.
	factions: ['members'],
	// A lid's reader lists its commissies; a bewindspersoon's also the dossiers it signed in
	// (BewindspersoonOverzicht). UX-toets 10 Oct, #16: "Commissies 20" stood twice.
	members: ['committees']
};
/** Groups the reader lists only where its props say so: a lid with a post in a kabinet. */
const INHOUD_ALS: Partial<
	Record<Collection, Record<string, (props: Record<string, unknown>) => boolean>>
> = {
	members: {
		dossiers: (props) =>
			Array.isArray(props.government_functions) && props.government_functions.length > 0
	}
};
export const isInhoudGroep = (
	collection: Collection,
	g: { id: string },
	props: Record<string, unknown> = {}
) =>
	(INHOUD[collection]?.includes(g.id) ?? false) ||
	(INHOUD_ALS[collection]?.[g.id]?.(props) ?? false);

/** Whether a band has anything to show. */
export const heeftIets = (b: Behoort) => b.regels.length + b.onder.length > 0;

/** The context through which a reader's frame learns which bron its band is for. */
export const BEHOORT_KEY = Symbol('behoort-bij');

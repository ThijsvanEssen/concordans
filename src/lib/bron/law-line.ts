// The line "Wet" of the band of an article or a bijlage, in words: the law by the kind its own
// page names and its names, an article's divisions by name. The band (behoort-rules) adds the
// links; the first paint of an article's address ($lib/first-paint) sets the same words.
import { textOf } from '$lib/text/words';
import { describeBron } from '$lib/bron/describe';
import { kindName } from '$lib/text/law-kind';
import { lawShortName } from '$lib/text/bw';
import { deelIds, layersOf } from '$lib/text/division';

/** The law as the light node names it (the first of its bucket PART_OF, instruments). */
export type LawSource = {
	collection: string;
	key: string;
	display_name?: string | null;
	props?: Record<string, unknown> | null;
};

/** A layer of the line in words (a `Layer` without its link): its kind, its name, the name a
 *  phone's one line carries; `anchor` the place of a division in the whole law. */
export type LawLayer = { kind: string; name: string; short?: string; anchor?: string };

/** The line's term (`Wet`, `AMvB`), the law, and with `withPlace` the divisions of `props`. */
export function lawLineWords(
	law: LawSource | undefined,
	props: Record<string, unknown>,
	withPlace: boolean
): { term: string; law: LawLayer | null; divisions: LawLayer[] } {
	const p = law?.props ?? {};
	const term = kindName(textOf(p.kind)) ?? 'Wet';
	const short = lawShortName(textOf(p.bwb_id), textOf(p.abbreviation));
	const own = law
		? {
				kind: term,
				name: describeBron(law.collection, law.key, law.display_name, p).title,
				...(short ? { short } : {})
			}
		: null;
	if (!withPlace) return { term, law: own, divisions: [] };
	// Wet › hoofdstuk › titel › afdeling: the division by name (in props, `breadcrumb`); a
	// layer that is the law itself is no layer.
	const crumbs = Array.isArray(props.breadcrumb)
		? (props.breadcrumb as { type?: string; label?: string; title?: string }[])
		: [];
	const layers = layersOf(crumbs, textOf(props.instrument_citation_title));
	const anchors = deelIds(crumbs).slice(crumbs.length - layers.length);
	const divisions = layers
		.map((d, i) => ({
			kind: textOf(d.type) ?? 'Deel',
			name: [textOf(d.label), textOf(d.title)].filter(Boolean).join(' '),
			short: textOf(d.label) ?? undefined,
			anchor: anchors[i]
		}))
		.filter((l) => l.short);
	return { term, law: own, divisions };
}

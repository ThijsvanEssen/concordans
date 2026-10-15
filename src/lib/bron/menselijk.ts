// The name of a bron as a reader reads it, never its key (Orchestrator, 10 Oct: the fallback
// reader showed "bwbr0005537_2022_05_01" as its title; the network drew toezeggingen by their
// uuid and wetten by "bwbr0014315"). The first name the data gives that is not a key; else
// the source values of its kind (a version by its law and day, a toezegging by its number);
// else the kind's name and its date. One helper for every place that shows a bron: the
// canvas (buildNodeLabel), Verbonden and the band (describe), the search, the readers.
import { textOf } from '$lib/text/words';
import { BRON_LABEL, isCollection } from '$lib/vocabulary';
import { langeDatum } from '$lib/text/datum';
import { articleName } from '$lib/text/bw';

/**
 * What a key, id or slug looks like as text: lowercase words joined by underscores, a BWB
 * id in lowercase (the key; the BWB's own BWBR0005537 is an official id, as an ECLI is),
 * a uuid, a node id `collection/key`.
 */
const RAUW: readonly RegExp[] = [
	/\b[a-z0-9]+(?:_[a-z0-9]+){2,}\b/,
	/\bbwb[rv]\d{7}\b/,
	/\b[0-9a-f]{8}[_-][0-9a-f]{4}[_-][0-9a-f]{4}/i,
	new RegExp(`\\b(?:${Object.keys(BRON_LABEL).join('|')})/[\\w.-]+`)
];

/** Whether a text shows a key, id or slug. */
export const isRauw = (s: string) => RAUW.some((re) => re.test(s));

const naam = (v: unknown) => {
	const t = textOf(v);
	return t && !isRauw(t) ? t : null;
};

export type Bron = {
	collection: string;
	key?: string | null;
	display_name?: string | null;
	props?: Record<string, unknown> | null;
};

/**
 * The name of a bron for a reader. `wet` gives a law's name by its BWB id where the bron
 * itself lacks it (a version of a law, an article's version).
 */
export function menselijkeNaam(b: Bron, wet?: (bwb: string) => string | null | undefined): string {
	const p = b.props ?? {};
	const wetNaam = () => {
		const bwb = textOf(p.bwb_id);
		return (
			naam(p.instrument_citation_title) ??
			naam(p.citation_title) ??
			(bwb ? naam(wet?.(bwb)) : null) ??
			null
		);
	};
	const soort = isCollection(b.collection) ? BRON_LABEL[b.collection][0] : 'Bron';
	const dag = (v: unknown) => (textOf(v) ? langeDatum(textOf(v)) : null);

	switch (b.collection) {
		case 'instrument_versions': {
			// "Algemene wet bestuursrecht, versie van 1 mei 2022"; the one in force says so,
			// one that ended says until when (props=canvas, API 0.79.43: current, valid_until).
			const van = dag(p.valid_from);
			const tot = dag(p.valid_until);
			const w = wetNaam() ?? 'Wet';
			if (p.current === true)
				return van ? `${w}, geldende versie sinds ${van}` : `${w}, geldende versie`;
			if (!van) return `${w}, versie`;
			return tot ? `${w}, versie van ${van} tot ${tot}` : `${w}, versie van ${van}`;
		}
		case 'cases': {
			// A zaak of the Kamer by its title where the data gives one, else by its number
			// ("Zaak 2025Z15468", props=canvas, API 0.79.43).
			const eigen = naam(b.display_name) ?? naam(p.title) ?? naam(p.onderwerp);
			if (eigen) return eigen;
			const nummer = naam(p.number);
			return nummer ? `Zaak ${nummer}` : withDay(soort, p);
		}
		case 'article_versions': {
			const artikel =
				articleName(textOf(p.bwb_id), textOf(p.article_number), naam(p.label)) ?? 'Artikel';
			const w = wetNaam();
			const van = dag(p.valid_from);
			return [w ? `${artikel} ${w}` : artikel, van ? `versie van ${van}` : null]
				.filter(Boolean)
				.join(', ');
		}
		case 'commitments': {
			const eigen = naam(b.display_name) ?? naam(p.display_name);
			if (eigen) return eigen;
			const nummer = naam(p.number);
			return nummer ? `Toezegging ${nummer}` : withDay(soort, p);
		}
		case 'annexes': {
			// "Bijlage 2" with its title where the data gives them.
			const label = naam(p.label);
			// "Annex II" is the data's word for the bijlage, not a heading of its own (#30).
			const eigen = (t: string | null) => (t && !/^annex\b/i.test(t) ? t : null);
			const titel = naam(p.title) ?? eigen(naam(b.display_name));
			const kop = label ? `Bijlage ${label}` : 'Bijlage';
			return titel ? `${kop}: ${titel}` : kop;
		}
		case 'activities': {
			const eigen = naam(b.display_name) ?? naam(p.agenda_title) ?? naam(p.kind);
			const d = dag(p.date);
			return eigen ? (d ? `${eigen}, ${d}` : eigen) : withDay(soort, p);
		}
		case 'instruments': {
			return (
				naam(b.display_name) ??
				naam(p.citation_title) ??
				naam(p.short_title) ??
				naam(p.title) ??
				(textOf(p.bwb_id) ? naam(wet?.(textOf(p.bwb_id)!)) : null) ??
				withDay(soort, p, 'date_published')
			);
		}
	}
	return (
		naam(b.display_name) ??
		naam(p.display_name) ??
		naam(p.title) ??
		naam(p.name) ??
		naam(p.citation_title) ??
		naam(p.label) ??
		withDay(soort, p)
	);
}

/** The kind's name with its date where it has one: "Zaak, 2 april 2024". */
function withDay(soort: string, p: Record<string, unknown>, veld = 'date'): string {
	const d = textOf(p[veld]) ?? textOf(p.date) ?? textOf(p.valid_from);
	return d ? `${soort}, ${langeDatum(d)}` : soort;
}

/** The name of an object of the API (a DTO with its `key`), as `menselijkeNaam`. */
export const naamVan = (
	collection: string,
	o: { key?: string | null; display_name?: string | null } & object
): string =>
	menselijkeNaam({
		collection,
		key: o.key ?? null,
		display_name: o.display_name ?? null,
		props: o as Record<string, unknown>
	});

/**
 * A fractie by its abbreviation (UX #57): the one name for its chip, its seats and its
 * colour, as the votes name it (NSC, not "Nieuw Sociaal Contract"); its name where it has none.
 */
export const fractieNaam = (
	f: {
		key?: string | null;
		abbreviation?: string | null;
		name?: string | null;
		display_name?: string | null;
	} & object
): string => textOf(f.abbreviation) ?? textOf(f.name) ?? naamVan('factions', f);

/** The name of a bron known only by its id (`collection/key`) and perhaps a name. */
export function naamVanId(id: string, displayName?: string | null): string {
	const slash = id.indexOf('/');
	return menselijkeNaam({
		collection: slash > 0 ? id.slice(0, slash) : '',
		key: slash > 0 ? id.slice(slash + 1) : id,
		display_name: displayName ?? null
	});
}

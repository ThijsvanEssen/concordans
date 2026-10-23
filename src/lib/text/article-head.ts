// What the head of an article's reader says, from what the API gives: its title, the words of
// its status line, the toelichting it names and the wet its text came from. One source for
// the reader (ArticleReader) and for the first paint of its address ($lib/eerste-verf), so
// the two set the same words and the app takes the paint over without a line moving.
import { articleName } from '$lib/text/bw';
import { langeDatum } from '$lib/text/datum';
import { enactedLawId, enactedLawStatus } from '$lib/text/enacted-law';
import type { Validity } from '$lib/api/validity';

/** The article with its heading where the law gives one: "Artikel 22. Verwerking van
 *  persoonsgegevens". As its record names it (`heading`: with its law's abbreviation, Artikel
 *  6:162 BW); before the law's names are in, a BW article with its book (Artikel 6:162), one
 *  without a number by its label. */
export function headTitle(
	a: {
		bwb_id?: string | null;
		article_number?: string | null;
		label?: string | null;
		heading?: string | null;
		display_name?: string | null;
	},
	recorded?: string | null
): string {
	const name =
		recorded ?? articleName(a.bwb_id, a.article_number, a.label) ?? a.display_name ?? 'Artikel';
	return a.heading && a.article_number ? `${name}. ${a.heading}` : name;
}

/** The toelichting the head names. `artikel`: the API links the document to this article.
 *  `wijziging`: the memorie van toelichting of the wet that made the tekstversie on screen. */
export type Explanatory = {
	key: string;
	title: string | null;
	kind: string | null;
	at: string | null;
	basis: 'artikel' | 'wijziging';
	dossier: string | null;
	since: string | null;
	/** The memorie of the verklaringswet: the first reading of a change in the Grondwet. */
	firstReading: boolean;
};

// The title every verklaringswet (art. 137 lid 1 Gw) opens with.
const FIRST_READING = /^(wijziging van de wet houdende )?verklaring dat er grond bestaat/i;

type ExplanationItem = {
	target: string;
	scope: string;
	article_version_key?: string | null;
	section_anchor?: string | null;
	document: {
		key: string;
		title?: string | null;
		kind?: string | null;
		dossier_number?: string | null;
	};
};

/**
 * Of the explanations of an article (`explained-by`), the one the head names: the one that
 * explains the tekstversie on screen first, and of those the one that names a passage about
 * this article; else one of the article itself. An explanation of the instrument is no
 * evidence about this article. Null where none does.
 */
export function ownExplanation(
	explained: readonly ExplanationItem[],
	versionKeys: readonly string[],
	since: string | null
): Explanatory | null {
	// TODO(backend): the docs name an `instrument` target the enum of `target` lacks.
	const items = explained.filter((i) => i.target !== 'instrument');
	const onScreen = items.filter(
		(i) => i.article_version_key && versionKeys.includes(i.article_version_key)
	);
	const own =
		onScreen.find((i) => i.scope === 'article') ??
		onScreen[0] ??
		items.find((i) => i.target === 'article');
	if (!own) return null;
	// `dossier` scope: the memorie explains every change of its wet, not this article.
	const perDossier = own.scope === 'dossier';
	return {
		key: own.document.key,
		title: own.document.title ?? null,
		kind: own.document.kind ?? null,
		at: own.section_anchor ?? null,
		basis: perDossier ? 'wijziging' : 'artikel',
		dossier: own.document.dossier_number ?? null,
		since: perDossier ? since : null,
		firstReading: FIRST_READING.test(own.document.title ?? '')
	};
}

/** The memorie van toelichting of the dossier of the wet that made the text on screen. */
export const dossierExplanation = (
	mvt: { key: string; title?: string | null; kind?: string | null },
	dossier: string,
	since: string | null
): Explanatory => ({
	key: mvt.key,
	title: mvt.title ?? null,
	kind: mvt.kind ?? null,
	at: null,
	basis: 'wijziging',
	dossier,
	since,
	firstReading: FIRST_READING.test(mvt.title ?? '')
});

/** The words of the head's link to its toelichting. */
export const explanatoryLabel = (e: Explanatory): string =>
	(e.basis === 'wijziging' ? 'Memorie van toelichting' : (e.kind ?? 'Toelichting')) +
	(e.firstReading ? ', eerste lezing' : '');

/**
 * The words of the status line where no other line (Validity) says the stand: "Geldend
 * recht, tekst sinds 1 januari 1992", an earlier text, an article of a law not in force yet,
 * a repealed one; null for an act of the EU (its text as adopted, said by Coverage), "" for
 * nothing.
 */
export function versionLabelOf(o: {
	stubLabel: string | null;
	shown: { from: string | null; until: string | null } | null;
	showStatus: boolean;
	officialId: string | null | undefined;
	validity: Validity | null | undefined;
	repealed: boolean;
	lapseFrom: string | null | undefined;
	euAct: boolean;
	validFrom: string | null | undefined;
}): string | null {
	if (o.stubLabel) return o.stubLabel;
	if (o.shown) {
		const from = langeDatum(o.shown.from);
		const until = langeDatum(o.shown.until);
		return `Eerdere tekst, ${from || '?'}${until ? ` tot ${until}` : ''}`;
	}
	if (o.showStatus) return '';
	// An article of a law of the Staatsblad the BWB does not hold yet: enacted, not in force.
	const enacted = enactedLawId(o.officialId);
	if (enacted && o.validity === undefined) return enactedLawStatus(enacted);
	const from = langeDatum(o.validFrom);
	// A repealed article has no geldende tekst: its last version only records the repeal.
	if (o.repealed && o.validity === undefined) {
		const date = langeDatum(o.lapseFrom);
		return date ? `Vervallen per ${date}` : 'Vervallen';
	}
	// An act of the EU: the text as adopted; its consolidated versions are not fetched.
	if (o.euAct) return null;
	// Where the API does not know whether it holds, no "Geldend": only the day of the text.
	if (o.validity === null) return from ? `Tekst sinds ${from}` : '';
	return from ? `Geldend recht, tekst sinds ${from}` : 'Geldend recht';
}

/**
 * The day of the text where the stand of an article is a fact of its strip, as a law's is
 * (A190, UX-toets T9): it holds, or is not known not to, and the text on screen is its own.
 * '' where that day is not known; null where the stand is a sentence (versionLabelOf): a stub,
 * an earlier text, a status, an enacted law not in force, a repealed article, an act of the EU.
 */
export function plainSince(o: Parameters<typeof versionLabelOf>[0]): string | null {
	if (o.stubLabel || o.shown || o.showStatus || o.euAct) return null;
	if (enactedLawId(o.officialId) && o.validity === undefined) return null;
	if (o.repealed && o.validity === undefined) return null;
	return langeDatum(o.validFrom) || '';
}

/** How the wet named under the text relates to it. */
export function originVerbOf(
	onScreen: { index: number; first: { change?: string | null } } | null
): string {
	if (!onScreen) return '';
	if (onScreen.index > 0) return 'Gewijzigd bij';
	if (onScreen.first.change === 'establishes') return 'Vastgesteld bij';
	if (onScreen.first.change === 'introduces') return 'Ingevoerd bij';
	return 'Tekst uit';
}

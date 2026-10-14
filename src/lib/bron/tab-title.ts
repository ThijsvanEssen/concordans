// The name of a bron in the browser tab: short enough to tell tabs, bookmarks and history
// apart. A judgment by its label and the name it is known by, a dossier by its number and
// short title, a BW article by its book, anything else by its name cut at a word.
import { textOf, truncate } from '$lib/text/words';
import { shortDossierTitle, type BaseNode, type GraphNode } from '$lib/graph/types';
import { authorCite, judgmentCite } from '$lib/text/judgment-cite';
import { articleTitle } from '$lib/text/bw';
import { langeDatum } from '$lib/text/datum';
import { menselijkeNaam } from './menselijk';
import { dossierName, dossierUitProps } from './dossier-naam';

const MAX = 80;

/** A name cut at a word within `MAX` characters. */
export const cut = (name: string): string => truncate(name, MAX, { atWord: true });

export function tabTitle(
	node: Pick<GraphNode, 'collection' | 'label'> & { raw?: Pick<BaseNode, 'display_name' | 'props'> }
): string {
	const props = node.raw?.props ?? {};
	if (node.collection === 'judgments') {
		const names = Array.isArray(props.names)
			? props.names.filter((n) => typeof n === 'string')
			: [];
		const ecli = textOf(props.ecli);
		// A conclusion names its A-G, as the head of the reader does: Conclusie A-G Hartlief
		// 8 mei 2020. The signature that tells a P-G is in the detail only.
		const author = authorCite(textOf(props.advocate_general));
		const cite = ecli
			? judgmentCite(ecli, textOf(props.date), textOf(props.court), author).short
			: node.label;
		// A translation shares the date and the name of its original: the tab says which.
		const translation = textOf(props.translation_of) ? ', vertaling' : '';
		return `${names.length ? `${cite} (${names.join(', ')})` : cite}${translation}`;
	}
	if (node.collection === 'dossiers') {
		const number = textOf(props.label) ?? node.label;
		const naam = dossierName(dossierUitProps(props, number));
		return naam === number ? number : `${number} ${naam}`;
	}
	if (node.collection === 'decisions') {
		// A stemming as its heading reads: its Kamer and day, then its subject, not the
		// Kamer's case number ("Wetgeving 2025Z15911: …") or an ISO date ("2026-09-29").
		const subject = textOf(props.subject);
		if (subject) {
			const kamer = textOf(props.chamber) === 'EK' ? 'Eerste Kamer' : 'Tweede Kamer';
			const day = langeDatum(textOf(props.date));
			return cut(
				`${[kamer, day].filter(Boolean).join(', ')}: ${shortDossierTitle(subject) ?? subject}`
			);
		}
	}
	// A bijlage as the reader names it: "Bijlage II", not the data's "Annex II" (#30).
	if (node.collection === 'annexes')
		return cut(
			menselijkeNaam({ collection: 'annexes', display_name: node.raw?.display_name, props })
		);
	const name = textOf(node.raw?.display_name);
	if (node.collection === 'articles') {
		// An article names its law: "Artikel 8 EVRM", else the law's citation title, never
		// "Art. 419" alone (UX test 10 Oct, #23).
		const titel = articleTitle(name ?? node.label, props);
		const wet = textOf(props.instrument_citation_title);
		return cut(
			textOf(props.instrument_abbreviation) || !wet || titel.includes(wet) || / BW$/.test(titel)
				? titel
				: `${titel} ${wet}`
		);
	}
	return cut(name ?? node.label);
}

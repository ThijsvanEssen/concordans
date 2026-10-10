// The name of a bron in the browser tab: short enough to tell tabs, bookmarks and history
// apart. A judgment by its label and the name it is known by, a dossier by its number and
// short title, a BW article by its book, anything else by its name cut at a word.
import { shortDossierTitle, type GraphNode } from '$lib/graph/types';
import { authorCite, judgmentCite } from '$lib/text/judgment-cite';
import { articleTitle } from '$lib/text/bw';
import { langeDatum } from '$lib/text/datum';

const MAX = 80;

const text = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() ? value.trim() : null;

/** A name cut at a word within `MAX` characters. */
export function cut(name: string): string {
	if (name.length <= MAX) return name;
	const head = name.slice(0, MAX);
	return `${head.slice(0, head.lastIndexOf(' ') > 40 ? head.lastIndexOf(' ') : MAX).trimEnd()}…`;
}

export function tabTitle(node: Pick<GraphNode, 'collection' | 'label' | 'raw'>): string {
	const props = node.raw?.props ?? {};
	if (node.collection === 'judgments') {
		const names = Array.isArray(props.names)
			? props.names.filter((n) => typeof n === 'string')
			: [];
		const ecli = text(props.ecli);
		// A conclusion names its A-G, as the head of the reader does: Conclusie A-G Hartlief
		// 8 mei 2020. The signature that tells a P-G is in the detail only.
		const author = authorCite(text(props.advocate_general));
		const cite = ecli
			? judgmentCite(ecli, text(props.date), text(props.court), author).short
			: node.label;
		// A translation shares the date and the name of its original: the tab says which.
		const translation = text(props.translation_of) ? ', vertaling' : '';
		return `${names.length ? `${cite} (${names.join(', ')})` : cite}${translation}`;
	}
	if (node.collection === 'dossiers') {
		const number = text(props.label) ?? node.label;
		const short = text(props.short_title) ?? shortDossierTitle(text(props.title));
		return short ? `${number} ${short}` : number;
	}
	if (node.collection === 'decisions') {
		// A stemming as its heading reads: its Kamer and day, then its subject, not the
		// Kamer's case number ("Wetgeving 2025Z15911: …") or an ISO date ("2026-09-29").
		const subject = text(props.subject);
		if (subject) {
			const kamer = text(props.chamber) === 'EK' ? 'Eerste Kamer' : 'Tweede Kamer';
			const day = langeDatum(text(props.date));
			return cut(
				`${[kamer, day].filter(Boolean).join(', ')}: ${shortDossierTitle(subject) ?? subject}`
			);
		}
	}
	const name = text(node.raw?.display_name);
	if (node.collection === 'articles') {
		// An article names its law: "Artikel 8 EVRM", else the law's citation title, never
		// "Art. 419" alone (UX test 10 Oct, #23).
		const titel = articleTitle(name ?? node.label, props);
		const wet = text(props.instrument_citation_title);
		return cut(
			text(props.instrument_abbreviation) || !wet || titel.includes(wet) || / BW$/.test(titel)
				? titel
				: `${titel} ${wet}`
		);
	}
	return cut(name ?? node.label);
}

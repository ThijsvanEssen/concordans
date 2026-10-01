// The name of a bron in the browser tab: short enough to tell tabs, bookmarks and history
// apart. A judgment by its label and the name it is known by, a dossier by its number and
// short title, a BW article by its book, anything else by its name cut at a word.
import { shortDossierTitle, type GraphNode } from '$lib/graph/types';
import { authorCite, judgmentCite } from '$lib/text/judgment-cite';
import { withBook } from '$lib/text/bw';

const MAX = 80;

const text = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() ? value.trim() : null;

/** A name cut at a word within `MAX` characters. */
function cut(name: string): string {
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
		return names.length ? `${cite} (${names.join(', ')})` : cite;
	}
	if (node.collection === 'dossiers') {
		const number = text(props.label) ?? node.label;
		const short = text(props.short_title) ?? shortDossierTitle(text(props.title));
		return short ? `${number} ${short}` : number;
	}
	const name = text(node.raw?.display_name);
	return cut(name ? withBook(name) : node.label);
}

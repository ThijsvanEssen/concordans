// What one bron is, in a word, wherever a bron is named by its kind (the canvas's list of
// bronnen, the card over a bron): a regeling by its own kind, as its head names it (Wet,
// AMvB, Beleidsregel, Richtlijn), any other bron by its collection (Stuk, Stemming). A
// beleidsregel on the canvas read "Wet" (productcheck 0.80, punt 3).
import { lawKind } from '$lib/components/explore/law-head';
import { bronLabel, type Collection } from '$lib/vocabulary';

export function bronKind(
	collection: Collection,
	props: Record<string, unknown> | null | undefined
): string {
	if (collection !== 'instruments') return bronLabel(collection);
	const text = (v: unknown) => (typeof v === 'string' ? v : null);
	return lawKind({
		kind: text(props?.kind),
		jurisdiction: text(props?.jurisdiction),
		citation_title: text(props?.citation_title)
	});
}

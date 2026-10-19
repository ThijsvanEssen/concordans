// A reference in the whole law to an article of that same law jumps there in place
// (#artikel-3:5), as a division does, rather than leaving the reading for the article's page.
// The whole law sets the law it shows (setOwnLaw); a text in it reads it (ownLawOf).
import { getContext, setContext } from 'svelte';
import { artikelAnker } from './division';
import { enactedLawId } from './enacted-law';
import type { Span } from './segments';

const KEY = Symbol('own-law');

/** The anchor in the whole law `law` of an article target of it; null for another target. */
export function ownArticleAnchor(target: Span['target'], law: string | null): string | null {
	if (!law || target.collection !== 'articles' || !target.article_number) return null;
	const of = target.bwb_id ?? enactedLawId(target.official_id);
	return of?.toUpperCase() === law.toUpperCase() ? artikelAnker(target.article_number) : null;
}

/** The whole law on screen, for the texts in it: its id (BWBR0005537, STB-2026-56). */
export const setOwnLaw = (law: () => string) => setContext(KEY, law);

/** The law the text around shows whole (null outside the whole law), read when it is needed. */
export const ownLawOf = (): (() => string | null) =>
	getContext<(() => string) | undefined>(KEY) ?? (() => null);

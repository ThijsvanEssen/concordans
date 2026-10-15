// The lines under a row's title that say more than its bron: the period of a seat, the
// articles a judgment cites, what an activity was, what a lid was in a dossier.
import { count, joinAnd, lowerFirst } from '$lib/text/words';
import { vandaag } from '$lib/text/datum';
import { bookNumber } from '$lib/text/bw';
import { dossierLabel, kamerstukNummer, type DossierNaamBron } from '$lib/bron/dossier-naam';
import type { Row } from './rows';

/**
 * `2017–2021`, `sinds 2025`, `tot en met 2021`, with a role other than plain membership in
 * front. The end date is the last day of the period (the Kamer's TotEnMet).
 */
export function periodLabel(period: NonNullable<Row['period']>): string {
	const from = period.from?.slice(0, 4);
	const to = period.to?.slice(0, 4);
	const span =
		from && to
			? from === to
				? from
				: `${from}–${to}`
			: from
				? `sinds ${from}`
				: `tot en met ${to}`;
	if (!period.role || period.role === 'Lid') return span;
	return `${lowerFirst(period.role)}, ${span}`;
}

/**
 * `art. 4:12, 5:49 en 3 andere`: the articles of the law a judgment cites; a BW article with
 * its book, `art. 7:225` (`bwb` the law's id).
 */
export function citedLine(
	articles: readonly { article_number?: string | null }[],
	bwb?: string | null
): string | null {
	const numbers = articles.flatMap((a) =>
		a.article_number ? [bookNumber(bwb, a.article_number)] : []
	);
	if (!numbers.length) return null;
	const shown = numbers.slice(0, 2).join(', ');
	const rest = numbers.length - 2;
	return `art. ${shown}${rest > 0 ? ` en ${count(rest, 'ander', 'andere')}` : ''}`;
}

/**
 * `Commissiedebat, geannuleerd, over 22112 en 21501-04`: what an activity was, a status
 * other than the usual one, and the dossiers on its agenda. One still to come says so
 * (UX-toets 0.79.47, #59): `Commissiedebat, gepland` on 3 June 2027; a planned one whose
 * day has passed is left as the source has it, without the word.
 */
export function activityLine(
	a: {
		kind?: string | null;
		status?: string | null;
		date?: string | null;
		dossier_numbers?: readonly string[] | null;
		/** The dossiers by number and name (API 0.79.30), where the response has them. */
		dossiers?: readonly DossierNaamBron[] | null;
	},
	today: string = vandaag()
): string | null {
	const usual = new Set(['gepland', 'uitgevoerd', 'vrijgegeven']);
	const s = a.status?.toLowerCase() ?? null;
	const gepland = s === 'gepland' && !!a.date && a.date.slice(0, 10) >= today;
	const status = gepland ? 'gepland' : s && !usual.has(s) ? s : null;
	// A dossier by its number and name: "over 22112 Nieuwe Commissievoorstellen …".
	const numbers = a.dossiers?.length
		? a.dossiers.map((d) => dossierLabel(d))
		: (a.dossier_numbers ?? []).map((n) => kamerstukNummer(n));
	const over = numbers.length ? `over ${joinAnd(numbers)}` : null;
	return [a.kind, status, over].filter(Boolean).join(', ') || null;
}

/**
 * `eerste ondertekenaar, als minister van Financiën, 6 stukken`: what a lid or fractie
 * was in a dossier. The function only where it is not the plain seat of a Tweede Kamerlid:
 * an Eerste Kamerlid is named as such.
 */
export function rolesLine(d: {
	roles?: readonly string[] | null;
	functions?: readonly string[] | null;
	document_count?: number | null;
}): string | null {
	const roles = d.roles ?? [];
	const role = roles.some((r) => /^eerste/i.test(r))
		? 'eerste ondertekenaar'
		: roles.length
			? roles[0].toLowerCase()
			: null;
	const fn = (d.functions ?? []).find((f) => !/^tweede kamerlid$/i.test(f.trim()));
	const n = d.document_count ?? 0;
	return (
		[role, fn ? `als ${fn}` : null, n ? count(n, 'stuk', 'stukken') : null]
			.filter(Boolean)
			.join(', ') || null
	);
}

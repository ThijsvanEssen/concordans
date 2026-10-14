import { lowerFirst } from '$lib/text/words';
import { DAY_MS, vandaag } from '$lib/text/datum';
import type { Schema } from '$lib/api/types';

// Who held which post in a cabinet, laid out on the cabinet's term: per ministry its seats,
// per seat the holders one after the other, a stand-in among them. A position is a fraction
// of the term (0 at its start, 1 at its end), so the chart scales with its column.

export type CabinetDetail = Schema<'CabinetDetailDTO'>;
export type Seat = Schema<'CabinetSeatDTO'>;
export type SeatPost = Schema<'CabinetPostDTO'>;
export type Phase = Schema<'CabinetPhaseDTO'>;

const parse = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export type Term = { start: number; end: number; open: boolean };

/**
 * The cabinet's term. Without an end it runs to today only while a post is still held (the
 * cabinet in office); else it ends with its last post, and without posts it is not known:
 * an end the sources do not give is not made up.
 */
export function termOf(
	cabinet: Pick<CabinetDetail, 'from_date' | 'to_date' | 'ministries'>,
	today = vandaag()
): Term | null {
	if (!cabinet.from_date) return null;
	const start = parse(cabinet.from_date);
	let end: number | null = cabinet.to_date ? parse(cabinet.to_date) : null;
	let open = false;
	if (end === null) {
		const posts = (cabinet.ministries ?? []).flatMap((m) => m.seats.flatMap((s) => s.posts));
		open = posts.some((p) => !p.to_date);
		const ends = posts.flatMap((p) => (p.to_date ? [parse(p.to_date)] : []));
		end = open ? parse(today) : ends.length ? Math.max(...ends) : null;
	}
	return end !== null && end > start ? { start, end, open } : null;
}

/** Where a day lies in the term, from 0 to 1; a day outside it is held at the edge. */
export function at(term: Term, iso: string | null | undefined, fallback: 'start' | 'end'): number {
	const t = iso ? parse(iso) : fallback === 'start' ? term.start : term.end;
	return Math.min(1, Math.max(0, (t - term.start) / (term.end - term.start)));
}

export type Block = { post: SeatPost; from: number; to: number };

/**
 * A seat's holders in lanes: each takes the first lane free when it begins. Holders that
 * follow each other share one lane; two at the same time (a doubt the API names in
 * `overlaps_with`) get a lane each.
 */
export function lanesOf(seat: Seat, term: Term): Block[][] {
	const blocks = seat.posts
		.map((post) => ({
			post,
			from: at(term, post.from_date, 'start'),
			to: at(term, post.to_date, 'end')
		}))
		.sort((a, b) => a.from - b.from || a.to - b.to);
	const lanes: Block[][] = [];
	// A day's slack: one holder often ends on the day the next begins.
	const slack = DAY_MS / (term.end - term.start);
	for (const block of blocks) {
		const lane = lanes.find((l) => l[l.length - 1].to <= block.from + slack);
		if (lane) lane.push(block);
		else lanes.push([block]);
	}
	return lanes;
}

const PHASE_LABEL: Record<string, string> = {
	demissionair: 'Demissionair',
	dubbel_demissionair: 'Dubbel demissionair',
	missionair: 'Weer missionair'
};
const changes = (p: Phase) => !!p.kind && p.kind !== 'in_functie' && p.kind !== 'formatie';

/** A phase's name, as the axis of the posts and of the seats writes it. */
export const phaseLabel = (p: Phase) => PHASE_LABEL[p.kind ?? ''] ?? p.label ?? '';

/** The phases that change how a cabinet governs, from their first day: for the seats. */
export const phaseStarts = (phases: readonly Phase[]): { van: string; label: string }[] =>
	phases
		.filter((p) => changes(p) && p.from_date)
		.map((p) => ({ van: p.from_date!, label: phaseLabel(p) }));

/** The phases that change how a cabinet governs, within its term: demissionair and after. */
export function bandsOf(
	phases: readonly Phase[],
	term: Term
): { phase: Phase; from: number; to: number }[] {
	return phases
		.filter(changes)
		.map((phase) => ({
			phase,
			from: at(term, phase.from_date, 'start'),
			to: at(term, phase.to_date, 'end')
		}))
		.filter((b) => b.to > b.from);
}

/**
 * Why a post was held ad interim, in words for the reader: beside which other post, or in
 * the words of Rijksoverheid. A sentence, with its one full stop.
 */
export function actingReason(
	post: Pick<SeatPost, 'acting_reason' | 'acting_basis' | 'acting_other_seat'>
): string | null {
	if (post.acting_reason === 'held_other_seat') {
		const other = post.acting_other_seat?.function;
		return other
			? `Naast de post ${lowerFirst(other)}, tot de opvolger aantrad.`
			: 'Naast een andere post, tot de opvolger aantrad.';
	}
	if (post.acting_reason === 'source') {
		const text = post.acting_basis?.trim();
		if (!text || /^a\.i\.?$/i.test(text)) return 'Ad interim, volgens Rijksoverheid.';
		// One full stop at the end, whether the source gave one or not.
		return `Volgens Rijksoverheid: ${lowerFirst(text).replace(/\.?$/, '.')}`;
	}
	return null;
}

const MISSING: Record<NonNullable<SeatPost['ministry_missing']>, string> = {
	no_source: 'Geen officiële bron noemt het ministerie.',
	ambiguous: 'De bronnen noemen verschillende ministeries.'
};

/** What an opened post needs said: an older name, why acting, a missing ministry, a doubt. */
export function postNotes(
	p: Pick<
		SeatPost,
		| 'also_named'
		| 'acting'
		| 'acting_reason'
		| 'acting_basis'
		| 'acting_other_seat'
		| 'ministry_missing'
		| 'overlaps_with'
	>
): string[] {
	const reason = p.acting ? actingReason(p) : null;
	return [
		...(p.also_named?.length ? [`Ook genoemd: ${p.also_named.join(', ')}.`] : []),
		...(reason ? [reason] : []),
		...(p.ministry_missing ? [MISSING[p.ministry_missing]] : []),
		...(p.overlaps_with?.length
			? ['Volgens de bronnen tegelijk met een andere bekleder van deze post.']
			: [])
	];
}

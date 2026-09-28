import type { Schema } from '$lib/api/types';
import { POST_LABEL } from './government';

// Who held which post in a cabinet, laid out on the cabinet's term: per ministry its seats,
// per seat the holders one after the other, a stand-in among them. A position is a fraction
// of the term (0 at its start, 1 at its end), so the chart scales with its column.

export type CabinetDetail = Schema<'CabinetDetailDTO'>;
export type Seat = Schema<'CabinetSeatDTO'>;
export type SeatPost = Schema<'CabinetPostDTO'>;
export type Phase = Schema<'CabinetPhaseDTO'>;

const DAY = 86_400_000;
const parse = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export type Term = { start: number; end: number; open: boolean };

/** The cabinet's term; one in office runs to today. Null when its start is not known. */
export function termOf(
	cabinet: Pick<CabinetDetail, 'from_date' | 'to_date'>,
	today = new Date().toISOString().slice(0, 10)
): Term | null {
	if (!cabinet.from_date) return null;
	const start = parse(cabinet.from_date);
	const end = parse(cabinet.to_date ?? today);
	return end > start ? { start, end, open: !cabinet.to_date } : null;
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
	const slack = DAY / (term.end - term.start);
	for (const block of blocks) {
		const lane = lanes.find((l) => l[l.length - 1].to <= block.from + slack);
		if (lane) lane.push(block);
		else lanes.push([block]);
	}
	return lanes;
}

/** What a seat is called: its post, with the portfolio where the post has one. */
export function seatLabel(seat: Seat): string {
	const post = seat.post ? POST_LABEL[seat.post] : (seat.function ?? 'Post');
	if (seat.post === 'minister_zonder_portefeuille' && seat.portfolio)
		return `Minister voor ${seat.portfolio}`;
	return seat.portfolio ? `${post}, ${seat.portfolio}` : post;
}

/** The phases that change how a cabinet governs, within its term: demissionair and after. */
export function bandsOf(
	phases: readonly Phase[],
	term: Term
): { phase: Phase; from: number; to: number }[] {
	return phases
		.filter((p) => p.kind && p.kind !== 'in_functie' && p.kind !== 'formatie')
		.map((phase) => ({
			phase,
			from: at(term, phase.from_date, 'start'),
			to: at(term, phase.to_date, 'end')
		}))
		.filter((b) => b.to > b.from);
}

/** Lines on the axis: every quarter in a short term, every year or more in a long one. */
export function ticksOf(term: Term): { at: number; label: string }[] {
	const years = (term.end - term.start) / (365.25 * DAY);
	const months = years <= 3 ? 3 : years <= 8 ? 12 : 24;
	const MONTH = ['jan', 'apr', 'jul', 'okt'];
	const ticks: { at: number; label: string }[] = [];
	const d = new Date(term.start);
	let y = d.getUTCFullYear();
	let m = Math.ceil(d.getUTCMonth() / months) * months;
	for (;;) {
		y += Math.floor(m / 12);
		m %= 12;
		const t = Date.UTC(y, m, 1);
		if (t > term.end) break;
		if (t >= term.start)
			ticks.push({
				at: (t - term.start) / (term.end - term.start),
				label: months === 3 && m !== 0 ? `${MONTH[m / 3]} ${y}` : String(y)
			});
		m += months;
	}
	return ticks;
}

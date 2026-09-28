import { api, unwrap } from '$lib/api/client';
import type { Schema } from '$lib/api/types';

// The words for the government's side of the index: the posts in a cabinet, the state of a
// commitment, and the cabinets and ministries, each asked for once per page load.

export type Cabinet = Schema<'CabinetSummaryDTO'>;
export type Ministry = Schema<'MinistryDTO'>;
export type Post = NonNullable<Schema<'CabinetPostDTO'>['post']>;
export type CommitmentStatus = NonNullable<Schema<'CommitmentDTO'>['status']>;

export const POST_LABEL: Record<Post, string> = {
	'minister-president': 'Minister-president',
	'viceminister-president': 'Viceminister-president',
	minister: 'Minister',
	minister_zonder_portefeuille: 'Minister zonder portefeuille',
	staatssecretaris: 'Staatssecretaris'
};
export const POSTS = Object.keys(POST_LABEL) as Post[];

export const COMMITMENT_STATUS_LABEL: Record<CommitmentStatus, string> = {
	open: 'Open',
	done: 'Voldaan',
	partly_done: 'Deels voldaan',
	unfulfilled: 'Niet voldaan',
	lapsed: 'Vervallen'
};
export const COMMITMENT_STATUSES = Object.keys(COMMITMENT_STATUS_LABEL) as CommitmentStatus[];

function once<T>(load: () => Promise<T>): () => Promise<T> {
	let request: Promise<T> | null = null;
	return () =>
		(request ??= load().catch((err) => {
			request = null;
			throw err;
		}));
}

/** Every cabinet, newest first. */
export const getCabinets = once(() => unwrap(api.GET('/api/cabinets')));

/** Every ministry, in protocol order, the ones under an earlier name included. */
export const getMinistries = once(() => unwrap(api.GET('/api/ministries')));

/** The colours of the parties the API knows, by short name. */
export const getPartyColors = once(() =>
	unwrap(api.GET('/api/parties/colors')).then((r) => r.colors as Record<string, string>)
);

/**
 * The cabinet in office: the newest one without an end. An older cabinet without an end
 * has one the sources do not give (most before 1945), and is not in office.
 */
export const currentCabinet = (cabinets: readonly Cabinet[]): Cabinet | undefined =>
	[...cabinets].sort((a, b) => (b.from_date ?? '').localeCompare(a.from_date ?? ''))[0];

/** Whether this is the cabinet in office. */
export const inOffice = (cabinet: Cabinet, cabinets: readonly Cabinet[]): boolean =>
	!cabinet.to_date && currentCabinet(cabinets)?.key === cabinet.key;

/** `2024–2026`, `sinds 2026` while in office, and `1913–?` when the end is not known. */
export function period(
	from: string | null | undefined,
	to: string | null | undefined,
	open = true
): string {
	const y = (iso: string | null | undefined) => iso?.slice(0, 4) ?? '?';
	if (!to) return open ? `sinds ${y(from)}` : `${y(from)}–?`;
	return y(from) === y(to) ? y(from) : `${y(from)}–${y(to)}`;
}

/**
 * The posts of a person other than their longest. The API counts dossiers, bills and open
 * commitments per person over the whole cabinet, so they belong with one post, not with
 * each: a minister ad interim for ten days would otherwise seem to have signed them all.
 */
export function laterPosts<
	T extends { member: { key: string }; from_date?: string | null; to_date?: string | null }
>(rows: readonly T[], today = new Date().toISOString().slice(0, 10)): Set<T> {
	const days = (r: T) =>
		(Date.parse(r.to_date ?? today) - Date.parse(r.from_date ?? r.to_date ?? today)) / 86_400_000;
	const longest = new Map<string, T>();
	for (const row of rows) {
		const best = longest.get(row.member.key);
		if (!best || days(row) > days(best)) longest.set(row.member.key, row);
	}
	return new Set(rows.filter((r) => longest.get(r.member.key) !== r));
}

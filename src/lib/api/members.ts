// What the API gives of members beyond their record (records.ts): their votes and the list.
import { api, slowApi, unwrap } from './client';
import { once } from './records';
import type { QueryOf } from './types';

/** The votes of a member's reader; one request serves every mount of the same key. */
// A person's votes take the API seconds (8.8 to 10 s on prod, 9 Oct): they wait as long as the
// API does, not the 10 s of `api`, which cut them off.
export const getMemberVotes = (key: string) =>
	once(`votes/${key}`, () =>
		unwrap(
			slowApi.GET('/api/members/{key}/votes', { params: { path: { key }, query: { limit: 50 } } })
		)
	);

/**
 * The votes a member cast while holding a post of the government (`in_office=true`, API
 * 0.79.44, #534), a page of 200 from `offset`; `next_offset` null after the last. No total:
 * the API does not count them (UX-toets 0.79.43, #29).
 */
export const getMemberVotesInOffice = (key: string, offset = 0) =>
	once(`votes/${key}/in-office/${offset}`, () =>
		unwrap(
			slowApi.GET('/api/members/{key}/votes', {
				params: { path: { key }, query: { limit: 200, offset, in_office: true } }
			})
		)
	);

/** A slice of the members under `query`. */
export const getMembers = (query: QueryOf<'/api/members'>, signal?: AbortSignal) =>
	unwrap(api.GET('/api/members', { params: { query }, signal }));

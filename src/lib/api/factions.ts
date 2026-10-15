import { api, unwrap } from './client';
import type { QueryOf } from './types';

/** The fracties; under `query` where one is given. */
export const getFactions = (query?: QueryOf<'/api/factions'>, signal?: AbortSignal) =>
	unwrap(api.GET('/api/factions', { params: { query }, signal }));

export const getFaction = (key: string, signal?: AbortSignal) =>
	unwrap(api.GET('/api/factions/{key}', { params: { path: { key } }, signal }));

/** How an Eerste Kamer fractie voted on the bills (API 0.68). */
export const getFactionVotes = (key: string, signal?: AbortSignal) =>
	unwrap(api.GET('/api/factions/{key}/votes', { params: { path: { key } }, signal }));

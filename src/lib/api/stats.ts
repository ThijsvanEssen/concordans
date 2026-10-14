import { api, unwrap } from './client';
import type { Schema } from './types';
import { onForget } from '$lib/util/forget';

export type Stats = Schema<'StatsResponse'>;

// The dataset changes by the day at most: one request per page load is enough.
let request: Promise<Stats> | null = null;

/** The number of bronnen per collection and of verbindingen per relation. */
export function getStats(): Promise<Stats> {
	request ??= unwrap(api.GET('/api/stats')).catch((err) => {
		request = null;
		throw err;
	});
	return request;
}

export type Coverage = Schema<'JudgmentCoverageResponse'>;

let coverageRequest: Promise<Coverage> | null = null;

/** The judgments whose text is loaded, per court tier and per court, with their dates. */
export function getCoverage(): Promise<Coverage> {
	coverageRequest ??= unwrap(api.GET('/api/stats/coverage')).catch((err) => {
		coverageRequest = null;
		throw err;
	});
	return coverageRequest;
}

onForget(() => {
	request = null;
	coverageRequest = null;
});

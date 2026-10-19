// What is new in a bundel since the visit before, asked after the first paint and filled in
// as the answers come: per law and per dossier one page of the feed, per article its newest
// citing judgment (fresh.ts), two at a time (the API's limit per address).
import { SvelteMap } from 'svelte/reactivity';
import { getFeed } from '$lib/api/feed';
import { getCitedBy } from '$lib/api/verbonden';
import { isAborted, report } from '$lib/api/errors';
import { addDays } from '$lib/text/datum';
import { twoAtATime } from '$lib/util/two-at-a-time';
import {
	freshAsks,
	freshLines,
	newestCiting,
	type Citing,
	type FeedLine,
	type FreshAsk
} from './fresh';
import type { MapItem } from './map';

/** Lines of a law's or a dossier's feed, at most: what a bundel shows as new. */
const LINES = 50;

export class Fresh {
	/** The day of the visit before: what is new came after it. */
	readonly since: string;
	/** The new lines of each law and dossier, by the group's key. */
	readonly feeds = new SvelteMap<string, FeedLine[]>();
	/** The newest judgment citing each article, where it is new, by the article's id. */
	readonly citing = new SvelteMap<string, Citing>();

	constructor(since: string) {
		this.since = since;
	}

	/** What came in for a group: a law's or a dossier's new lines. */
	group = (key: string): FeedLine[] => this.feeds.get(key) ?? [];
	/** What is new for an item: the lines that concern it, and a judgment citing it. */
	linesOf = (item: MapItem): FeedLine[] => freshLines(item, this.group(item.groupKey));
	citingOf = (item: MapItem): Citing | null => this.citing.get(item.id) ?? null;
	isNew = (item: MapItem): boolean => this.linesOf(item).length > 0 || !!this.citingOf(item);
	/** Whether anything in the bundel is new. */
	get any(): boolean {
		return [...this.feeds.values()].some((f) => f.length > 0) || this.citing.size > 0;
	}

	/** Asks for the items' laws, dossiers and articles; ends with the signal. */
	async load(items: readonly MapItem[], signal: AbortSignal): Promise<void> {
		await twoAtATime(freshAsks(items), async (ask) => {
			if (signal.aborted) return;
			try {
				await this.#ask(ask, signal);
			} catch (e) {
				// A question that fails leaves its group or row unmarked; the rest still comes.
				if (!isAborted(e)) report('Nieuw sinds', e);
			}
		});
	}

	async #ask(ask: FreshAsk, signal: AbortSignal) {
		if (ask.kind === 'article') {
			const page = await getCitedBy(ask.bwb, ask.number, { limit: 1, sort: 'date_desc' });
			const newest = newestCiting(page, this.since);
			if (newest && !signal.aborted) this.citing.set(ask.key, newest);
			return;
		}
		const r = await getFeed(
			{
				...(ask.kind === 'law' ? { instrument: ask.bwb } : { dossier: ask.dossier }),
				since: addDays(this.since, 1),
				facets: false,
				limit: LINES
			},
			{ signal }
		);
		const lines = r.items.filter((i) => i.date > this.since);
		if (!signal.aborted) this.feeds.set(ask.key, lines);
	}
}

// The first pages the explorer asks, by their size: first-pages.json, which the API's
// warm-up reads from its copy (lawgraph src/lawgraph/data/first-pages.json), so that what is
// warm is what is asked first. A page of another size is never read from what was warmed.
import pages from './first-pages.json';

const [newest, , top] = pages.article_citations;

/** Verbonden's page of the judgments citing an article, newest or most cited first. */
export const CITED_BY_PAGE = newest.limit;
/** The most cited judgments on an article, for the homepage's law network. */
export const CITED_BY_TOP = top.limit;
/** The judgments citing a law, its first page. */
export const LAW_JUDGMENTS = pages.law_judgments;
/** The largest laws by their number of articles, whose names are asked once per visit. */
export const INSTRUMENT_NAMES = pages.instrument_names.limit;
/** The rows a list of Bladeren asks at a time. */
export const LIST_PAGE = pages.lists.instruments;
/** The events Actueel asks at a time. */
export const FEED_PAGE = pages.lists.feed;
/** The homepage's summary: its days up to today, and the events it gives one by one. */
export const HOME_SUMMARY = pages.home_summary;

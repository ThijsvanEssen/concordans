// The width of the date column is a page's, not a timeline's: a page that has several
// (Kamerlid: Loopbaan, Commissies, Toezeggingen) sets it once and each Tijdlijn under it takes
// it, so their left edges are one. `narrow` (64px) elsewhere, `term` the reader's term column.
import { getContext, setContext } from 'svelte';

type DateColumn = 'narrow' | 'term';
const KEY = Symbol('date-column');

export const setDateColumn = (column: DateColumn) => setContext(KEY, column);
export const dateColumn = (): DateColumn => getContext<DateColumn | undefined>(KEY) ?? 'narrow';

// The numbers in the text of an article (`/amounts`): the amounts, percentages, time limits and
// dates the law prints, each with its value in the versions around the one read. The text marks
// them; a card says what the number was before, a block under the text its course. Nothing is
// calculated here and nothing is worked out of the text: what the API leaves out stays text.
import type { Schema } from '$lib/api/types';
import { anchorLabel } from './anchor';
import { dagVan, langeDatum, MONTHS } from './datum';
import { formatDecimal } from './getal';
import { spansWithin } from './spans';

export type Getal = Schema<'AmountDTO'>;
export type Stap = Schema<'AmountStepDTO'>;

/** A number inside a part's text: offsets relative to that text. */
export type GetalSpan = Getal & { start: number; end: number };

const NBSP = ' ';
const kaal = (s: string) => s.replace(/[\s ]+/g, '');

/**
 * The numbers whose words the text still holds at their offsets: a number the text no longer
 * has there (another version than the one read) is not marked, never marked wrongly.
 */
export function getallenIn(text: string, getallen: readonly Getal[] | null | undefined): Getal[] {
	return (getallen ?? []).filter(
		(g) => g.start >= 0 && g.end > g.start && kaal(text.slice(g.start, g.end)) === kaal(g.text)
	);
}

/** The numbers inside text[from, from + length), with offsets relative to `from`. */
export const getallenWithin = (
	getallen: readonly Getal[],
	from: number,
	length: number
): GetalSpan[] => spansWithin(getallen, from, length);

const EENHEID: Record<string, [string, string]> = {
	dag: ['dag', 'dagen'],
	werkdag: ['werkdag', 'werkdagen'],
	week: ['week', 'weken'],
	maand: ['maand', 'maanden'],
	jaar: ['jaar', 'jaren'],
	uur: ['uur', 'uur']
};

/** A day of every year (`--07-01`) or one date (`2026-07-01`) as words. */
function datumTekst(date: string): string {
	const jaarloos = /^--(\d{2})-(\d{2})$/.exec(date);
	if (jaarloos) return `${Number(jaarloos[2])}${NBSP}${MONTHS[Number(jaarloos[1]) - 1] ?? ''}`;
	return dagVan(date) ? langeDatum(date) : '';
}

/** What a step holds, as the law writes it: `€ 3.115`, `12,5%`, `6 weken`, `1 juli`. Null for a
 *  step without a value. */
export function stapTekst(unit: string, stap: Pick<Stap, 'value' | 'date'>): string | null {
	if (unit === 'datum') return stap.date ? datumTekst(stap.date) || null : null;
	const n = stap.value;
	if (n === null || n === undefined) return null;
	if (unit === 'EUR')
		return `€${NBSP}${n.toLocaleString('nl-NL', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
	if (unit === '%') return `${formatDecimal(n, 2)}%`;
	const woord = EENHEID[unit];
	return woord ? `${formatDecimal(n, 2)}${NBSP}${woord[n === 1 ? 0 : 1]}` : null;
}

/** The step before the one read: the number in the previous toestand; null at the first. */
export function vorigeStap(getal: Pick<Getal, 'history'>): Stap | null {
	const i = getal.history.findIndex((s) => s.selected);
	return i > 0 ? getal.history[i - 1] : null;
}

/** The kind of number, as the card heads it. */
export const SOORT: Record<string, string> = {
	bedrag: 'Bedrag',
	percentage: 'Percentage',
	termijn: 'Termijn',
	datum: 'Datum'
};

/** The day a step holds from, `vanaf 1 januari 2025`; empty where the API names none. */
export const vanaf = (stap: Pick<Stap, 'valid_from'>): string =>
	stap.valid_from ? `vanaf ${langeDatum(stap.valid_from)}` : '';

/** A step of the course in the block. */
export type Verloop = { tekst: string; vanaf: string; gekozen: boolean };

export type GetalRij = {
	/** Where the number stands, `lid 2, onder a`; null in an article without parts. */
	plaats: string | null;
	/** As the text prints it. */
	tekst: string;
	soort: string;
	verloop: Verloop[];
};

/** The block's rows, in the order of the text: each number with its steps, oldest first. */
export function getalRijen(getallen: readonly Getal[]): GetalRij[] {
	return getallen.map((g) => ({
		plaats: g.part ? anchorLabel(g.part) : null,
		tekst: g.text,
		soort: SOORT[g.kind] ?? '',
		verloop: g.history.flatMap((s) => {
			const tekst = stapTekst(g.unit, s);
			return tekst ? [{ tekst, vanaf: vanaf(s), gekozen: s.selected }] : [];
		})
	}));
}

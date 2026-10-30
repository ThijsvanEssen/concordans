// What a line typed in ⌘K asks to do, read against the words of the register (COMMANDS): the
// command, and what follows its word. A line that starts with no word of the list is a search,
// and stays one. `>` before it asks for the commands alone.
import { COMMANDS, type Command } from './register';
import { FILTER_GROUPS, FILTER_GROUP_LABEL, type FilterGroup } from '$lib/verbonden/filter';
import { sortOne } from '$lib/bron/rubrieken';
import { LINE_KINDS, LINE_KIND_LABEL, type LineKind } from '$lib/graph/line-kind';

/** A soort of Tonen or a relatie of Relatie, by the word of its label. */
export type Soort =
	| { kind: 'soort'; id: FilterGroup; label: string }
	| { kind: 'relatie'; id: LineKind; label: string };

export type Parsed = {
	command: Command;
	/** What follows the word, as typed: the bron to search for. */
	rest: string;
	/** `>` before the line: commands only, no search. */
	only: boolean;
	/** The number of steps: `s2`, `stappen 2`. */
	steps?: number;
	/** The soort or relatie named: `+uitspraken`, `alleen wetten`. */
	soort?: Soort;
};

/** A prefix calls a word from this many letters on; shorter, only a short form does. */
const PREFIX_MIN = 3;

const norm = (s: string) => s.trim().toLowerCase();
const firstWord = (s: string) => norm(s).split(/\s+/)[0];

/** The words of Tonen and Relatie: the first word of a label, and a soort's one ("wet"). */
const SOORT_WORDS: readonly { word: string; soort: Soort }[] = [
	...FILTER_GROUPS.flatMap((id) => {
		const soort: Soort = { kind: 'soort', id, label: FILTER_GROUP_LABEL[id] };
		const words = new Set([firstWord(FILTER_GROUP_LABEL[id]), firstWord(sortOne(id))]);
		return [...words].map((word) => ({ word, soort }));
	}),
	...LINE_KINDS.map((id) => ({
		word: firstWord(LINE_KIND_LABEL[id]),
		soort: { kind: 'relatie', id, label: LINE_KIND_LABEL[id] } as Soort
	}))
];

/** The soort a word names: by its word, or a prefix of three letters that names one alone. */
export function soortOf(text: string): Soort | null {
	const word = firstWord(text);
	if (!word) return null;
	const exact = SOORT_WORDS.find((s) => s.word === word);
	if (exact || word.length < PREFIX_MIN) return exact?.soort ?? null;
	const ids = new Set(SOORT_WORDS.filter((s) => s.word.startsWith(word)).map((s) => s.soort.id));
	return ids.size === 1 ? SOORT_WORDS.find((s) => ids.has(s.soort.id))!.soort : null;
}

/** The commands a word calls: by its full word, a short form, or a prefix of three letters. */
function byWord(word: string): Command[] {
	const exact = COMMANDS.filter((c) => c.words.includes(word) || c.short?.includes(word));
	if (exact.length || word.length < PREFIX_MIN) return exact;
	return COMMANDS.filter((c) => c.words.some((w) => w.startsWith(word)));
}

/** `+uitspraken`, `- wwke`: a soort where one is named, else a bron. */
function bySign(sign: '+' | '-', rest: string, only: boolean): Parsed | null {
	const soort = soortOf(rest);
	const command = COMMANDS.find((c) => c.sign === sign && (c.arg === 'soort') === !!soort);
	return command ? { command, rest, only, ...(soort ? { soort } : {}) } : null;
}

/** The command of `line`, or null where it is a search. */
export function parseCommand(line: string): Parsed | null {
	let text = line.trimStart();
	const only = text.startsWith('>');
	if (only) text = text.slice(1).trimStart();
	if (text[0] === '+' || text[0] === '-') return bySign(text[0], text.slice(1).trim(), only);
	const [first = '', ...more] = text.split(/\s+/);
	const hits = byWord(norm(first));
	// A prefix two words share ("ver…") calls neither: the search answers.
	if (hits.length !== 1) return null;
	return withObject(hits[0], first, more.join(' ').trim(), only);
}

/** The steps or the soort after the word; null where they are words of a search after all. */
function withObject(command: Command, first: string, rest: string, only: boolean): Parsed | null {
	const parsed: Parsed = { command, rest, only };
	if (command.arg === 'stappen') {
		// `s2` carries its number, `stappen 2` has it after the word.
		const n = Number(/\d$/.exec(first)?.[0] ?? rest);
		if (rest || /\d$/.test(first)) parsed.steps = Number.isInteger(n) ? n : NaN;
	}
	const soort = command.arg === 'soort' ? soortOf(rest) : null;
	if (soort) parsed.soort = soort;
	// "met spoed", "stappen naar": words of a search after all.
	if (rest && !soort && command.arg === 'soort') return null;
	if (rest && Number.isNaN(parsed.steps)) return null;
	return parsed;
}

/** What the search looks for beside the command: its bron, else the line itself. */
export function searchTextOf(line: string, parsed: Parsed | null): string {
	if (!parsed) return line;
	if (parsed.only) return '';
	const { arg } = parsed.command;
	if (arg === 'bron') return parsed.rest || (parsed.command.sign ? '' : line);
	if (arg === 'gekozen') return '';
	// A word that waits for its object ("zon…", "stappen") is still a search.
	return arg && (parsed.soort || parsed.steps !== undefined) ? '' : line;
}

// What a line typed in ⌘K asks to do, read against the words of the register (COMMANDS): the
// command, and what follows its word. A line that starts with no word of the list is a search,
// and stays one. `>` before it asks for the commands alone.
import { COMMANDS, type Command } from './register';

export type Parsed = {
	command: Command;
	/** What follows the word, as typed: the bron to search for. */
	rest: string;
	/** `>` before the line: commands only, no search. */
	only: boolean;
};

/** A prefix calls a word from this many letters on; shorter, only a short form does. */
const PREFIX_MIN = 3;

const norm = (s: string) => s.trim().toLowerCase();

/** The commands a word calls: by its full word, a short form, or a prefix of three letters. */
function byWord(word: string): Command[] {
	const exact = COMMANDS.filter((c) => c.words.includes(word) || c.short?.includes(word));
	if (exact.length || word.length < PREFIX_MIN) return exact;
	return COMMANDS.filter((c) => c.words.some((w) => w.startsWith(word)));
}

/** The command of `line`, or null where it is a search. */
export function parseCommand(line: string): Parsed | null {
	let text = line.trimStart();
	const only = text.startsWith('>');
	if (only) text = text.slice(1).trimStart();
	const [first = '', ...more] = text.split(/\s+/);
	const hits = byWord(norm(first));
	// A prefix two words share ("ver…") calls neither: the search answers.
	if (hits.length !== 1) return null;
	return { command: hits[0], rest: more.join(' ').trim(), only };
}

/** What the search looks for beside the command: its bron, else the line itself. */
export function searchTextOf(line: string, parsed: Parsed | null): string {
	if (!parsed) return line;
	if (parsed.only) return '';
	return parsed.command.arg === 'bron' && parsed.rest ? parsed.rest : line;
}

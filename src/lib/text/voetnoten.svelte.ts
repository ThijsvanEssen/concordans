// Which footnote is open in a text, shared by its markers (CitedText) and its notes
// (Voetnoten): a tap on a marker opens the note in place, a second closes it. A reader, an
// overweging read in place and a Kamerstuk each set their own (zetNootStand).
import { getContext, setContext } from 'svelte';
import type { Bereik } from './voetnoten';

const KEY = Symbol('voetnoten');

class NootStand {
	/** The anchor of the open note: `fn-35`. */
	open = $state<string | null>(null);
	/** The bron whose citations are marked in the open note: the article a row is read for. */
	doel = $state<string | null>(null);
	/** The words marked in the open note, where a verbinding names them by their offsets. */
	bereik = $state<Bereik | null>(null);

	wissel(id: string) {
		this.open = this.open === id ? null : id;
		this.doel = null;
		this.bereik = null;
	}

	/** Opens a note with the words of a verbinding marked (a row, a card, a link). */
	toon(id: string | null, mark: { doel?: string | null; bereik?: Bereik | null } = {}) {
		this.open = id;
		this.doel = mark.doel ?? null;
		this.bereik = mark.bereik ?? null;
	}
}

export function zetNootStand(stand = new NootStand()): NootStand {
	return setContext(KEY, stand);
}

/** The state of the text around, or null where a text has no notes. */
export const nootStand = (): NootStand | null => getContext<NootStand | undefined>(KEY) ?? null;

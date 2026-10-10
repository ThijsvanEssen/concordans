// The actions of a reader's head, per kind (ReaderHead): Bewaar on every reader; Citeer where
// a bron of the kind is cited in legal writing. One table, so equal pages act alike (Thijs,
// 10 Oct: "gelijke experience op gelijke pagina's").
import type { CiteItem } from '$lib/components/ui/cite';
import type { MapItem } from '$lib/map/map';
import type { Collection } from '$lib/vocabulary';

/** What a reader gives its head's actions: data, not their layout. */
export type Acties = {
	/** What Bewaar keeps. */
	bewaar: MapItem | null;
	/** The place it names: `lid 3`, `r.o. 5.7.1`. */
	wat?: string;
	/** The forms of Citeer. */
	cite?: CiteItem[];
	/** What is cited, for the menu's label. */
	naam?: string;
	/** The official text, last in Citeer. */
	bron?: { label: string; href: string } | null;
	/** The text Kopieer tekst copies, asked when chosen. */
	tekst?: () => string;
};

/** Per kind: is it cited (Citeer)? Bewaar is on every reader and needs no entry. */
export const KOP_ACTIES: Partial<Record<Collection, { citeer: boolean }>> = {
	articles: { citeer: true },
	instruments: { citeer: true },
	judgments: { citeer: true },
	documents: { citeer: true },
	annexes: { citeer: true },
	// A stemming is cited through what was voted on; a dossier by its Kamerstukken.
	decisions: { citeer: false },
	dossiers: { citeer: false },
	members: { citeer: false },
	factions: { citeer: false },
	committees: { citeer: false },
	cabinets: { citeer: false },
	commitments: { citeer: false },
	activities: { citeer: false }
};

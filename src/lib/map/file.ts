// A bundel as a file: the reader's own copy, beside this browser's (localStorage is gone when
// the site's data is cleared). JSON with its kind and version, one bundel or all, each in the
// form of a link (share.ts); read back as a bundel of its own, added to one, or in place of
// one, as the reader chooses.
import type { Map, SharedMap } from './map';
import { BROKEN, payloadOf, readPayload } from './share';
import { safeFileName } from '$lib/util/save-file';
import { textOf } from '$lib/text/words';

/** The version of the file's form; a file of a later one is not read. */
export const FILE_VERSION = 1;

/** A file of a later version than this page reads. */
export const NEWER = 'newer';

/** What a file of bundels says it is, and where it holds them. */
const KIND = 'bundels';
const MAPS = 'bundels';
const VERSION = 'versie';

/** A bundel from a file: as a link gives one, with the id it had where it was kept. */
export type FileMap = SharedMap & { id: string | null };

/** The text of a file with these bundels, readable as it is. */
export const mapFile = (maps: readonly Map[]): string =>
	`${JSON.stringify(
		{
			concordans: KIND,
			[VERSION]: FILE_VERSION,
			[MAPS]: maps.map((m) => ({ id: m.id, ...payloadOf(m) }))
		},
		null,
		'\t'
	)}\n`;

/** The file's name: its bundel's, or Bundels where it holds more. */
export const mapFileName = (maps: readonly Pick<Map, 'naam'>[]) =>
	`${(maps.length === 1 && safeFileName(maps[0].naam)) || 'Bundels'}.json`;

/**
 * The bundels of a file; BROKEN where it is no file of bundels, NEWER where a later version
 * of Concordans wrote it. An item in a broken form is left out, and counted.
 */
export function readMapFile(content: string): FileMap[] | typeof BROKEN | typeof NEWER {
	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(content);
	} catch {
		return BROKEN;
	}
	if (!parsed || typeof parsed !== 'object' || parsed.concordans !== KIND) return BROKEN;
	const version = parsed[VERSION];
	if (typeof version !== 'number') return BROKEN;
	if (version > FILE_VERSION) return NEWER;
	const maps = parsed[MAPS];
	if (!Array.isArray(maps)) return BROKEN;
	return maps.flatMap((raw): FileMap[] => {
		const read = readPayload(raw);
		return read ? [{ id: textOf((raw as { id?: unknown }).id), ...read }] : [];
	});
}

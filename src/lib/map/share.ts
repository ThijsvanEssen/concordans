// The link of a map: the map in the fragment (/bundels#m=…), as JSON deflated into
// base64url. A fragment never leaves the browser, so its items and notes reach no server,
// no /render and no log; only who has the link reads it.
import type { Annotation, SharedMap, GroepNotities, Map, MapItem, Verwijzingen } from './map';
import { verwijzingenIn } from './verwijzingen';
import { readAnnotations, readItem } from './map';

/** The fragment's key: `#m=…`. */
const KEY = 'm';

/** A link whose map does not read: cut off in a mail, or broken. */
export const BROKEN = 'broken';

/** A link of the older form, the map in its query: no longer read. */
export const isOldLink = (p: URLSearchParams) =>
	[...p.keys()].some((k) => /^map(?:naam|notitie|groepen|volgorde)?$/.test(k));

/** What the fragment holds: the map's name, order, note, notes per group, the addresses of
 *  their verwijzingen, items and aantekeningen. */
type Payload = {
	naam: string;
	volgorde?: 'eigen';
	notitie?: string;
	groepNotities?: GroepNotities;
	verwijzingen?: Verwijzingen;
	items: MapItem[];
	aantekeningen?: Annotation[];
};

/** What of a bundel a link or a file holds. */
type Shared = Pick<
	Map,
	'items' | 'naam' | 'volgorde' | 'notitie' | 'groepNotities' | 'verwijzingen' | 'aantekeningen'
>;

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
	const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
	return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
	let text = '';
	for (let i = 0; i < bytes.length; i += 0x8000)
		text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(text).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
	const raw = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
	return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** The notes per group that are text, only of groups the map holds. */
function groupNotes(notes: unknown, items: readonly MapItem[]): GroepNotities {
	if (!notes || typeof notes !== 'object') return {};
	const held = new Set(items.map((i) => i.groupKey));
	return Object.fromEntries(
		Object.entries(notes).flatMap(([k, v]) =>
			held.has(k) && typeof v === 'string' && v.trim() ? [[k, v.trim()]] : []
		)
	);
}

/** The addresses that are text, of the verwijzingen the notes still hold. */
function addresses(value: unknown, notes: readonly (string | null | undefined)[]): Verwijzingen {
	if (!value || typeof value !== 'object') return {};
	const used = new Set(notes.flatMap((n) => (n ? verwijzingenIn(n).map((v) => v.sleutel) : [])));
	return Object.fromEntries(
		Object.entries(value).filter(
			([k, v]) => used.has(k) && typeof v === 'string' && v.startsWith('/')
		)
	);
}

/** Every note of a map: its own, its groups', its items'. */
const notesOf = (m: Pick<Shared, 'notitie' | 'groepNotities' | 'items'>) => [
	m.notitie,
	...Object.values(m.groepNotities ?? {}),
	...m.items.map((i) => i.notitie)
];

/** What a link or a file holds of a map: its name, order, note, notes per group, items and
 *  aantekeningen. */
export function payloadOf(m: Shared): Payload {
	const payload: Payload = { naam: m.naam, items: [...m.items] };
	if (m.volgorde === 'eigen') payload.volgorde = 'eigen';
	if (m.notitie?.trim()) payload.notitie = m.notitie.trim();
	const notes = groupNotes(m.groepNotities, m.items);
	if (Object.keys(notes).length) payload.groepNotities = notes;
	const kept = addresses(m.verwijzingen, notesOf({ ...m, groepNotities: notes }));
	if (Object.keys(kept).length) payload.verwijzingen = kept;
	if (m.aantekeningen?.length) payload.aantekeningen = [...m.aantekeningen];
	return payload;
}

/**
 * The map a link or a file holds; null where it holds none that reads. An item or an
 * aantekening in a broken form is left out, and counted for the page; a link of before
 * aantekeningen reads as one without.
 */
export function readPayload(value: unknown): SharedMap | null {
	const payload = value as Partial<Payload> | null;
	if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items)) return null;
	const items = payload.items.flatMap((v) => readItem(v) ?? []);
	const a = readAnnotations(payload.aantekeningen, items);
	const notitie =
		typeof payload.notitie === 'string' && payload.notitie.trim() ? payload.notitie : null;
	const groepNotities = groupNotes(payload.groepNotities, items);
	return {
		naam: typeof payload.naam === 'string' && payload.naam.trim() ? payload.naam.trim() : null,
		items,
		volgorde: payload.volgorde === 'eigen' ? 'eigen' : 'groep',
		notitie,
		groepNotities,
		verwijzingen: addresses(payload.verwijzingen, notesOf({ notitie, groepNotities, items })),
		aantekeningen: a.aantekeningen,
		skipped: payload.items.length - items.length + a.rest.length
	};
}

/** The fragment of a map's link: `#m=…`. */
export async function shareFragment(m: Shared): Promise<string> {
	const bytes = new TextEncoder().encode(JSON.stringify(payloadOf(m)));
	return `#${KEY}=${toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')))}`;
}

/**
 * The map of a link's fragment; null where the fragment holds none, BROKEN where it holds
 * one that does not read. An item in a broken form is left out, and counted for the page.
 */
export async function sharedOfFragment(hash: string): Promise<SharedMap | typeof BROKEN | null> {
	const params = new URLSearchParams(hash.replace(/^#/, ''));
	if (!params.has(KEY)) return null;
	try {
		const bytes = await pipe(
			fromBase64Url(params.get(KEY)!),
			new DecompressionStream('deflate-raw')
		);
		return readPayload(JSON.parse(new TextDecoder().decode(bytes))) ?? BROKEN;
	} catch {
		return BROKEN;
	}
}

/** A shared bundel's name, as its page heads it and its tab names it. */
export const sharedMapName = (shared: Pick<SharedMap, 'naam'>): string =>
	shared.naam ?? 'Gedeelde bundel';

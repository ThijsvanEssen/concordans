import type { BronRef } from '$lib/bron/href';
import { shortDossierTitle } from '$lib/graph/types';
import type { FeedItem, FeedKind } from './feed';

// The homepage's Actueel: one stream, newest first. What matters on a day stands on its
// own with a headline in plain words (a bill voted on or brought in, a close vote, a
// toezegging, a law in force); the many moties, amendementen and brieven of a day become
// one line each, as a feed bundles its notices. Every line is one link.

export type TimelineLine = {
	id: string;
	/** The day the line belongs to. */
	date: string;
	/** `Stemming, aangenomen`, `Moties`: small capitals above the headline. */
	label: string;
	title: string;
	context: string | null;
	/** The bron of a line on its own, or the day in Actueel a bundle opens. */
	href: BronRef | string;
	/** A bill, a close vote, a toezegging: set larger, with room. */
	major: boolean;
	/** A vote lost: its label in the accent. */
	failed?: boolean;
};

/** A vote closer than this many seats stands on its own. */
export const CLOSE_VOTE = 10;
/** A day with at most this many votes on moties and amendementen shows each of them. */
const FEW_VOTES = 2;
/** Close votes shown on their own per day, the closest first. */
const CLOSE_SHOWN = 2;
/** Past this length a subject or a text is cut. */
const TITLE_MAX = 150;

const WORDS = [
	'nul',
	'één',
	'twee',
	'drie',
	'vier',
	'vijf',
	'zes',
	'zeven',
	'acht',
	'negen',
	'tien',
	'elf',
	'twaalf'
];
/** `zes`, `14`: a small number in words, as a headline writes it. */
export const inWords = (n: number) => WORDS[n] ?? String(n);

const cut = (text: string, max = TITLE_MAX) =>
	text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** `A, B en C`; past `max`, `A, B en 4 andere`. */
function listLine(names: string[], max: number, other: [string, string] = ['ander', 'andere']) {
	const shown = names.slice(0, max);
	const rest = names.length - shown.length;
	if (rest > 0) return `${shown.join(', ')} en ${rest} ${rest === 1 ? other[0] : other[1]}`;
	if (shown.length < 2) return shown[0] ?? '';
	return `${shown.slice(0, -1).join(', ')} en ${shown.at(-1)}`;
}

// ── Names ───────────────────────────────────────────────────────────────

/**
 * The surname of a person as a headline writes it: `P.A. Grinwis` gives `Grinwis`,
 * `D.J. van den Berg` gives `Van den Berg`, `Hans Vijlbrief` gives `Vijlbrief`.
 */
export function surname(name: string | null | undefined): string {
	const tokens = (name ?? '').trim().split(/\s+/).filter(Boolean);
	// A first name written out: `Hans`, or `(Inge)` after the initials.
	let rest = tokens.filter((t) => !t.includes('.') && !/^\(.*\)$/.test(t));
	if (rest.length > 1 && tokens[0] === rest[0] && !tokens.some((t) => t.includes('.')))
		rest = rest.slice(1);
	const s = rest.join(' ');
	return s ? s.charAt(0).toUpperCase() + s.slice(1) : (name ?? '');
}

type Dossier = NonNullable<FeedItem['dossier']>;

/**
 * A dossier by a short name: its short title, the name between brackets at the end of its
 * title, else the law a `Wijziging van …` changes.
 * TODO(backend): a short name for every bill (feed follow-up, a); until then from the title.
 */
export function dossierName(d: Dossier): string {
	const short = d.short_title?.trim();
	if (short) return short;
	const title = d.title?.trim() ?? '';
	const budget = /^Vaststelling van de begrotingsstaten van (?:het |de )?(.+?) \(/i.exec(
		title
	)?.[1];
	if (budget) return `Begroting ${budget}`;
	if (/\)\s*$/.test(title)) return shortDossierTitle(title) ?? d.number;
	const law =
		/(?:^Wijziging van|tot wijziging van) (?:de |het )?(.+?)(?: in verband met| ter | tot |, | en de | en het |$)/i.exec(
			title
		)?.[1];
	return law?.trim() || shortDossierTitle(title) || d.number;
}

/** `motie-Grinwis`, `motie-Kostić c.s.`: a paper by its first submitter. */
function paperOf(noun: string, i: FeedItem): string {
	const first = i.persons.find((p) => p.role === 'indiener') ?? i.persons[0];
	if (!first?.name) return noun;
	return `${noun}-${surname(first.name)}${i.persons.length > 1 ? ' c.s.' : ''}`;
}

/** Past this length the subject of a vote is cut: the headline stays two lines. */
const SUBJECT_MAX = 110;

/**
 * What a motie or amendement is about: its title after ` over `, without the paper it
 * replaces (`(t.v.v. 21501-30-712)`).
 */
const subjectOf = (title: string) => {
	const at = title.indexOf(' over ');
	if (at < 0) return null;
	const subject = title
		.slice(at + ' over '.length)
		.replace(/\s*\(t\.v\.v\.[^)]*\)\s*$/i, '')
		.trim();
	return cut(subject, SUBJECT_MAX);
};

const tallyOf = (i: FeedItem) => {
	const t = (i.vote?.tally ?? {}) as Record<string, number>;
	return { voor: t['Voor'] ?? 0, tegen: t['Tegen'] ?? 0 };
};

/** `141 voor, 7 tegen. ChristenUnie, dossier 21501-30` */
function voteContext(i: FeedItem): string {
	const { voor, tegen } = tallyOf(i);
	const faction = i.persons[0]?.faction?.short;
	const where = [faction, i.dossier ? `dossier ${i.dossier.number}` : null].filter(Boolean);
	return [voor + tegen ? `${voor} voor, ${tegen} tegen` : null, where.join(', ') || null]
		.filter(Boolean)
		.join('. ');
}

// ── Lines ───────────────────────────────────────────────────────────────

/** Actueel on one day and of some kinds, where a bundle leads. */
export function actueelDayHref(date: string, kinds: FeedKind[], dossier?: string) {
	const p = new URLSearchParams({ van: date, tot: date });
	if (kinds.length) p.set('soort', kinds.join(','));
	if (dossier) p.set('dossier', dossier);
	return `/actueel?${p.toString().replaceAll('%2C', ',')}`;
}

const hrefOf = (i: FeedItem): BronRef =>
	i.node.collection === 'dossiers' && i.dossier
		? { collection: 'dossiers', key: i.node.key, number: i.dossier.number }
		: ({ collection: i.node.collection, key: i.node.key } as BronRef);

function voteLine(i: FeedItem, noun: string): TimelineLine {
	const passed = !!i.vote?.passed;
	const subject = subjectOf(i.title ?? '');
	const paper = paperOf(noun, i);
	return {
		id: i.id,
		date: i.date,
		label: `Stemming, ${passed ? 'aangenomen' : 'verworpen'}`,
		title: cut(
			`Kamer ${passed ? 'neemt' : 'verwerpt'} ${paper}${passed ? ' aan' : ''}${subject ? ` over ${subject}` : ''}`
		),
		context: voteContext(i),
		href: hrefOf(i),
		major: true,
		failed: !passed
	};
}

/** The bills voted on in a day: one line per outcome. */
function billVoteLines(date: string, bills: FeedItem[]): TimelineLine[] {
	return [true, false].flatMap((passed) => {
		const those = bills.filter((b) => !!b.vote?.passed === passed);
		if (!those.length) return [];
		const verb = passed ? 'neemt' : 'verwerpt';
		const names = those.map((b) => (b.dossier ? dossierName(b.dossier) : cut(b.title ?? '', 60)));
		const one = those.length === 1;
		return [
			{
				id: `bills/${date}/${passed}`,
				date,
				label: `${one ? 'Wetsvoorstel' : 'Wetsvoorstellen'}, ${passed ? 'aangenomen' : 'verworpen'}`,
				title: one
					? `Kamer ${verb} wetsvoorstel${passed ? ' aan' : ''}: ${names[0]}`
					: `Kamer ${verb} ${inWords(those.length)} wetsvoorstellen${passed ? ' aan' : ''}`,
				context: one
					? those[0].dossier
						? `Dossier ${those[0].dossier.number}`
						: null
					: listLine(names, 5),
				href: one ? hrefOf(those[0]) : actueelDayHref(date, ['stemming']),
				major: true,
				failed: !passed
			}
		];
	});
}

/** The votes on moties, amendementen and the rest: the close ones alone, the others in one line. */
function otherVoteLines(date: string, votes: FeedItem[]): TimelineLine[] {
	if (!votes.length) return [];
	const noun = (i: FeedItem) => (i.subkind === 'amendement' ? 'amendement' : 'motie');
	if (votes.length <= FEW_VOTES) return votes.map((v) => voteLine(v, noun(v)));
	const margin = (i: FeedItem) => {
		const { voor, tegen } = tallyOf(i);
		return voor + tegen ? Math.abs(voor - tegen) : Infinity;
	};
	const close = votes
		.filter((v) => margin(v) <= CLOSE_VOTE)
		.sort((a, b) => margin(a) - margin(b))
		.slice(0, CLOSE_SHOWN);
	const moties = votes.filter((v) => v.subkind === 'motie');
	const amendementen = votes.filter((v) => v.subkind === 'amendement');
	const rest = votes.length - moties.length - amendementen.length;
	const lead = moties.length ? moties : votes;
	const passed = lead.filter((v) => v.vote?.passed).length;
	const also = [
		moties.length && amendementen.length
			? plural(amendementen.length, 'amendement', 'amendementen')
			: null,
		rest ? plural(rest, 'andere stemming', 'andere stemmingen') : null
	].filter(Boolean);
	return [
		...close.map((v) => voteLine(v, noun(v))),
		{
			id: `votes/${date}`,
			date,
			label: 'Stemmingen',
			title: `Kamer stemt over ${plural(lead.length, moties.length ? 'motie' : 'voorstel', moties.length ? 'moties' : 'voorstellen')}: ${passed} aangenomen, ${lead.length - passed} verworpen`,
			context: also.length ? `Ook ${listLine(also as string[], 2)}` : null,
			href: actueelDayHref(date, ['stemming']),
			major: false
		}
	];
}

/**
 * `Minister Vijlbrief komt in de startbrief terug op …`: the text of a toezegging with its
 * subject named. TODO(backend): the post of the bewindspersoon (feed follow-up, c); until
 * then the text says whether a minister or a staatssecretaris made it.
 */
export function commitmentTitle(i: FeedItem): string {
	const text = (i.summary ?? i.title ?? '').trim();
	const who = surname(i.persons[0]?.name);
	const m = /^De (minister|staatssecretaris|minister-president)\s+/i.exec(text);
	if (m && who)
		return cut(`${m[1].charAt(0).toUpperCase()}${m[1].slice(1)} ${who} ${text.slice(m[0].length)}`);
	return cut(who ? `${who}: ${text}` : text);
}

function commitmentLines(date: string, items: FeedItem[]): TimelineLine[] {
	const groups = new Map<string, FeedItem[]>();
	for (const i of items) {
		const g = `${i.dossier?.number ?? ''}/${i.persons[0]?.key ?? ''}`;
		groups.set(g, [...(groups.get(g) ?? []), i]);
	}
	return [...groups.values()].map((group) => {
		const [first] = group;
		const more = group.length - 1;
		const context = [
			more ? `En ${plural(more, 'andere toezegging', 'andere toezeggingen')}` : null,
			first.dossier ? `Dossier ${first.dossier.number}` : null
		]
			.filter(Boolean)
			.join('. ');
		return {
			id: first.id,
			date,
			label: 'Toezegging',
			title: commitmentTitle(first),
			context: context || null,
			href: more ? actueelDayHref(date, ['toezegging'], first.dossier?.number) : hrefOf(first),
			major: true
		};
	});
}

/** Bills brought in: one alone, many (the begrotingen of Prinsjesdag) in one line. */
function billLines(date: string, bills: FeedItem[]): TimelineLine[] {
	const name = (b: FeedItem) => (b.dossier ? dossierName(b.dossier) : (b.title ?? 'Wetsvoorstel'));
	if (bills.length <= 2)
		return bills.map((b) => ({
			id: b.id,
			date,
			label: 'Wetsvoorstel',
			title: `Wetsvoorstel ingediend: ${name(b)}`,
			context: b.dossier ? `Dossier ${b.dossier.number}` : null,
			href: hrefOf(b),
			major: true
		}));
	return [
		{
			id: `bills-in/${date}`,
			date,
			label: 'Wetsvoorstellen',
			title: `${bills.length} wetsvoorstellen ingediend`,
			context: listLine(bills.map(name), 3),
			href: actueelDayHref(date, ['wetsvoorstel']),
			major: true
		}
	];
}

function commencementLine(i: FeedItem): TimelineLine {
	const c = i.commencement;
	const law = c?.instrument?.title ?? i.title ?? 'Wet';
	return {
		id: i.id,
		date: i.date,
		label: 'Inwerkingtreding',
		title: `${law}: gewijzigde tekst in werking`,
		context:
			c?.changed_articles != null && c.article_count != null
				? `${c.changed_articles} van ${c.article_count} artikelen gewijzigd`
				: null,
		href: c?.instrument ? { collection: 'instruments', key: c.instrument.key } : hrefOf(i),
		major: true
	};
}

/** The papers of a kind brought in on a day: one alone, more in one line. */
function paperLines(
	date: string,
	kind: FeedKind,
	items: FeedItem[],
	noun: [string, string],
	label: [string, string]
): TimelineLine[] {
	if (!items.length) return [];
	if (items.length === 1) {
		const [i] = items;
		const who = i.persons.map((p) => p.name).filter(Boolean);
		return [
			{
				id: i.id,
				date,
				label: label[0],
				title: cut(i.title?.trim() || label[0]),
				context:
					[
						who.length ? listLine(who as string[], 2) : null,
						i.dossier ? `dossier ${i.dossier.number}` : null
					]
						.filter(Boolean)
						.join(', ') || null,
				href: hrefOf(i),
				major: false
			}
		];
	}
	const dossiers = new Map<string, { d: Dossier; n: number }>();
	for (const i of items)
		if (i.dossier) {
			const e = dossiers.get(i.dossier.number);
			dossiers.set(i.dossier.number, { d: i.dossier, n: (e?.n ?? 0) + 1 });
		}
	const byCount = [...dossiers.values()].sort((a, b) => b.n - a.n);
	const oneDossier = byCount.length === 1 && byCount[0].n === items.length ? byCount[0].d : null;
	let context: string | null;
	if (kind === 'brief_regering') {
		context = listLine(items.map((i) => cut(i.title?.trim() ?? '', 60)).filter(Boolean), 2);
	} else if (oneDossier) {
		const who = [
			...new Map(
				items
					.flatMap((i) => i.persons)
					.filter((p) => p.name)
					.map((p) => [
						p.key ?? p.name,
						`${surname(p.name)}${p.faction?.short ? ` (${p.faction.short})` : ''}`
					])
			).values()
		];
		context = who.length ? listLine(who, 3) : null;
	} else {
		context = byCount.length
			? listLine(
					byCount.map((e) => dossierName(e.d)),
					3,
					['ander dossier', 'andere dossiers']
				)
			: null;
	}
	return [
		{
			id: `${kind}/${date}`,
			date,
			label: label[1],
			title: oneDossier
				? `${plural(items.length, noun[0], noun[1])} bij ${dossierName(oneDossier)}`
				: kind === 'brief_regering'
					? plural(items.length, noun[0], noun[1])
					: `${plural(items.length, noun[0], noun[1])} ingediend`,
			context,
			href: actueelDayHref(date, [kind], oneDossier?.number),
			major: false
		}
	];
}

/** The papers the Kamer receives, as a headline counts them. */
const PAPERS: { kind: FeedKind; noun: [string, string]; label: [string, string] }[] = [
	{ kind: 'motie', noun: ['motie', 'moties'], label: ['Motie', 'Moties'] },
	{
		kind: 'amendement',
		noun: ['amendement', 'amendementen'],
		label: ['Amendement', 'Amendementen']
	},
	{
		kind: 'nota_van_wijziging',
		noun: ['nota van wijziging', 'nota’s van wijziging'],
		label: ['Nota van wijziging', 'Nota’s van wijziging']
	}
];

/**
 * The moties, amendementen and nota's of a day: of one kind, its own line; of more kinds,
 * one line that counts each (`Ingediend: 54 moties, 5 amendementen en 2 nota’s …`).
 */
function kamerstukLines(date: string, items: readonly FeedItem[]): TimelineLine[] {
	const present = PAPERS.map((p) => ({
		...p,
		items: items.filter((i) => i.kind === p.kind)
	})).filter((p) => p.items.length);
	if (present.length <= 1)
		return present.flatMap((p) => paperLines(date, p.kind, p.items, p.noun, p.label));
	const all = present.flatMap((p) => p.items);
	const dossiers = new Map<string, { d: Dossier; n: number }>();
	for (const i of all)
		if (i.dossier) {
			const e = dossiers.get(i.dossier.number);
			dossiers.set(i.dossier.number, { d: i.dossier, n: (e?.n ?? 0) + 1 });
		}
	const byCount = [...dossiers.values()].sort((a, b) => b.n - a.n);
	return [
		{
			id: `kamerstukken/${date}`,
			date,
			label: 'Kamerstukken',
			title: `Ingediend: ${listLine(
				present.map((p) => plural(p.items.length, p.noun[0], p.noun[1])),
				present.length
			)}`,
			context: byCount.length
				? listLine(
						byCount.map((e) => dossierName(e.d)),
						3,
						['ander dossier', 'andere dossiers']
					)
				: null,
			href: actueelDayHref(
				date,
				present.map((p) => p.kind)
			),
			major: false
		}
	];
}

/** One day's lines: what matters first, then the bundles. */
export function dayLines(date: string, items: readonly FeedItem[]): TimelineLine[] {
	const of = (kind: FeedKind) => items.filter((i) => i.kind === kind);
	const votes = of('stemming');
	return [
		...billVoteLines(
			date,
			votes.filter((v) => v.subkind === 'wetsvoorstel')
		),
		...billLines(date, of('wetsvoorstel')),
		...of('inwerkingtreding').map(commencementLine),
		...otherVoteLines(
			date,
			votes.filter((v) => v.subkind !== 'wetsvoorstel')
		),
		...commitmentLines(date, of('toezegging')),
		...kamerstukLines(date, items),
		...paperLines(
			date,
			'brief_regering',
			of('brief_regering'),
			['brief van de regering', 'brieven van de regering'],
			['Brief van de regering', 'Brieven']
		),
		...paperLines(
			date,
			'publicatie',
			of('publicatie'),
			['publicatie', 'publicaties'],
			['Publicatie', 'Publicaties']
		)
	];
}

/**
 * The lines of whole days, newest day first, up to `limit`. Of the last day that fits in
 * part, the lines that matter go before its bundles.
 */
export function timelineOf(items: readonly FeedItem[], limit: number): TimelineLine[] {
	const byDate = new Map<string, FeedItem[]>();
	for (const i of items) byDate.set(i.date, [...(byDate.get(i.date) ?? []), i]);
	const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));
	const lines: TimelineLine[] = [];
	for (const date of dates) {
		const day = dayLines(date, byDate.get(date)!);
		const room = limit - lines.length;
		if (day.length <= room) {
			lines.push(...day);
			continue;
		}
		const kept = new Set(
			[...day.filter((l) => l.major), ...day.filter((l) => !l.major)].slice(0, room)
		);
		lines.push(...day.filter((l) => kept.has(l)));
		break;
	}
	return lines;
}

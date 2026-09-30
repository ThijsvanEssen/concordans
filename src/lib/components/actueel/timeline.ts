import type { BronRef } from '$lib/bron/href';
import type { Schema } from '$lib/api/types';
import {
	AMENDEMENT,
	CLOSE_VOTE,
	KIND_LABEL,
	MOTIE,
	dossierName,
	isBillVote,
	normalizeItem,
	titleOf,
	voteMargin,
	type FeedItem,
	type FeedKind
} from './feed';

export { dossierName };

// The homepage's Actueel: one stream, newest first, from `/api/feed/summary`. What matters
// on a day stands on its own with a headline in plain words (a bill voted on or brought
// in, a close vote, a toezegging, a law in force); the many moties, amendementen and
// brieven of a day are counted in one line each, as a feed bundles its notices. Every
// line is one link.

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

/** Close votes shown on their own per day, the closest first. */
const CLOSE_SHOWN = 2;
/** Bills named in the context of a line that counts them; a bill without a short title is long. */
const BILLS_NAMED = 3;
/**
 * A day with at most this many votes not on a bill shows each by name: the summary's
 * `few`, which the homepage asks with.
 */
export const FEW_VOTES = 2;
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

/** A surname at the head of a phrase: `van den Berg` gives `Van den Berg`. */
export const headSurname = (s: string | null | undefined) =>
	s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

/** `motie-Grinwis`, `motie-Kostić c.s.`: a paper by its first submitter. */
function paperOf(noun: string, i: FeedItem): string {
	const name = headSurname(i.headline?.surname);
	if (!name) return noun;
	return `${noun}-${name}${i.persons.length > 1 ? ' c.s.' : ''}`;
}

/** Past this length the subject of a vote is cut: the headline stays two lines. */
const SUBJECT_MAX = 110;

/** What a motie or amendement is about, without the paper it replaces (`(t.v.v. …)`). */
const subjectOf = (i: FeedItem) => {
	const subject = i.headline?.subject?.replace(/\s*\(t\.v\.v\.[^)]*\)\s*$/i, '').trim();
	return subject ? cut(subject, SUBJECT_MAX) : null;
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
	const subject = subjectOf(i);
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
					: listLine(names, BILLS_NAMED),
				href: one ? hrefOf(those[0]) : actueelDayHref(date, ['stemming']),
				major: true,
				failed: !passed
			}
		];
	});
}

const nounOf = (v: FeedItem) => (v.subkind === AMENDEMENT ? 'amendement' : 'motie');

/** The close votes on moties and amendementen of a day, the closest first. */
function closeVoteLines(votes: FeedItem[]): TimelineLine[] {
	return votes
		.filter((v) => voteMargin(v) <= CLOSE_VOTE)
		.sort((x, y) => voteMargin(x) - voteMargin(y))
		.slice(0, CLOSE_SHOWN)
		.map((v) => voteLine(v, nounOf(v)));
}

/** The votes of a day not on a bill, the summary counts; a bill's votes stand apart. */
const otherVoteCount = (day: SummaryDay) =>
	(day.votes ?? []).filter((v) => !isBillVote(v)).reduce((n, v) => n + v.count, 0);

/**
 * The votes of a day not on a bill: a day with at most FEW_VOTES shows each by name (the
 * summary gives them all), a busier day its close ones and the rest counted in one line.
 */
function otherVoteLines(day: SummaryDay, votes: FeedItem[]): TimelineLine[] {
	const count = otherVoteCount(day);
	if (count && count <= FEW_VOTES && votes.length === count)
		return votes.map((v) => ({ ...voteLine(v, nounOf(v)), major: voteMargin(v) <= CLOSE_VOTE }));
	return [...closeVoteLines(votes), ...voteBundleLine(day)];
}

/**
 * The votes of a day not on a bill, counted: `Kamer stemt over 125 moties: 88 aangenomen,
 * 37 verworpen`, with the amendementen and the rest as context.
 */
function voteBundleLine(day: SummaryDay): TimelineLine[] {
	const votes = (day.votes ?? []).filter((v) => !isBillVote(v));
	const sum = (subkind: string | null, outcome?: string) =>
		votes
			.filter(
				(v) => (subkind === null || v.subkind === subkind) && (!outcome || v.outcome === outcome)
			)
			.reduce((n, v) => n + v.count, 0);
	const all = sum(null);
	if (!all) return [];
	const moties = sum(MOTIE);
	const amendementen = sum(AMENDEMENT);
	const rest = all - moties - amendementen;
	const lead = moties ? MOTIE : null;
	const count = moties || all;
	const passed = sum(lead, 'aangenomen');
	const noun: [string, string] = moties ? ['motie', 'moties'] : ['voorstel', 'voorstellen'];
	const also = [
		moties && amendementen ? plural(amendementen, 'amendement', 'amendementen') : null,
		moties && rest ? plural(rest, 'andere stemming', 'andere stemmingen') : null
	].filter((x): x is string => !!x);
	return [
		{
			id: `votes/${day.date}`,
			date: day.date,
			label: 'Stemmingen',
			title:
				count === 1
					? `Kamer ${passed ? 'neemt' : 'verwerpt'} een ${noun[0]}${passed ? ' aan' : ''}`
					: `Kamer stemt over ${plural(count, noun[0], noun[1])}: ${passed} aangenomen, ${count - passed} verworpen`,
			context: also.length ? `Ook ${listLine(also, 2)}` : null,
			href: actueelDayHref(day.date, ['stemming']),
			major: false
		}
	];
}

const POST = /^(minister-president|minister|staatssecretaris)\b/i;

/**
 * `Minister Vijlbrief komt in de startbrief terug op …`: the text of a toezegging with the
 * bewindspersoon in place of `De minister`. The post is the one they signed as.
 */
export function commitmentTitle(i: FeedItem): string {
	const text = (i.summary ?? i.title ?? '').trim();
	const person = i.persons[0];
	const who = headSurname(person?.surname);
	const post = POST.exec(person?.function ?? '')?.[1] ?? POST.exec(text.replace(/^De /i, ''))?.[1];
	const subject = /^De (?:minister-president|minister|staatssecretaris)\s+/i.exec(text);
	if (!who) return cut(text);
	const named = post ? `${headSurname(post.toLowerCase())} ${who}` : who;
	return cut(subject ? `${named} ${text.slice(subject[0].length)}` : `${named}: ${text}`);
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
			href: actueelDayHref(date, ['Voorstel van wet']),
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

/** The papers the Kamer receives, as a headline counts them. */
const PAPERS: { kind: FeedKind; noun: [string, string] }[] = [
	{ kind: 'Motie', noun: ['motie', 'moties'] },
	{ kind: 'Amendement', noun: ['amendement', 'amendementen'] },
	{ kind: 'Nota van wijziging', noun: ['nota van wijziging', 'nota’s van wijziging'] }
];

type SummaryDay = Schema<'FeedDayDTO'>;
type SummaryDossier = Schema<'FeedDossierCountDTO'>;

const countOf = (day: SummaryDay, kind: FeedKind) =>
	day.kinds?.find((k) => k.value === kind)?.count ?? 0;

/**
 * The moties, amendementen and nota's of a day counted in one line (`Ingediend: 54 moties,
 * 5 amendementen en 2 nota’s van wijziging`), with the largest dossiers of those papers.
 */
function kamerstukLine(day: SummaryDay): TimelineLine[] {
	const present = PAPERS.map((p) => ({ ...p, count: countOf(day, p.kind) })).filter((p) => p.count);
	if (!present.length) return [];
	// The summary counts per dossier and kind: the papers' kinds added up per dossier.
	const kinds = new Set<string>(present.map((p) => p.kind));
	const perDossier = new Map<string, { d: SummaryDossier; count: number }>();
	for (const d of day.dossiers ?? [])
		if (kinds.has(d.kind)) {
			const had = perDossier.get(d.number);
			perDossier.set(d.number, { d: had?.d ?? d, count: (had?.count ?? 0) + d.count });
		}
	const dossiers = [...perDossier.values()]
		.sort((a, b) => b.count - a.count)
		.map(({ d }) => dossierName(d));
	const counted = listLine(
		present.map((p) => plural(p.count, p.noun[0], p.noun[1])),
		present.length
	);
	return [
		{
			id: `kamerstukken/${day.date}`,
			date: day.date,
			label:
				present.length === 1
					? headSurname(present[0].noun[present[0].count === 1 ? 0 : 1])
					: 'Kamerstukken',
			title: present.length === 1 ? `${counted} ingediend` : `Ingediend: ${counted}`,
			context: dossiers.length ? listLine(dossiers, 3, ['ander dossier', 'andere dossiers']) : null,
			href: actueelDayHref(
				day.date,
				present.map((p) => p.kind)
			),
			major: false
		}
	];
}

/** The brieven or publicaties of a day, counted. */
function countedLine(
	day: SummaryDay,
	kind: FeedKind,
	noun: [string, string],
	label: string
): TimelineLine[] {
	const count = countOf(day, kind);
	if (!count) return [];
	return [
		{
			id: `${kind}/${day.date}`,
			date: day.date,
			label,
			title: plural(count, noun[0], noun[1]),
			context: null,
			href: actueelDayHref(day.date, [kind]),
			major: false
		}
	];
}

/**
 * One day's lines: its events that stand alone (from the summary's items), then its counts.
 * What matters comes first.
 */
export function dayLines(day: SummaryDay, items: readonly FeedItem[]): TimelineLine[] {
	const of = (kind: FeedKind) => items.filter((i) => i.kind === kind);
	const votes = of('stemming');
	return [
		...billVoteLines(
			day.date,
			votes.filter((v) => isBillVote(v))
		),
		...billLines(day.date, of('Voorstel van wet')),
		...of('inwerkingtreding').map(commencementLine),
		...otherVoteLines(
			day,
			votes.filter((v) => !isBillVote(v))
		),
		...commitmentLines(day.date, of('toezegging')),
		...kamerstukLine(day),
		...countedLine(
			day,
			'Brief regering',
			['brief van de regering', 'brieven van de regering'],
			'Brieven'
		),
		...countedLine(
			day,
			'publicatie',
			['publicatie in het Staatsblad', 'publicaties in het Staatsblad'],
			'Publicaties'
		)
	];
}

/**
 * The lines of the summary's days, newest first, up to `limit`. Of the last day that fits
 * in part, the lines that matter go before its counts.
 */
export function timelineOf(summary: Schema<'FeedSummaryResponse'>, limit: number): TimelineLine[] {
	const items = (summary.items ?? []).map(normalizeItem);
	const lines: TimelineLine[] = [];
	for (const d of summary.days ?? []) {
		if (!d.total) continue;
		const day = dayLines(
			d,
			items.filter((i) => i.date === d.date)
		);
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

export type Headline = Pick<TimelineLine, 'label' | 'title' | 'major' | 'failed'>;

/**
 * One event as Actueel heads it, in the words of the homepage: a vote as the Kamer's
 * decision, a toezegging with its bewindspersoon, a bill brought in by its name. What
 * matters (a bill, a close vote, a toezegging, a law in force) is major.
 */
export function headlineOf(i: FeedItem): Headline {
	switch (i.kind) {
		case 'stemming': {
			const passed = !!i.vote?.passed;
			if (isBillVote(i)) {
				const name = i.dossier ? dossierName(i.dossier) : cut(i.title ?? '', 60);
				return {
					label: `Wetsvoorstel, ${passed ? 'aangenomen' : 'verworpen'}`,
					title: `Kamer ${passed ? 'neemt' : 'verwerpt'} wetsvoorstel${passed ? ' aan' : ''}: ${name}`,
					major: true,
					failed: !passed
				};
			}
			const { label, title, failed } = voteLine(
				i,
				i.subkind === AMENDEMENT ? 'amendement' : 'motie'
			);
			return { label, title, major: voteMargin(i) <= CLOSE_VOTE, failed };
		}
		case 'toezegging':
			return { label: 'Toezegging', title: commitmentTitle(i), major: true };
		case 'Voorstel van wet': {
			const name = i.dossier ? dossierName(i.dossier) : (i.title ?? 'Wetsvoorstel');
			return { label: 'Wetsvoorstel', title: `Wetsvoorstel ingediend: ${name}`, major: true };
		}
		case 'inwerkingtreding': {
			const { label, title } = commencementLine(i);
			return { label, title, major: true };
		}
		default:
			return { label: KIND_LABEL[i.kind].one, title: titleOf(i), major: false };
	}
}

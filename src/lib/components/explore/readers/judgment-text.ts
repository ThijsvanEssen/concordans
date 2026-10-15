// Text parsing for judgment bodies. Rechtspraak.nl paragraphs arrive with the
// party block, table of contents and sub-numbering embedded in flat text, so
// the reader restructures them here. Pure functions, no Svelte.

import { joinAnd } from '$lib/text/words';
import { paragraphAnchor } from '$lib/text/anchor';
import type { Schema } from '$lib/api/types';
import { spansWithin } from '$lib/text/spans';
import type { NootMarker } from '$lib/text/voetnoten';

type Span = Schema<'ArticleCitationSpan'>;

// The first `subheading` paragraph always contains: court header, duplicate
// metadata KV pairs, a status word (ARREST/VONNIS/TEGENSPRAAK), the party
// blocks, and sometimes a full table of contents. We skip it in the paragraph
// list and instead render just the parties in the participants table.

const SKIP_LINE_RE =
	/^(hoge raad|gerechtshof|rechtbank|parket|advocaat-generaal|strafkamer|civiele kamer|belastingkamer|arrest|vonnis|beschikking|tegenspraak|verstek|op tegenspraak|niet verschenen)$/i;
const PUNCT_ONLY_RE = /^[,;.\s]+$/;
const META_KV_RE =
	/^(parketnummer|datum uitspraak|datum|nummer|zaaknummer|rolnummer|locatie)\s*[:-]/i;
const TOC_LINE_RE = /^\d[\d.]*\s+\S.{2,40}\s+\d+$/; // "1.2 Opbouw arrest 3"
const TOC_START_RE = /^inhoudsopgave/i;

/** The anchor id a rendered heading gets, from its (already normalized) text. */
function headingId(text: string): string {
	return (
		'h-' +
		text
			.toLowerCase()
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-]/g, '')
			.slice(0, 40)
	);
}

/** Split summary prose on double-newlines, normalising internal whitespace. */
export function splitSummary(text: string): string[] {
	return text
		.replace(/[ \t]+/g, ' ')
		.split(/\n[ \t]*\n+/)
		.map((p) => p.replace(/\n/g, ' ').trim())
		.filter(Boolean);
}

// ── Rechtsgebied and parties ─────────────────────────────────────────────
type CaseArea = 'strafrecht' | 'civiel' | 'bestuursrecht';

const AREA_PATTERNS: Array<[CaseArea, RegExp]> = [
	['strafrecht', /straf/i],
	['bestuursrecht', /bestuur|belasting|vreemdeling|sociale\s*zekerheid|ambtenaren|omgeving/i],
	[
		'civiel',
		/civiel|personen|familie|ondernemings|arbeidsrecht|verbintenissen|goederen|insolventie|burgerlijk/i
	]
];

function areaOf(text: string): CaseArea | null {
	for (const [area, re] of AREA_PATTERNS) if (re.test(text)) return area;
	return null;
}

/**
 * The rechtsgebied of a judgment: from its `subjects` prop, else from the kamer or
 * afdeling in the heading, the court, or the form of the case number.
 */
function caseArea(
	props: { subjects?: unknown; court?: unknown; case_number?: unknown } | null | undefined,
	heading: string | null
): CaseArea | null {
	const subjects = Array.isArray(props?.subjects)
		? props.subjects.filter((s): s is string => typeof s === 'string')
		: typeof props?.subjects === 'string'
			? props.subjects.split(/[;,]/)
			: [];
	for (const s of subjects) {
		const area = areaOf(s);
		if (area) return area;
	}

	if (heading) {
		if (/strafkamer|strafzaak|afdeling strafrecht|parketnummer/i.test(heading)) return 'strafrecht';
		if (/civiele kamer|civiel recht|ondernemingskamer|handelskamer|familiekamer/i.test(heading))
			return 'civiel';
		if (/belastingkamer|bestuursrecht/i.test(heading)) return 'bestuursrecht';
	}

	const court = typeof props?.court === 'string' ? props.court : '';
	if (/raad van state|centrale raad van beroep|college van beroep/i.test(court))
		return 'bestuursrecht';

	const caseNumber = typeof props?.case_number === 'string' ? props.case_number.trim() : '';
	if (/^\d{2}[-/]\d{6}-\d{2}\b/.test(caseNumber)) return 'strafrecht';
	if (/^C\/\d+|\b(?:HA ZA|KG ZA|HA RK|CV EXPL)\b|^200\.\d{3}\.\d{3}/.test(caseNumber))
		return 'civiel';
	if (/^[A-Z]{3}\s+\d{2}\/\d+/.test(caseNumber)) return 'bestuursrecht';

	return null;
}

// Role words a judgment uses for its own parties, and the label each gets.
const STATED_ROLES: Array<[RegExp, string]> = [
	[/^eise(?:r|res|rs|ressen)$/, 'Eiser'],
	[/^verwe(?:erder|erster|erders|ersters)$/, 'Verweerder'],
	[/^verzoek(?:er|ster|ers|sters)$/, 'Verzoeker'],
	[/^gedaagden?$/, 'Gedaagde'],
	[/^appellant(?:e|en)?$/, 'Appellant'],
	[/^geïntimeerden?$/, 'Geïntimeerde'],
	[/^opposant(?:e|en)?$/, 'Opposant'],
	[/^verdachten?$/, 'Verdachte'],
	[/^betrokkenen?$/, 'Betrokkene'],
	[/^veroordeelden?$/, 'Veroordeelde'],
	[/^(?:klager|klaagster)s?$/, 'Klager'],
	[/^belanghebbenden?$/, 'Belanghebbende'],
	[/^wederpartij(?:en)?$/, 'Wederpartij']
];

// "eisende partij", "gedaagde partijen": the role is in the first word.
const PARTY_PHRASES: Array<[RegExp, string]> = [
	[/^eisende\s+partij/, 'Eiser'],
	[/^verzoekende\s+partij/, 'Verzoeker'],
	[/^verwerende\s+partij/, 'Verweerder'],
	[/^gedaagde\s+partij/, 'Gedaagde']
];

function statedRole(word: string): string | null {
	const w = word.toLowerCase();
	for (const [re, label] of STATED_ROLES) if (re.test(w)) return label;
	return null;
}

/**
 * The role a short phrase states: "EISERS in eerste aanleg", "eiser/verzoeker",
 * "eisende partij in conventie", "hierna: de verdachte". Null for anything else.
 */
function roleOf(phrase: string): string | null {
	const p = phrase
		.toLowerCase()
		.replace(/[,.;:]+$/, '')
		.trim();
	if (!p || p.split(/\s+/).length > 10) return null;
	for (const [re, label] of PARTY_PHRASES) if (re.test(p)) return label;
	const hierna = p.match(/^hierna:\s*(?:de\s+)?(\p{L}+)$/u);
	if (hierna) return statedRole(hierna[1]);
	const first = p.match(/^(\p{L}+)(?:\/\p{L}+)?(?:\s+(?:in|tot|bij)\b.*)?$/u);
	return first ? statedRole(first[1]) : null;
}

/** An anonymised name that is itself a role: "[verdachte]", "[klager 1]", "[Appellante]". */
function roleOfPlaceholder(name: string): string | null {
	const m = name.match(/^\[(\p{L}+)(?:\s*\d+)?\]$/u);
	return m ? statedRole(m[1]) : null;
}

/** The role word a placeholder starts with: "[eiser in conventie 2]", "[wederpartij A]". */
function placeholderRole(name: string): string | null {
	const m = name.match(/^\[(\p{L}+)/u);
	return m ? statedRole(m[1]) : null;
}

const DEFAULT_ROLES: Record<CaseArea, { before: string | null; after: string }> = {
	strafrecht: { before: null, after: 'Verdachte' },
	civiel: { before: 'Eiser', after: 'Verweerder' },
	bestuursrecht: { before: 'Appellant', after: 'Verweerder' }
};

// Where the party block of a judgment ends: the first section heading.
const HEAD_END_RE =
	/^(?:\d+\.?\s+)?(?:de procedure|procedure|(?:het )?procesverloop|procesgang|(?:het )?onderzoek (?:van de zaak|ter terechtzitting|op de zitting)|(?:de )?tenlastelegging|samenvatting|inleiding|overwegingen|het geding|het verloop|kern van de zaak|verzoek en verweer|de feiten|beoordeling|hoger beroep)\b/i;

/**
 * The opening lines of a judgment's full text, up to its first section heading:
 * the part that names the court, the case and the parties.
 */
function judgmentHead(text: string): string {
	const lines = text
		.split(/\n/)
		.map((l) => l.replace(/\s+/g, ' ').trim())
		.filter(Boolean);
	const head: string[] = [];
	for (const l of lines.slice(0, 120)) {
		if (head.length > 2 && HEAD_END_RE.test(l)) break;
		head.push(l);
	}
	return head.join('\n');
}

// Lines that open the first side: "in de zaak van", "inzake", "in de zaak tussen",
// "op het verzoek van:".
const SIDE_START_RE =
	/^(?:in de zaak|in de zaken|inzake)\b|\b(?:tussen|van)\s*:$|\btussen$|\b(?:HA ZA|KG ZA|CV EXPL|HA RK)\b.*\bvan$/i;
// Lines between the sides: "tegen", "en tegen", "…in de zaak tegen:".
const SIDE_SPLIT_RE = /^(?:en\s+)?tegen\s*:?$|\btegen(?:\s+de\s+verdachte)?\s*:?$/i;
// In a strafzaak also a lone "van" or "door" ("ten laste / van", "ingediend / door").
const STRAF_SPLIT_RE = /^(?:van|door)$/i;
const BELANGHEBBENDE_RE = /^als belanghebbenden?\s+(?:wordt|worden)\s+aangemerkt\s*:?$/i;
// A second case in a joined judgment: "in de zaak 706680 / HA ZA 21-789 van".
const NEXT_CASE_RE = /^(?:en\s+)?(?:in de zaak|inzake)\b/i;
const BLOCK_END_RE =
	/^(?:hierna zullen|partijen worden|de procedure\b)|\b(?:zal|zullen|worden)\s+hierna\b/i;
const NOT_A_NAME_RE =
	/^(?:hierna|advoca|raadsman|raadsvrouw|gemachtigde|wonend|gevestigd|zetelend|geboren|kantoorhoudend|brp-adres|adres\b|uit\b|v-nummer|waarvan|thans|nu\b|momenteel|zonder|ingeschreven|inschrijvingsadres|verblijvende|woonplaats|beiden?\b|alle\b|die\b|mede\b|handelend|voorheen|tegen\b|van$|en$|(?:en\s+)?in de zaak|inzake|de moeder|de vader)/i;
const NUMBERED_RE = /^(\d{1,2})\.?\s+(\D.*)$/;
const PLACEHOLDER_RE = /^\[[^\]]+\]$/;
// A legal form without the name that follows it: "de stichting", "1. de besloten
// vennootschap met beperkte aansprakelijkheid", "rechtspersoon naar vreemd recht".
const LEGAL_FORM_RE =
	/^(?:de\s+)?(?:besloten vennootschap|naamloze vennootschap|stichting|vereniging|coöperatie|commanditaire vennootschap|vennootschap onder firma|vennootschap|maatschap|publiekrechtelijke rechtspersoon|rechtspersoon)(?:\s+(?:met|naar|onder)\b[\p{L}\s]*)?$/iu;
const LEGAL_FORMS_RE =
	/^(?:de\s+)?(?:\p{L}+\s+)?(?:stichtingen|verenigingen|vennootschappen|rechtspersonen)\b/iu;
const LEGAL_FORM_PREFIX_RE =
	/^(?:de\s+)?(?:besloten vennootschap|naamloze vennootschap|stichting|vereniging|coöperatie)(?:\s+met\s+(?:beperkte aansprakelijkheid|volledige rechtsbevoegdheid))?\s+(?=[A-Z[])/;

/** Letters spaced out for emphasis ("e i s e r e s ,", "t e g e n :") as one word. */
const unspace = (line: string) =>
	/^e n$/i.test(line)
		? 'en'
		: line.replace(/^((?:\p{L} ){2,}\p{L})(?=[\s,:.]|$)/u, (m) => m.replace(/ /g, ''));

function partyName(segment: string): string {
	return segment
		.replace(/\[\s*([^\]]*?)\s*\]/g, '[$1]')
		.replace(/\s+\.(?=\s|$)/g, '.')
		.replace(/\s+(?:te|uit|in)\s+\[[^\]]*\]\s*$/, '')
		.replace(/^(\[[^\]]+\])\s+(?:uit|te|gevestigd|wonend)\b.*$/, '$1')
		.replace(/[\s,]+(?:handelend|gevestigd|wonend|zetelend)\b.*$/, '')
		.replace(LEGAL_FORM_PREFIX_RE, '')
		.replace(/[\s,;:]+$/, '')
		.replace(/(?<!\b\p{Lu})\.$/u, '')
		.trim();
}

type Party = { name: string; role: string | null; generic: boolean };
type Side = { parties: Party[]; role: string | null; alias: string | null };

/**
 * The parties in lines `from` to `to`. A role line ("VERWEERSTERS in eerste
 * aanleg,") applies to the parties above it that have none yet.
 */
function readSide(lines: string[], from: number, to: number): Side {
	const side: Side = { parties: [], role: null, alias: null };
	let pendingForm: string | null = null;
	let lastNumber = 0;
	let roleFrom = 0;
	// After "en" or "en tegen" the next name is another party.
	let joined = false;
	const flush = () => {
		if (pendingForm) side.parties.push({ name: pendingForm, role: null, generic: true });
		pendingForm = null;
	};
	const assign = (role: string) => {
		flush();
		side.role ??= role;
		for (const p of side.parties.slice(roleFrom)) p.role ??= role;
		roleFrom = side.parties.length;
	};
	for (let i = from; i < to; i++) {
		const l = lines[i];
		if (TOC_START_RE.test(l) || TOC_LINE_RE.test(l) || BLOCK_END_RE.test(l) || l.length > 250)
			break;
		if (i > from && side.parties.length > 0 && NEXT_CASE_RE.test(l) && from > 0) break;
		if (SIDE_SPLIT_RE.test(l) || /^en$/i.test(l) || BELANGHEBBENDE_RE.test(l)) {
			flush();
			joined = true;
			continue;
		}
		const parens = [...l.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
		const segments = l
			.replace(/\([^)]*\)/g, ' ')
			.split(',')
			.map((s) => s.replace(/\s+/g, ' ').trim())
			.filter(Boolean);
		if (segments.length === 0) continue;
		const [first, ...rest] = segments;
		const ownRole = () => {
			let own: string | null = null;
			for (const s of [...rest, ...parens]) own ??= roleOf(s);
			return own;
		};

		const role = roleOf(first);
		if (role) {
			assign(role);
			continue;
		}
		const hierna = first.match(/^hierna(?:\s+te\s+noemen)?\s*:?\s*(.+)$/i);
		if (hierna) {
			if (!/^(?:gezamenlijk|samen|respectievelijk)\b/i.test(hierna[1])) side.alias ??= hierna[1];
			flush();
			continue;
		}
		if (SKIP_LINE_RE.test(first) || META_KV_RE.test(first) || PUNCT_ONLY_RE.test(first)) continue;
		if (NOT_A_NAME_RE.test(first) || LEGAL_FORMS_RE.test(first)) {
			flush();
			const own = ownRole();
			if (own) assign(own);
			continue;
		}

		const numbered = first.match(NUMBERED_RE);
		// Numbering runs up within a side; "1 De procedure" after party 4 is a heading.
		if (numbered) {
			const n = Number(numbered[1]);
			if (n <= lastNumber || (lastNumber === 0 && side.parties.length > 0)) break;
			lastNumber = n;
		}
		const text = numbered ? numbered[2] : first;
		if (LEGAL_FORM_RE.test(text)) {
			flush();
			pendingForm = text;
			continue;
		}
		const name = partyName(text);
		// Another unnumbered line is a party only as a placeholder named after a role
		// ("[eiser in conventie 2]"), not "[BRP-adres]" or the collective "[appellanten]".
		const extra =
			PLACEHOLDER_RE.test(name) && !/(?:en|s)\]$/.test(name) ? placeholderRole(name) : null;
		const another = numbered || pendingForm || joined || side.parties.length === 0 || extra;
		pendingForm = null;
		joined = false;
		if (
			!another ||
			!name ||
			NOT_A_NAME_RE.test(name) ||
			side.parties.some((p) => p.name === name)
		) {
			const own = ownRole();
			if (own) assign(own);
			continue;
		}
		const own = ownRole() ?? (side.parties.length > 0 && !numbered ? extra : null);
		side.parties.push({ name, role: own, generic: false });
		if (own) {
			side.role ??= own;
			roleFrom = side.parties.length;
		}
	}
	flush();
	return side;
}

/**
 * Aliases a judgment assigns after the parties, in order: "verzoekster 1 als:
 * [Aandeelhouder 1]". Only entries whose label is a role word count.
 */
function aliasList(lines: string[]): Array<{ role: string; alias: string }> {
	const out: Array<{ role: string; alias: string }> = [];
	lines.forEach((l, i) => {
		const m = l.match(/^(\p{L}+)(?:\s+\d+)?\s+als\s*:$/u);
		const role = m && statedRole(m[1]);
		const next = lines[i + 1];
		if (role && next) out.push({ role, alias: next.split(',')[0].trim() });
	});
	return out;
}

const sameParty = (a: string, b: string) => {
	const x = a.toLowerCase();
	const y = b.toLowerCase();
	return x === y || x.startsWith(y + ' ') || y.startsWith(x + ' ');
};

/**
 * The parties named in the heading block of a judgment, each with its role. The
 * block has one of these forms: "… tegen …", "… tussen … en …", "Partijen:", or
 * a single side ("op het verzoek van:"). Parties before the split are eiser,
 * verzoeker or appellant; after it verweerder or verdachte, depending on the
 * rechtsgebied. A role the judgment states itself takes precedence. Without
 * either, the role is "Partij".
 */
function extractParties(text: string, area: CaseArea | null): Participant[] {
	const lines = text
		.split(/\n/)
		.map((l) => unspace(l.replace(/\s+/g, ' ').trim()))
		.filter(Boolean);
	const defaults = area ? DEFAULT_ROLES[area] : null;

	let before: Side | null = null;
	let after: Side | null = null;
	let afterRole: string | null = null;

	const partijen = lines.findIndex((l) => /^partijen\s*:$/i.test(l));
	let split = lines.findIndex(
		(l) =>
			SIDE_SPLIT_RE.test(l) ||
			BELANGHEBBENDE_RE.test(l) ||
			(area === 'strafrecht' && STRAF_SPLIT_RE.test(l))
	);
	const start = lines.findIndex((l, i) => (split === -1 || i < split) && SIDE_START_RE.test(l));
	// Without "tegen", a lone "en" after the opening line separates the sides; in a
	// strafzaak it joins co-klagers or co-verdachten.
	if (split === -1 && start !== -1 && area !== 'strafrecht')
		split = lines.findIndex((l, i) => i > start && /^en$/i.test(l));

	if (partijen !== -1 && (split === -1 || partijen < split)) {
		// "Partijen:" followed by one line per party, the first the appellant.
		const parties = lines
			.slice(partijen + 1)
			.flatMap((_, k) => readSide(lines, partijen + 1 + k, partijen + 2 + k).parties);
		before = { parties: parties.slice(0, 1), role: null, alias: null };
		after = { parties: parties.slice(1), role: null, alias: null };
	} else {
		if (split === -1 && start === -1) return [];
		if (split === -1) split = lines.length;
		if (BELANGHEBBENDE_RE.test(lines[split] ?? '')) afterRole = 'Belanghebbende';
		before = start === -1 ? null : readSide(lines, start + 1, split);
		after = readSide(lines, split + 1, lines.length);
	}

	// A party on both sides is the one listed first: in "hoger beroep van: de
	// minister … tegen de uitspraak in het geding tussen: [appellant] en de minister".
	if (before && after)
		after.parties = after.parties.filter(
			(p) => p.generic || !before!.parties.some((q) => sameParty(p.name, q.name))
		);

	// A party known only by its legal form takes the alias the judgment gives it.
	const aliases = aliasList(lines);
	const used = new Set<number>();
	for (const side of [before, after]) {
		if (!side) continue;
		const generic = side.parties.filter((p) => p.generic);
		if (!aliases.length) {
			if (generic.length === 1 && side.alias) generic[0].name = side.alias;
			continue;
		}
		for (const p of generic) {
			const k = aliases.findIndex((a, i) => !used.has(i) && (!p.role || a.role === p.role));
			if (k === -1) continue;
			used.add(k);
			p.name = aliases[k].alias;
			p.role ??= aliases[k].role;
		}
	}

	const parties: Participant[] = [];
	const push = (side: Side, fallback: string | null) => {
		for (const p of side.parties) {
			const role = p.role ?? side.role ?? roleOfPlaceholder(p.name) ?? fallback ?? 'Partij';
			parties.push({ role, name: p.name });
		}
	};
	const single = !after || after.parties.length === 0;
	if (before && (area !== 'strafrecht' || single || before.role)) {
		const verzoek = area === 'civiel' && /verzoek|beschikking/i.test(text);
		push(before, verzoek ? 'Verzoeker' : (defaults?.before ?? null));
	}
	// In civil hoger beroep the other side of an appellant is geïntimeerde.
	const hogerBeroep = area === 'civiel' && parties.some((p) => p.role === 'Appellant');
	if (after) push(after, afterRole ?? (hogerBeroep ? 'Geïntimeerde' : (defaults?.after ?? null)));
	return parties;
}

// The parties the API reads from the kop (`JudgmentDTO.parties`).
type JudgmentParty = Schema<'JudgmentParty'>;

const isPlaceholder = (name: string) => /^\[.*\]$/.test(name.trim());

const REPRESENTATIVE_ROLES = {
	advocaat: 'Advocaat',
	gemachtigde: 'Gemachtigde',
	raadsman: 'Raadsman'
} as const;

/**
 * The parties the API read, each followed by who acts for it. A lawyer for several
 * parties in a row ("advocaat" under both eisers) is one row after the last of them.
 */
function fromApi(parties: JudgmentParty[]): Participant[] {
	type Rep = NonNullable<JudgmentParty['representatives']>[number];
	const acts = (p: JudgmentParty | undefined, r: Rep) =>
		!!p?.representatives?.some((q) => q.name === r.name && q.role === r.role);
	// A name the kop read up to the "en" that joins the next party: `[appellant 1] en`.
	const nameOf = (p: JudgmentParty) => p.name.replace(/\s+en$/, '');
	// An alias that is itself a placeholder ([eisers]) says nothing the name does not.
	const aliasOf = (p: JudgmentParty) =>
		p.alias && p.alias !== p.name && !isPlaceholder(p.alias) ? p.alias : null;
	return parties.flatMap((p, i) => {
		const alias = aliasOf(p);
		const alsoAs = p.roles?.filter((r) => r !== p.role) ?? [];
		const rows: Participant[] = [
			{
				role: p.role,
				name: nameOf(p),
				// `Partij` claims no role, so none is derived (an interested party, side `other`).
				stated: p.role_stated !== false || p.role === 'Partij',
				...(alias ? { alias } : {}),
				...(alsoAs.length ? { alsoAs } : {})
			}
		];
		for (const r of p.representatives ?? []) {
			if (acts(parties[i + 1], r)) continue;
			let from = i;
			while (from > 0 && acts(parties[from - 1], r)) from--;
			const labels = new Set(parties.slice(from, i + 1).map((q) => aliasOf(q) ?? nameOf(q)));
			rows.push({
				role: REPRESENTATIVE_ROLES[r.role] ?? r.role,
				name: r.name,
				parties: [...labels],
				...(r.place?.trim() ? { place: r.place.trim() } : {}),
				...(r.capacity?.trim() ? { capacity: r.capacity.trim() } : {})
			});
		}
		return rows;
	});
}

/**
 * All named participants of a judgment: its parties with their advocaten and
 * gemachtigden, and the raadslieden and A-G named in its first body paragraphs.
 * The parties come from the API (`parties`); a judgment the API has not read them
 * for gets them from the opening of its full text, or else its first subheading.
 */
export function judgmentParticipants(judgment: Schema<'JudgmentDTO'>): Participant[] {
	const paragraphs = judgment.paragraphs ?? [];
	// Null for a judgment normalized before the API read parties; empty when the kop names none.
	if (judgment.parties) return extractParticipants(paragraphs, fromApi(judgment.parties));

	const subheading = paragraphs.find((p) => p.kind === 'subheading')?.text ?? null;
	const text = judgment.props?.text;
	const head = typeof text === 'string' && text ? judgmentHead(text) : null;
	const area = caseArea(judgment.props, head ?? subheading);
	let parties = head ? extractParties(head, area) : [];
	if (parties.length === 0 && subheading) parties = extractParties(subheading, area);
	return extractParticipants(paragraphs, parties);
}

const WHITESPACE = /[ \t]*(?:\n[ \t]*)+|[ \t]+/g;

/**
 * Collapse runs of spaces to one, runs of line breaks to a line break or a blank
 * line, and trim. `at[i]` is where character `i` of `raw` ends up in the result,
 * so citation offsets (which count in the raw text) can follow.
 */
function normalize(raw: string): { text: string; at: number[] } {
	const at: number[] = new Array(raw.length + 1);
	let text = '';
	let last = 0;
	const copy = (to: number) => {
		for (let i = last; i < to; i++) at[i] = text.length + i - last;
		text += raw.slice(last, to);
	};
	for (const m of raw.matchAll(WHITESPACE)) {
		copy(m.index);
		at.fill(text.length, m.index, m.index + m[0].length);
		const breaks = m[0].split('\n').length - 1;
		text += breaks > 1 ? '\n\n' : breaks ? '\n' : ' ';
		last = m.index + m[0].length;
	}
	copy(raw.length);
	at[raw.length] = text.length;
	const lead = text.length - text.trimStart().length;
	return { text: text.trim(), at: at.map((p) => Math.max(0, p - lead)) };
}

const normalizeParagraphText = (text: string): string => normalize(text).text;

type ParsedBodyPara = {
	kind: 'body';
	num: string | null;
	/** Nesting depth: 0 = top-level (e.g. 2.1), 1 = sub-sub (e.g. 2.2.1) */
	depth: number;
	subTitle: string | null;
	body: string;
	/** Where `body` starts in the normalized paragraph text. */
	offset: number;
	/** Citations inside `body`, with offsets relative to it. */
	citations?: Span[];
	/** The footnote markers in `body`, `at` relative to it. */
	noten?: NootMarker[];
};
type ParsedHeading = { kind: 'heading'; text: string };
type ParsedSegment = ParsedBodyPara | ParsedHeading;

/** Parse a single (already-normalized) text chunk into a body paragraph. */
function parseOnePara(text: string, chunkOffset: number): ParsedBodyPara {
	const clean = text.trim();
	// The body is always the tail of the trimmed chunk.
	const at = (body: string) =>
		chunkOffset + text.length - text.trimStart().length + clean.length - body.length;

	// Match leading decimal number, e.g. "2.1" or "2.2.1"
	const numMatch = clean.match(/^(\d+(?:\.\d+)*\.?)\s*\n([\s\S]*)/);
	if (!numMatch)
		return { kind: 'body', num: null, depth: 0, subTitle: null, body: clean, offset: at(clean) };

	const num = numMatch[1].replace(/\.$/, ''); // strip trailing dot for display
	const depth = (num.match(/\./g) ?? []).length - 1; // "2.1" → 0 dots-after-first → depth 0; "2.2.1" → 1
	const rest = numMatch[2].replace(/^\s+/, '');

	// Sub-title: short line before a blank line, not ending with sentence punctuation
	const stMatch = rest.match(/^([^\n]{3,80})\n\n([\s\S]+)/);
	if (stMatch) {
		const candidate = stMatch[1].trim();
		const body = stMatch[2].trim();
		if (
			candidate.length < 80 &&
			!candidate.endsWith('.') &&
			!candidate.endsWith(',') &&
			body.length > 30
		) {
			return { kind: 'body', num, depth, subTitle: candidate, body, offset: at(body) };
		}
	}

	const body = rest.trim();
	return { kind: 'body', num, depth, subTitle: null, body, offset: at(body) };
}

// ── Participant extraction ────────────────────────────────────────────────
type Participant = {
	role: string;
	name: string;
	/** Whom a lawyer acts for: the parties by what the reader calls them (alias or name). */
	parties?: string[];
	/** Where a lawyer practises: `Voorschoten` of "advocaat te Voorschoten". */
	place?: string;
	/** What else the judgment calls them: `ambtenaar in dienst van de provincie`. */
	capacity?: string;
	/** False when the role is derived, not named in the judgment. */
	stated?: boolean;
	/** What the judgment calls the party: `KLM` for "hierna: KLM". */
	alias?: string;
	/** The other roles the kop names for the party: `Appellant` in incidenteel appel. */
	alsoAs?: string[];
};

/**
 * The participants of a judgment: its parties with who acts for them (from the API, or
 * the heading block, see `extractParties`), then the A-G and the officier van justitie
 * scanned from its first body paragraphs. Lawyers are not scanned from the body: the API
 * reads them per party (`representatives`), and a scan labelled every advocaat a raadsman.
 */
function extractParticipants(
	paragraphs: Array<{ kind?: string | null; text: string }>,
	parties: Participant[]
): Participant[] {
	const participants: Participant[] = [...parties];
	// "Mr. J. de Bie" in the kop and "mr. J. de Bie" in the body are one lawyer.
	const bare = (n: string) => n.replace(/^mr\.\s*/i, '').toLowerCase();
	const known = (n: string) => participants.some((p) => bare(p.name) === bare(n));

	// Scan first several body paragraphs for A-G and OvJ mentions.
	// GH judgments can place these in para 10–12 (after procesgang header), so scan wider.
	const bodyParas = paragraphs.filter((p) => p.kind === 'body').slice(0, 10);
	for (const para of bodyParas) {
		// Normalise non-breaking spaces (U+00A0) as well as regular whitespace
		const t = para.text.replace(/[\s\u00a0]+/g, ' ');

		// Advocaat-generaal / Procureur-generaal.
		// Keyword matched explicitly (Title Case and lowercase) so no 'i' flag is
		// needed — keeping the name part case-sensitive prevents false positives
		// like "advocaat-generaal merkte op" or "advocaat-generaal heeft eraan".
		for (const m of t.matchAll(
			/(?:advocaat-generaal|Advocaat-Generaal|procureur-generaal|Procureur-generaal)\s+((?:mr\.\s+)?(?:[A-Z]\.(?:[A-Z]\.)*\s+)?(?:(?:van|de|den|der|ten|ter)\s+){0,3}[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g
		)) {
			const n = m[1].trim().replace(/[,.]$/, '');
			if (n.length > 1 && !known(n)) {
				participants.push({ role: 'A-G', name: n });
			}
		}

		// Officier van Justitie (only when named: "officier van justitie mr. X")
		for (const m of t.matchAll(/officier van justitie\s+(mr\.\s+[A-Z][^,\n]{1,50}?)(?=[,\n])/g)) {
			const n = m[1].trim().replace(/[,.]$/, '');
			if (n.length > 1 && !known(n)) {
				participants.push({ role: 'OvJ', name: n });
			}
		}
	}

	return participants;
}

/** Split a body paragraph that may contain multiple sub-paragraphs or a
 *  trailing embedded section heading into an array of render segments. */
function splitBodyParagraph(
	text: string,
	citations: Span[] = [],
	noten: NootMarker[] = []
): ParsedSegment[] {
	const { text: normalized, at } = normalize(text);
	const spans = citations
		.filter((c) => c.start != null && c.end != null)
		.map((c) => ({ ...c, start: at[c.start!], end: at[c.end!] }));
	// A marker follows its words as a citation does; one without a place stands at the end.
	const markers = noten.map((n) => ({
		...n,
		at:
			n.at == null || n.at < 0 || n.at >= at.length
				? normalized.length
				: Math.min(at[n.at], normalized.length)
	}));

	// Early-out: backend sometimes emits section titles as kind=body.
	// Detect: single line (no \n), starts with a decimal number + space, short
	// enough for a title, and does not end with sentence punctuation. A line that ends
	// in a closing quote is a quotation (a judgment quoted in the facts), never a title.
	if (
		markers.length === 0 &&
		!normalized.includes('\n') &&
		normalized.length < 130 &&
		!normalized.endsWith('.') &&
		!normalized.endsWith(',') &&
		!/[”’"'»]$/.test(normalized)
	) {
		const inlineTitle = normalized.match(/^(\d+(?:\.\d+)*\.?)\s+(\S.+)$/);
		if (inlineTitle) {
			const num = inlineTitle[1].replace(/\.$/, '');
			return [{ kind: 'heading', text: `${num}. ${inlineTitle[2].trim()}` }];
		}
	}

	// 1. Detect a trailing embedded heading:
	//    "\n\nN. Title text" at the very end (e.g. "2.\tBeoordeling van …")
	//    Only match when the trailing part is a short title, not a sentence.
	const trailingHeadRe = /^([\s\S]+?)\n\n(\d+[.\t ]+\S[^\n]{2,79})\s*$/;
	let mainText = normalized;
	const trailingHeadings: ParsedHeading[] = [];
	const trailingMatch = normalized.match(trailingHeadRe);
	if (trailingMatch) {
		const candidate = trailingMatch[2].replace(/\t+/g, ' ').trim();
		// It's a heading if it's short and doesn't end with sentence punctuation
		if (!candidate.endsWith('.') && !candidate.endsWith(',') && candidate.length < 100) {
			mainText = trailingMatch[1].trim();
			trailingHeadings.push({ kind: 'heading', text: candidate });
		}
	}

	// 2. Split at sub-paragraph boundaries: a blank line followed by a decimal
	//    number with ≥2 components (e.g. \n\n2.2.1.\n or \n\n2.5.1 \n).
	//    Use a lookahead so the number stays in the next chunk.
	const subParaSplitRe = /(?=\n\n\d+(?:\.\d+){1,}\.?\s*\n)/g;
	const chunks = mainText.split(subParaSplitRe);

	let chunkOffset = 0;
	const result: ParsedSegment[] = [];
	for (const chunk of chunks) {
		if (chunk.trim()) {
			const para = parseOnePara(chunk, chunkOffset);
			result.push({ ...para, citations: spansWithin(spans, para.offset, para.body.length) });
		}
		chunkOffset += chunk.length;
	}

	// Each marker in the paragraph it stands in; past the last (in a trailing heading), at
	// its end.
	const bodies = result.filter((r): r is ParsedBodyPara => r.kind === 'body');
	for (const m of markers) {
		const para = bodies.find((b) => m.at <= b.offset + b.body.length) ?? bodies.at(-1);
		if (!para) continue;
		const rel = Math.max(0, Math.min(m.at - para.offset, para.body.length));
		para.noten = [...(para.noten ?? []), { id: m.id, label: m.label, at: rel }];
	}

	return [...result, ...trailingHeadings];
}

/** A party in the reader, with the lines of who acts for it under it. */
type PartyEntry = Participant & { counsel: string[] };

type RoleGroup = {
	role: string;
	/** Parties the judgment names, in its order. */
	named: PartyEntry[];
	/** Parties it names only by a placeholder (`[appellant 1]`), counted instead of listed. */
	anonymous: PartyEntry[];
	/** Who acts for the counted parties: their lines stand under the count. */
	counsel: string[];
	/** Some role in the group is derived, not stated in the judgment. */
	derived: boolean;
};

/** What the reader calls a party: its alias, or else its name. */
const labelOf = (p: Participant) => p.alias ?? p.name;

/**
 * Who acts for a party, in the form a judgment writes it: `mr. J. Geelhoed, advocaat te
 * Delft`, `mr. A. Jansen, gemachtigde, ambtenaar in dienst van de provincie`. The parties
 * are named only where the line does not say it already (`said`): `, voor [eisers]`.
 */
function counselLine(p: Participant, said = false): string {
	const role = p.role.toLowerCase();
	// A kop that writes "mr. S. Kriekaard, advocaat" gave the role with the name; another
	// role there stays ("mr. H.J. Delhaas, advocaat, gemachtigde").
	const name = p.name.endsWith(`, ${role}`) ? p.name.slice(0, -role.length - 2) : p.name;
	const parts = [name, `${role}${p.place ? ` te ${p.place}` : ''}`];
	if (p.capacity) parts.push(p.capacity);
	if (p.parties?.length && !said) parts.push(`voor ${forParties(p.parties)}`);
	return parts.join(', ');
}

/** What the reader writes after a party's name: `(KLM), ook appellant`. */
export function partyNote(p: Participant): string {
	const notes = [
		p.alias ? `(${p.alias})` : null,
		p.alsoAs?.length ? `ook ${p.alsoAs.map((r) => r.toLowerCase()).join(', ')}` : null
	];
	return notes.filter(Boolean).join(', ');
}

/**
 * The parties by role, in the order the roles first appear: a mass appeal of a hundred
 * pseudonymised appellants is one row, and the parties that are named stand out. Who
 * acts for a party stands under the party it follows; one that follows no party is a
 * row of its own.
 */
export function partiesByRole(participants: Participant[]): RoleGroup[] {
	const groups = new Map<string, RoleGroup>();
	const group = (role: string) => {
		let g = groups.get(role);
		if (!g) {
			g = { role, named: [], anonymous: [], counsel: [], derived: false };
			groups.set(role, g);
		}
		return g;
	};
	let host: PartyEntry | null = null;
	const hosted: Array<[PartyEntry, Participant]> = [];
	for (const p of participants) {
		if (p.parties && host) {
			hosted.push([host, p]);
			continue;
		}
		const g = group(p.role);
		const entry: PartyEntry = { ...p, counsel: [] };
		(isPlaceholder(p.name) ? g.anonymous : g.named).push(entry);
		if (p.stated === false) g.derived = true;
		if (!p.parties) host = entry;
	}
	// One pseudonymised party reads better by its placeholder than as a count of one.
	for (const g of groups.values()) {
		if (g.anonymous.length === 1) g.named.push(...g.anonymous.splice(0));
	}
	// A line stands under the last party it acts for and names its parties, unless it acts
	// for that one alone. A line for the whole row, or for counted parties, stands after
	// the row's parties, or its count; for the whole row it leaves them out.
	for (const g of groups.values()) {
		const row = new Set([...g.named, ...g.anonymous].map(labelOf));
		const all = (p: Participant) =>
			p.parties!.length === row.size && p.parties!.every((l) => row.has(l));
		for (const [entry, p] of hosted) {
			if (!g.named.includes(entry) && !g.anonymous.includes(entry)) continue;
			const one = p.parties!.length === 1 && p.parties![0] === labelOf(entry);
			if (g.named.includes(entry) && (one || !all(p))) entry.counsel.push(counselLine(p, one));
			else g.counsel.push(counselLine(p, all(p)));
		}
	}
	// The parties first, then who represents or advises them.
	const counsel = (g: RoleGroup) =>
		/advocaat|raadsman|raadslieden|gemachtigde|procureur/i.test(g.role) ||
		(g.named.length > 0 && g.named.every((p) => p.parties));
	const all = [...groups.values()];
	return [...all.filter((g) => !counsel(g)), ...all.filter(counsel)];
}

/** Whom a lawyer acts for, with pseudonymised parties counted: `KLM en 3 geanonimiseerde partijen`. */
function forParties(parties: string[]): string {
	const anonymous = parties.filter(isPlaceholder).length;
	if (anonymous < 2) return joinAnd(parties);
	return joinAnd(
		parties.filter((p) => !isPlaceholder(p)),
		{ n: anonymous, one: 'geanonimiseerde partij', many: 'geanonimiseerde partijen' }
	);
}

// The lines a conclusion of the Parket ends with, under the text: `De Procureur-Generaal
// bij de`, `Hoge Raad der Nederlanden`, `A-G`. The name of the A-G is not in them.
const SIGNATURE_LINE_RE =
	/^(de\s+)?((plv\.?\s+)?procureur-generaal|advocaat-generaal)(\s+bij\s+de)?$|^hoge raad der nederlanden$|^(a-g|p-g|plv\.?\s+p-g)$/i;

/**
 * Where the signature at the end of a text starts: the index of the first of the
 * closing lines the API marks `signature` (API 0.72), or else of the unnumbered lines
 * after the last paragraph that read as one; `paragraphs.length` when the text ends
 * otherwise.
 */
export function signatureStart(
	paragraphs: { kind?: string | null; number?: string | null; text: string }[]
): number {
	let i = paragraphs.length;
	while (i > 0) {
		const p = paragraphs[i - 1];
		const signs =
			p.kind === 'signature' ||
			(p.kind === 'body' && !p.number && SIGNATURE_LINE_RE.test(p.text.trim()));
		if (!signs) break;
		i--;
	}
	return i;
}

// ── The body as the reader lays it out ──────────────────────────────────────
type Paragraph = Schema<'JudgmentParagraph'>;

export type BodyItem =
	| { kind: 'heading'; text: string; id: string }
	| { kind: 'subheading'; text: string }
	| {
			kind: 'rov';
			num: string;
			subTitle: string | null;
			body: string;
			citations?: Span[];
			noten?: NootMarker[];
			/** The anchor of the overweging: `paragraph_id` of its paragraph, else `rov-<num>`. */
			id: string;
	  }
	| {
			kind: 'prose';
			body: string;
			citations?: Span[];
			noten?: NootMarker[];
			id?: string;
			/** It continues the overweging above it: the API numbers only an overweging's first paragraph. */
			within: boolean;
	  };

/**
 * A paragraph that is a title, though the API gives it as body: "Procesverloop",
 * "Overwegingen", "Toetsingskader" (Raad van State, rechtbank, CRvB). One short line that
 * starts with a capital and ends without a stop, a comma, a colon, a bracket or a quote.
 * TODO(backend I): goes once every court's titles come as subheading or heading.
 */
function isTitleLine(text: string): boolean {
	const t = text.trim();
	return (
		t.length >= 3 &&
		t.length <= 80 &&
		!t.includes('\n') &&
		/^[A-ZÀ-Ý]/.test(t) &&
		/[a-zà-ÿ]/.test(t) &&
		!/[.,;:)\]’”"'»?!]$/.test(t)
	);
}

/** The line that ends the parties of a conclusion or an arrest: "hierna: de verdachte". */
const PARTIES_END_RE = /^\(?hierna(?: te noemen)?\s*:/i;

/**
 * What the first subheading holds after the kop: the text that the source left in it
 * (TODO(backend H)). A conclusion's first points follow "hierna: de verdachte" there
 * (PHR:2026:901); an arrest's first chapters follow its kop (HR:2026:1530). Blocks of
 * the text, or none where the subheading is only the kop.
 */
function headRest(text: string): string[] {
	const blocks = text
		.split(/\n[ \t]*\n+/)
		.map((b) => b.trim())
		.filter(Boolean);
	// After the first section heading of the kop (judgmentHead stops there) …
	let from = blocks.findIndex((b, i) => i > 2 && HEAD_END_RE.test(b.replace(/\s+/g, ' ')));
	// … else after the line that names the last party.
	if (from < 0) {
		const last = blocks.findLastIndex((b) => PARTIES_END_RE.test(b));
		from = last < 0 ? -1 : last + 1;
	}
	if (from < 0 || from >= blocks.length) return [];
	const rest = blocks.slice(from);
	// Only an argument, not the tail of a kop: some sentence of some length in it.
	return rest.some((b) => b.length > 120 && /[.:]$/.test(b)) ? rest : [];
}

/**
 * The paragraphs of a judgment, up to its signature, as the reader shows them: headings,
 * subheadings, numbered overwegingen, and prose that either continues the overweging
 * above it or stands on its own. The first subheading is the kop (the participants
 * table shows it); only what the source left after it is read.
 */
export function bodyItems(
	paragraphs: Paragraph[],
	/** The footnote markers per `paragraph_id`, `at` in its raw text (uitspraakNoten). */
	noten: ReadonlyMap<string, NootMarker[]> = new Map()
): BodyItem[] {
	const first = paragraphs.find((p) => p.kind === 'subheading');
	const items: BodyItem[] = [];
	let within = false;

	const body = (
		text: string,
		citations: Span[] | undefined,
		number: string | null | undefined,
		paraId?: string,
		/** The API marks a paragraph that continues an overweging (`continues`, BE-56). */
		continues = false
	) => {
		const segs = splitBodyParagraph(text, citations ?? [], (paraId && noten.get(paraId)) || []);
		if (continues) within = true;
		segs.forEach((seg, i) => {
			if (seg.kind === 'heading') {
				items.push({ kind: 'heading', text: seg.text, id: headingId(seg.text) });
				within = false;
				return;
			}
			const num = seg.num ?? (i === 0 ? (number ?? null) : null);
			if (num) {
				items.push({
					kind: 'rov',
					num,
					subTitle: seg.subTitle,
					body: seg.body,
					citations: seg.citations,
					...(seg.noten ? { noten: seg.noten } : {}),
					id: (i === 0 && paraId) || paragraphAnchor(num)
				});
				within = true;
				return;
			}
			if (segs.length === 1 && !continues && !seg.noten && isTitleLine(seg.body)) {
				items.push({ kind: 'subheading', text: seg.body });
				within = false;
				return;
			}
			items.push({
				kind: 'prose',
				body: seg.body,
				citations: seg.citations,
				...(seg.noten ? { noten: seg.noten } : {}),
				id: i === 0 ? paraId : undefined,
				within
			});
		});
	};

	paragraphs.forEach((p, i) => {
		// The heading of the judgment's own table of contents ("Inhoudsopgave") goes with it:
		// its lines (kind toc) are left out, and a heading over nothing would remain.
		if ((p.kind === 'heading' || p.kind === 'subheading') && p !== first)
			if (paragraphs[i + 1]?.kind === 'toc') return;
		if (p.kind === 'subheading') {
			if (p === first) for (const block of headRest(p.text)) body(block, [], null);
			else {
				items.push({ kind: 'subheading', text: normalizeParagraphText(p.text) });
				within = false;
			}
		} else if (p.kind === 'heading') {
			// The number the API gives apart stands before the title, as in "1. Procesverloop".
			const title = normalizeParagraphText(p.text);
			const nr = p.number ?? null;
			const text = nr && !title.startsWith(nr) ? `${nr}. ${title}` : title;
			// The anchor stays that of the title alone, so a shared link keeps working.
			items.push({ kind: 'heading', text, id: headingId(title) });
			within = false;
		} else if (p.kind === 'toc') {
			// The judgment's own table of contents (BE-54): the column beside the text gives
			// it, and its lines are no overwegingen.
			return;
		} else {
			body(p.text, p.citations ?? [], p.number, p.paragraph_id, !!p.continues);
		}
	});
	return items;
}

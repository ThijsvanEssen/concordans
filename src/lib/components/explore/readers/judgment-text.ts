// Text parsing for judgment bodies. Rechtspraak.nl paragraphs arrive with the
// party block, table of contents and sub-numbering embedded in flat text, so
// the reader restructures them here. Pure functions, no Svelte.

// The first `subheading` paragraph always contains: court header, duplicate
// metadata KV pairs, a status word (ARREST/VONNIS/TEGENSPRAAK), the defendant
// identity block, and sometimes a full table of contents. We skip it in the
// paragraph list and instead render just the defendant block as a party card.

const SKIP_LINE_RE =
	/^(hoge raad|gerechtshof|rechtbank|parket|advocaat-generaal|strafkamer|civiele kamer|belastingkamer|arrest|vonnis|beschikking|tegenspraak|verstek|op tegenspraak|niet verschenen)$/i;
const PUNCT_ONLY_RE = /^[,;.\s]+$/;
const META_KV_RE =
	/^(parketnummer|datum uitspraak|datum|nummer|zaaknummer|rolnummer|locatie)\s*[:-]/i;
const TOC_LINE_RE = /^\d[\d.]*\s+\S.{2,40}\s+\d+$/; // "1.2 Opbouw arrest 3"
const TOC_START_RE = /^inhoudsopgave/i;

/**
 * Parse subjects like "Strafrecht; Materieel strafrecht" into a grouped
 * Map of top-level category → sub-categories[], deduplicating across entries.
 */
export function parseSubjects(subjects: string[]): Map<string, string[]> {
	const result = new Map<string, string[]>();
	for (const s of subjects) {
		const parts = s.split(/\s*;\s*/);
		const top = parts[0].trim();
		if (!result.has(top)) result.set(top, []);
		for (const sub of parts
			.slice(1)
			.map((p) => p.trim())
			.filter(Boolean)) {
			if (!result.get(top)!.includes(sub)) result.get(top)!.push(sub);
		}
	}
	return result;
}

/** Split summary prose on double-newlines, normalising internal whitespace. */
export function splitSummary(text: string): string[] {
	return text
		.replace(/[ \t]+/g, ' ')
		.split(/\n[ \t]*\n+/)
		.map((p) => p.replace(/\n/g, ' ').trim())
		.filter(Boolean);
}

/** Extract defendant/party lines from the first subheading text. */
export function extractPartyInfo(text: string): string[] | null {
	const lines = text
		.split(/\n/)
		.map((l) => l.replace(/\s+/g, ' ').trim())
		.filter(Boolean);

	// Find the "in de strafzaak tegen" / "...strafzaak tegen" / standalone "tegen" marker
	const markerIdx = lines.findLastIndex(
		(l) =>
			/strafzaak\s+.*\stegen\s*$/.test(l) || /strafzaak\s+tegen\s*$/.test(l) || /^tegen\s*$/.test(l)
	);
	if (markerIdx === -1) return null;

	const party: string[] = [];
	for (let i = markerIdx + 1; i < Math.min(lines.length, markerIdx + 10); i++) {
		const l = lines[i];
		if (TOC_START_RE.test(l) || TOC_LINE_RE.test(l)) break;
		if (SKIP_LINE_RE.test(l) || META_KV_RE.test(l) || PUNCT_ONLY_RE.test(l)) continue;
		party.push(l);
		// Stop after "hierna: de verdachte" — that's the end of the block
		if (/hierna:/i.test(l)) break;
	}
	return party.length > 0 ? party : null;
}

/** Normalize paragraph text: collapse horizontal whitespace and XML-artifact
 *  blank lines (sequences like \n \n become \n\n). */
export function normalizeParagraphText(text: string): string {
	return text
		.replace(/[ \t]+/g, ' ') // collapse runs of spaces/tabs
		.replace(/(\n[ \t]*){2,}/g, '\n\n') // \n \n → \n\n
		.replace(/^\s+|\s+$/g, ''); // trim
}

export type ParsedBodyPara = {
	kind: 'body';
	num: string | null;
	/** Nesting depth: 0 = top-level (e.g. 2.1), 1 = sub-sub (e.g. 2.2.1) */
	depth: number;
	subTitle: string | null;
	body: string;
};
export type ParsedHeading = { kind: 'heading'; text: string };
export type ParsedSegment = ParsedBodyPara | ParsedHeading;

/** Parse a single (already-normalized) text chunk into a body paragraph. */
export function parseOnePara(text: string): ParsedBodyPara {
	const clean = text.replace(/^\s+|\s+$/g, '');

	// Match leading decimal number, e.g. "2.1" or "2.2.1"
	const numMatch = clean.match(/^(\d+(?:\.\d+)*\.?)\s*\n([\s\S]*)/);
	if (!numMatch) return { kind: 'body', num: null, depth: 0, subTitle: null, body: clean };

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
			return { kind: 'body', num, depth, subTitle: candidate, body };
		}
	}

	return { kind: 'body', num, depth, subTitle: null, body: rest.trim() };
}

// ── Participant extraction ────────────────────────────────────────────────
export type Participant = { role: string; name: string; party?: string };

/**
 * Extract named parties from the judgment. Verdachte comes from the first
 * subheading; raadsman and A-G are scanned from the "Geding in cassatie"
 * body paragraph (typically the first body paragraph that mentions "mr.").
 */
export function extractParticipants(
	paragraphs: Array<{ kind?: string | null; text: string }>,
	partyLines: string[] | null
): Participant[] {
	const participants: Participant[] = [];

	// Verdachte
	if (partyLines && partyLines.length > 0) {
		const name = partyLines[0].replace(/,$/, '').trim();
		if (name) participants.push({ role: 'Verdachte', name });
	}

	// Scan first several body paragraphs for raadsman, A-G and OvJ mentions.
	// GH judgments can place these in para 10–12 (after procesgang header), so scan wider.
	const bodyParas = paragraphs.filter((p) => p.kind === 'body').slice(0, 10);
	for (const para of bodyParas) {
		// Normalise non-breaking spaces (U+00A0) as well as regular whitespace
		const t = para.text.replace(/[\s\u00a0]+/g, ' ');

		// ── Party-context map ─────────────────────────────────────────────────
		// Scan "namens [party]" occurrences and record their positions so each
		// raadsman can be associated with the party they represent.
		type PartySpan = { party: string; pos: number };
		const partySpans: PartySpan[] = [];
		for (const pm of t.matchAll(
			/[Nn]amens\s+(deze\b|hem\b|haar\b|(?:de\s+)?verdachte\b|(?:de\s+)?benadeelde\s+partij(?:\s+\[[^\]]*\])?)\s/g
		)) {
			const raw = pm[1].trim().toLowerCase();
			const party = /deze|hem|haar|verdachte/.test(raw)
				? 'verdachte'
				: /benadeelde/.test(raw)
					? 'benadeelde partij'
					: undefined;
			if (party) partySpans.push({ party, pos: pm.index! });
		}
		/** Return the party context active just before a given text position. */
		const partyAt = (pos: number): string | undefined => {
			let result: string | undefined;
			for (const span of partySpans) {
				if (span.pos <= pos) result = span.party;
				else break;
			}
			return result;
		};

		// Two lawyers: "mr. X en mr. Y, beiden advocaat te ..."
		for (const m of t.matchAll(
			/mr\.\s+([A-Z][^,\n]{1,40}?)\s+en\s+(mr\.\s+[A-Z][^,\n]{1,40}?),?\s+beiden\s+advocaat\b/g
		)) {
			const party = partyAt(m.index!);
			for (const raw of [m[1], m[2]]) {
				const n = raw.trim().startsWith('mr.') ? raw.trim() : `mr. ${raw.trim()}`;
				if (!participants.some((p) => p.name === n)) {
					participants.push({ role: 'Raadsman', name: n, party });
				}
			}
		}

		// Single lawyer with "mr." prefix: "mr. X, advocaat te ..."
		for (const m of t.matchAll(/mr\.\s+([A-Z][^,]{1,40}?),?\s+advocaat\b/g)) {
			const n = `mr. ${m[1].trim().replace(/,$/, '')}`;
			const party = partyAt(m.index!);
			if (!participants.some((p) => p.name === n)) {
				participants.push({ role: 'Raadsman', name: n, party });
			}
		}

		// Lawyer without "mr." prefix but with initials: "R.J. Baumgardt, advocaat te ..."
		for (const m of t.matchAll(
			/([A-Z]\.(?:[A-Z]\.)*\s+(?:(?:van|de|den|der|ten|ter)\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s+advocaat\b/g
		)) {
			const n = `mr. ${m[1].trim()}`;
			const party = partyAt(m.index!);
			if (!participants.some((p) => p.name === n)) {
				participants.push({ role: 'Raadsman', name: n, party });
			}
		}

		// Advocaat-generaal / Procureur-generaal.
		// Keyword matched explicitly (Title Case and lowercase) so no 'i' flag is
		// needed — keeping the name part case-sensitive prevents false positives
		// like "advocaat-generaal merkte op" or "advocaat-generaal heeft eraan".
		for (const m of t.matchAll(
			/(?:advocaat-generaal|Advocaat-Generaal|procureur-generaal|Procureur-generaal)\s+((?:mr\.\s+)?(?:[A-Z]\.(?:[A-Z]\.)*\s+)?(?:(?:van|de|den|der|ten|ter)\s+){0,3}[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g
		)) {
			const n = m[1].trim().replace(/[,.]$/, '');
			if (n.length > 1 && !participants.some((p) => p.name === n)) {
				participants.push({ role: 'A-G', name: n });
			}
		}

		// Officier van Justitie (only when named: "officier van justitie mr. X")
		for (const m of t.matchAll(/officier van justitie\s+(mr\.\s+[A-Z][^,\n]{1,50}?)(?=[,\n])/g)) {
			const n = m[1].trim().replace(/[,.]$/, '');
			if (n.length > 1 && !participants.some((p) => p.name === n)) {
				participants.push({ role: 'OvJ', name: n });
			}
		}
	}

	return participants;
}

/** Split a body paragraph that may contain multiple sub-paragraphs or a
 *  trailing embedded section heading into an array of render segments. */
export function splitBodyParagraph(text: string): ParsedSegment[] {
	const normalized = normalizeParagraphText(text);

	// Early-out: backend sometimes emits section titles as kind=body.
	// Detect: single line (no \n), starts with a decimal number + space, short
	// enough for a title, and does not end with sentence punctuation.
	if (
		!normalized.includes('\n') &&
		normalized.length < 130 &&
		!normalized.endsWith('.') &&
		!normalized.endsWith(',')
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

	const result: ParsedSegment[] = chunks
		.map((c) => c.trim())
		.filter(Boolean)
		.map((c) => parseOnePara(c));

	return [...result, ...trailingHeadings];
}

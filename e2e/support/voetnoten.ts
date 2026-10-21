// The footnotes of an article or a bijlage as API 0.80.2 gives them (#875): the marker
// (`<sup>1</sup>`) no character of the text but `footnote_marks: [{at, number}]`, every offset
// behind it one marker shorter. Until that release is live the recorded answers still hold the
// marker as text (`2019/9441`); these patch them into the new form, and go with the release.

type Json = Record<string, unknown>;

/** A marker as the recorded text prints it: right after `after`, as `printed` (`1)`). */
export type Marker = { after: string; number: string; printed?: string };

const OFFSETS = new Set(['start', 'end', 'at', 'char_start', 'char_end']);

/** Every offset in `value` past `cut` moved back by `length`, the marker cut out of a `text`. */
function shift(value: unknown, cut: number, length: number, gone: string): unknown {
	if (Array.isArray(value)) return value.map((v) => shift(v, cut, length, gone));
	if (!value || typeof value !== 'object') return value;
	return Object.fromEntries(
		Object.entries(value as Json).map(([k, v]) => {
			if (OFFSETS.has(k) && typeof v === 'number' && v > cut)
				return [k, v - Math.min(length, v - cut)];
			if (k === 'text' && typeof v === 'string')
				return [k, v.replace(gone, gone.slice(0, -length))];
			return [k, shift(v, cut, length, gone)];
		})
	);
}

/**
 * `body` with the markers taken out of the text of `holder` (the article or the annex in it)
 * and listed as its `footnote_marks`.
 */
export function metVoetnoten(body: Json, holder: string, markers: Marker[]): Json {
	let out = body;
	const marks: { at: number; number: string }[] = [];
	for (const m of markers) {
		const printed = m.printed ?? m.number;
		const text = String((out[holder] as Json).text);
		const found = text.indexOf(m.after + printed);
		if (found < 0) throw new Error(`no marker ${printed} after "${m.after}"`);
		const cut = found + m.after.length;
		out = shift(out, cut, printed.length, m.after + printed) as Json;
		for (const mark of marks) if (mark.at > cut) mark.at -= printed.length;
		marks.push({ at: cut, number: m.number });
	}
	return { ...out, [holder]: { ...(out[holder] as Json), footnote_marks: marks } };
}

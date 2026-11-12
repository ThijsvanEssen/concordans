// Text set into HTML by hand: the first paint and a bundel's notes. One escape for all of
// them, the quote of either kind included, so a value is safe inside an attribute too.

const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};

/** `s` as text in HTML, in an element or an attribute. */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

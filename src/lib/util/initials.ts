// Extract 1–2 letter initials from a Dutch personal name.
// Handles tussenvoegsels ("van der", "den", "de") by skipping them so
// "Caroline van der Plas" yields "CP", not "VP" or just "C".
const TUSSEN = new Set([
	'van',
	'der',
	'de',
	'den',
	'het',
	'ten',
	'ter',
	'op',
	'in',
	'aan',
	'bij',
	'tot',
	'over',
	"'t",
	"d'",
	'la',
	'le',
	'du',
	'da',
	'di',
	'el'
]);

export function initials(name: string | null | undefined): string {
	if (!name) return '?';
	const cleaned = name.replace(/[(),.]/g, ' ').trim();
	if (!cleaned) return '?';
	// Drop comma-suffixed honorifics and parenthesised aliases first.
	const parts = cleaned
		.split(/\s+/)
		.filter((p) => !TUSSEN.has(p.toLowerCase()))
		.filter(Boolean);

	if (parts.length === 0) return cleaned.charAt(0).toUpperCase();
	if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

	const first = parts[0];
	const last = parts[parts.length - 1];
	return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

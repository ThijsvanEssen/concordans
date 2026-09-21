// Shared formatters and label maps used by the parliamentary readers.

/** A node prop (untyped in the API schema) as text, or null when it is not a non-empty string. */
export const textProp = (value: unknown): string | null =>
	typeof value === 'string' && value ? value : null;

export function formatDate(d: string | null) {
	if (!d) return '';
	return new Date(d).toLocaleDateString('nl-NL', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
}

export function formatLongDate(d: string | null) {
	if (!d) return '';
	return new Date(d).toLocaleDateString('nl-NL', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}

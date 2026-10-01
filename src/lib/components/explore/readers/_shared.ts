// Shared formatters and label maps used by the parliamentary readers.
import { korteDatum, langeDatum } from '$lib/text/datum';

/** A node prop (untyped in the API schema) as text, or null when it is not a non-empty string. */
export const textProp = (value: unknown): string | null =>
	typeof value === 'string' && value ? value : null;

/** `28 sep. 2026`, from `$lib/text/datum`. */
export const formatDate = (d: string | null) => korteDatum(d);

/** `28 september 2026`, from `$lib/text/datum`. */
export const formatLongDate = (d: string | null) => langeDatum(d);

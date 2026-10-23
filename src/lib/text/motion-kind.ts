// A motion of censure or of no confidence, as the API knows it from the fixed wording of its
// subject (`motion_kind`, API 0.80, #862): one name for it on every page, the feed, the head of
// a Kamerstuk and the rows of the stemmingen; the address names it in Dutch (`?motie=`).
import type { Schema } from '$lib/api/types';

type MotionKind = NonNullable<Schema<'DecisionSummaryDTO'>['motion_kind']>;

export const MOTION_KIND_LABEL: Record<MotionKind, string> = {
	censure: 'Motie van afkeuring',
	no_confidence: 'Motie van wantrouwen'
};

/** The kinds in the order the filter lists them. */
export const MOTION_KINDS = Object.keys(MOTION_KIND_LABEL) as MotionKind[];

/** The word of each kind in the address: `?motie=wantrouwen`. */
export const MOTION_KIND_PARAM: Record<MotionKind, string> = {
	censure: 'afkeuring',
	no_confidence: 'wantrouwen'
};

const isMotionKind = (v: unknown): v is MotionKind =>
	typeof v === 'string' && Object.hasOwn(MOTION_KIND_LABEL, v);

/** `Motie van wantrouwen`; null for any other paper or vote. */
export const motionKindLabel = (kind: unknown): string | null =>
	isMotionKind(kind) ? MOTION_KIND_LABEL[kind] : null;

/** The kind an address names (`wantrouwen`); undefined for none or a word it does not know. */
export const motionKindFromParam = (v: string | null): MotionKind | undefined =>
	MOTION_KINDS.find((k) => MOTION_KIND_PARAM[k] === v);

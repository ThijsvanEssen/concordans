import type { Schema } from '$lib/api/types';

// What a stemming is about, as the API gives it (`kind`): a motion, an amendment or a bill.

export type DecisionKind = NonNullable<Schema<'DecisionSummaryDTO'>['kind']>;

export const DECISION_KIND_LABEL: Record<DecisionKind, string> = {
	motie: 'Motie',
	amendement: 'Amendement',
	wetsvoorstel: 'Wetsvoorstel',
	overig: 'Overig'
};

export const isDecisionKind = (value: string): value is DecisionKind =>
	Object.hasOwn(DECISION_KIND_LABEL, value);

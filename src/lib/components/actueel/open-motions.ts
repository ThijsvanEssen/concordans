// The motions of censure and of no confidence not yet voted on (API 0.80, #862): what
// Actueel puts first. A motion is open while its `outcome` is null; one filed before the
// window is left to the list of Kamerstukken.
import type { Schema } from '$lib/api/types';
import { getConfidenceMotions } from '$lib/api/documents';
import { padHref, parsePad, remember } from '$lib/bron/address';
import { addDays, vandaag } from '$lib/text/datum';

type Paper = Schema<'DocumentListItemDTO'>;

/** How far back an open motion is looked for. */
const WINDOW_DAYS = 60;

/** The open ones, newest first, each with its readable address remembered for its link. */
export function openMotions(papers: Paper[]): Paper[] {
	const open = papers.filter((p) => p.outcome === null && p.motion_kind);
	for (const p of open) {
		const pad = p.path ? parsePad(p.path) : null;
		if (pad) remember(padHref(pad), `documents/${p.key}`);
	}
	return open.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

/** The open motions of the window. */
export const loadOpenMotions = (signal?: AbortSignal, today = vandaag()) =>
	getConfidenceMotions(addDays(today, -WINDOW_DAYS), signal).then((r) =>
		openMotions(r.items ?? [])
	);

/** `37020-XVI`: the dossier a paper is numbered in, with its suffix. */
export const dossierOf = (p: Pick<Paper, 'dossier_number' | 'dossier_suffix'>) =>
	p.dossier_number ? `${p.dossier_number}${p.dossier_suffix ? `-${p.dossier_suffix}` : ''}` : null;

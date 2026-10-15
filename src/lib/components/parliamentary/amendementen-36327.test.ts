// The timetable of dossier 36327 as it stood when it was built from the dossier's
// neighbourhood (timetable-36327.json), now from /api/dossiers/36327/amendments: the papers
// of each amendment, its submitter, its merge and its outcome.
import { describe, expect, it } from 'vitest';
import antwoord from '$lib/fixtures/amendments-36327.json';
import verwacht from '$lib/fixtures/timetable-36327.json';
import type { Schema } from '$lib/api/types';
import { dienstregeling, type Dienstregeling } from './amendementen';

/** What the timetable draws of a row, without the ids of the papers. */
const beeld = (d: Dienstregeling) => ({
	kolommen: d.kolommen,
	metVervanging: d.metVervanging,
	rijen: d.rijen.map((r) => ({
		stuk: r.stuk.id,
		nummer: r.stuk.nummer,
		titel: r.stuk.titel,
		haltes: r.haltes.map((h) => [h.nummer, h.datum, !!h.nieuw, h.vervangenDoor ?? null]),
		indiener: r.indiener,
		samengevoegd: r.samengevoegd,
		uitslag: r.uitslag,
		nogNiet: r.nogNiet
	}))
});

describe('the timetable of 36327', () => {
	it('has the rows from /amendments that it had from the neighbourhood', () => {
		expect(beeld(dienstregeling(antwoord as Schema<'AmendmentChainsResponse'>))).toEqual(verwacht);
	});
});

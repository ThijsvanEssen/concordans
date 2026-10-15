// The timetable of dossier 36327 (Wet versterking waarborgfunctie Sv) as it stands, so that
// where it is read from cannot change a row: the papers of each amendment, its submitter, its
// merge and its outcome.
import { describe, expect, it } from 'vitest';
import buurt from '$lib/fixtures/neighborhood-amendments-36327.json';
import verwacht from '$lib/fixtures/timetable-36327.json';
import { dienstregeling, type Dienstregeling, type Graph } from './amendementen';

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
	it('has the rows it has now', () => {
		expect(beeld(dienstregeling(buurt as Graph))).toEqual(verwacht);
	});
});

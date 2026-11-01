// The names and soorten of the columns and lanes as the lanes head them.
import type { Sort } from '$lib/bron/rubrieken';
import type { MakerLane } from './roles';
import type { Column } from './scene';

export const COLUMN_TITLE: Record<Column, string> = {
	makers: 'Wie maakt',
	papers: 'Kamerstukken',
	laws: 'Wetten',
	rulings: 'Rechtspraak'
};
export const COLUMN_SORT: Record<Column, Sort> = {
	makers: 'kamerleden',
	papers: 'stukken',
	laws: 'wetten',
	rulings: 'uitspraken'
};
export const LANE_TITLE: Record<MakerLane, string> = {
	government: 'Regering',
	council: 'Raad van State',
	parliament: 'Parlement'
};
export const LANE_SORT: Record<MakerLane, Sort> = {
	government: 'bewindspersonen',
	council: 'kamerleden',
	parliament: 'kamerleden'
};

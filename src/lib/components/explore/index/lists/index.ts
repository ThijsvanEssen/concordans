// The register of the lists of Bronnen: one definition per category, so a category missed
// is a type error here.
import type { IndexCategory } from '../categories';
import type { IndexList } from './list';
import { cabinets } from './cabinets';
import { commitments } from './commitments';
import { committees } from './committees';
import { decisions } from './decisions';
import { documents } from './documents';
import { dossiers } from './dossiers';
import { factions } from './factions';
import { instruments } from './instruments';
import { judgments } from './judgments';
import { members } from './members';
import { ministers } from './ministers';
import { ministries } from './ministries';

export const LISTS: Record<IndexCategory, IndexList> = {
	instruments,
	judgments,
	dossiers,
	decisions,
	documents,
	members,
	factions,
	committees,
	cabinets,
	ministries,
	ministers,
	commitments
};

// Who brought a bill in, as the dossier names it (`proposed_by`, API 0.80.7): the government
// (a bewindspersoon signed), a Kamerlid (an initiative bill), or the chair of a committee whose
// Brief commissie proposes to take a burgerinitiatief in treatment (the citizens themselves are
// not in the data). The capacity and the kind of paper are the source's; a part it lacks is
// left out, nothing is guessed.
import type { Schema } from '$lib/api/types';

type Proposer = Schema<'DossierProposerDTO'>;

/** The sentence around the person: what stands before the name, the name, and what follows. */
type Proposal = {
	before: string;
	name: string | null;
	memberKey: string | null;
	/** The end of the sentence, with its full stop. */
	after: string;
};

const CHAIR = /^voorzitter van de (vaste commissie voor .+)$/i;

export function proposal(
	p: Proposer | null | undefined,
	documentKinds?: Record<string, number> | null
): Proposal | null {
	if (!p) return null;
	const name = p.name?.trim() || null;
	const fn = p.function?.trim() || null;
	const memberKey = p.member_key ?? null;
	const committee = p.capacity === 'kamerlid' ? fn?.match(CHAIR)?.[1] : null;
	if (committee && name && documentKinds?.['Brief commissie'])
		return {
			before: `Burgerinitiatief, door de ${committee} (voorzitter `,
			name,
			memberKey,
			after: ') voorgesteld in behandeling te nemen.'
		};
	const lead =
		p.capacity === 'bewindspersoon'
			? name
				? 'Voorstel van de regering, ingediend door'
				: 'Voorstel van de regering'
			: committee
				? name
					? 'Ingediend door'
					: ''
				: p.capacity === 'kamerlid'
					? 'Initiatiefvoorstel van'
					: name
						? 'Ingediend door'
						: '';
	if (!lead) return null;
	const role = p.capacity === 'kamerlid' && !committee ? null : fn;
	return {
		before: name ? `${lead} ` : lead,
		name,
		memberKey,
		after: `${role ? `, ${role}` : ''}.`
	};
}

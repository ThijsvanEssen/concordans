// Who brought a bill in, as the dossier names it (`proposed_by`, API 0.80.7): the government
// (a bewindspersoon signed) or a Kamerlid (an initiative bill). The capacity is the source's;
// a part it lacks is left out, nothing is guessed.
import type { Schema } from '$lib/api/types';

type Proposer = Schema<'DossierProposerDTO'>;

/** The words before the person, and the person's name and function where the source gives them. */
type Proposal = {
	lead: string;
	name: string | null;
	memberKey: string | null;
	function: string | null;
};

/**
 * A Kamerlid who signed as chair of a committee brought no bill of their own in: a
 * burgerinitiatief (its title says so) is handed over by the committee, so neither is called
 * an initiatiefvoorstel of the Kamerlid.
 */
const forCommittee = (p: Proposer, title: string | null | undefined) =>
	p.capacity === 'kamerlid' &&
	(/^burgerinitiatief/i.test(title?.trim() ?? '') ||
		/^voorzitter van de .*commissie/i.test(p.function ?? ''));

export function proposal(p: Proposer | null | undefined, title?: string | null): Proposal | null {
	if (!p) return null;
	const name = p.name?.trim() || null;
	const committee = forCommittee(p, title);
	const lead =
		p.capacity === 'bewindspersoon'
			? name
				? 'Voorstel van de regering, ingediend door'
				: 'Voorstel van de regering'
			: committee
				? /^burgerinitiatief/i.test(title?.trim() ?? '')
					? 'Burgerinitiatief, ingediend door'
					: 'Ingediend door'
				: p.capacity === 'kamerlid'
					? 'Initiatiefvoorstel van'
					: name
						? 'Ingediend door'
						: '';
	if (!lead) return null;
	return {
		lead,
		name,
		memberKey: p.member_key ?? null,
		function: p.capacity === 'kamerlid' && !committee ? null : p.function?.trim() || null
	};
}

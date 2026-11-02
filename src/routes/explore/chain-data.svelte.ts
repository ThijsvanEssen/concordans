// What the weergave Keten asks of a law. Its regulations and grondslag first, all it waits for:
// cold they take seconds on one of the API's few workers of the cache (the Awb: 11 s, prod
// 2 Nov), so what the keten can add later (its EU acts, the laws that name it) comes after them,
// as does all the werkplek asks besides (chainFirst).
import { getLawBasis, getLawDelegatedSummary } from '$lib/api/articles';
import { isNotFound, report } from '$lib/api/errors';
import { getEuLinks, getRelatedInstruments } from '$lib/api/verbonden';

type Validity = 'in_force' | 'all';

export class ChainData {
	/** The regulations of the law, and the laws above it (null: none could be asked). */
	asked = $state.raw<{
		bwb: string;
		validity: Validity;
		delegated: Awaited<ReturnType<typeof getLawDelegatedSummary>>;
		basis: Awaited<ReturnType<typeof getLawBasis>> | null;
	} | null>(null);
	/** Its EU acts (null: none could be asked). */
	eu = $state.raw<{ bwb: string; eu: Awaited<ReturnType<typeof getEuLinks>> | null } | null>(null);
	/** The laws that only name the keten's law in their text, asked once Noemt is on. */
	refers = $state.raw<{
		bwb: string;
		items: Awaited<ReturnType<typeof getRelatedInstruments>>['items'];
	} | null>(null);

	constructor(
		law: () => string | null,
		validity: () => Validity,
		/** Read to ask again (Opnieuw). */
		tries: () => number,
		/** Noemt is on, and the keten is a law's: an article names no law that refers to it. */
		mentions: () => boolean,
		/** A new keten is asked: its failure of before is gone. */
		onAsk: () => void,
		onFailure: (bwb: string, error: unknown) => void
	) {
		$effect(() => {
			const bwb = law();
			const kept = validity();
			void tries();
			if (!bwb) return;
			let current = true;
			onAsk();
			const basis = getLawBasis(bwb).catch((e) => {
				report('Keten grondslag', e);
				return null;
			});
			Promise.all([getLawDelegatedSummary(bwb, kept), basis])
				.then(([delegated, basis]) => {
					if (!current) return;
					this.asked = { bwb, validity: kept, delegated, basis };
					if (this.eu?.bwb === bwb) return;
					return getEuLinks(bwb).then(
						(eu) => {
							if (current) this.eu = { bwb, eu };
						},
						(e) => {
							if (!isNotFound(e)) report('Keten EU', e);
							if (current) this.eu = { bwb, eu: null };
						}
					);
				})
				.catch((e) => {
					report('Keten', e);
					if (current) onFailure(bwb, e);
				});
			return () => {
				current = false;
			};
		});
		$effect(() => {
			const bwb = law();
			if (!bwb || this.asked?.bwb !== bwb) return;
			if (!mentions() || this.refers?.bwb === bwb) return;
			let current = true;
			getRelatedInstruments(bwb, 200)
				.then((r) => {
					if (current) this.refers = { bwb, items: r.items };
				})
				.catch((e) => report('Keten noemt', e));
			return () => {
				current = false;
			};
		});
	}
}

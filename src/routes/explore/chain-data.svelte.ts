// What the weergave Keten asks of a law. Its regulations and grondslag first, all it waits for:
// cold they take seconds on one of the API's few workers of the cache (the Awb: 11 s, prod
// 2 Nov), so what the keten can add later (its EU acts, the laws that name it) comes after them,
// as does all the werkplek asks besides (chainFirst).
import { getLawBasis, getLawDelegatedSummary } from '$lib/api/articles';
import { isNotFound, report } from '$lib/api/errors';
import type { GraphNode } from '$lib/graph/types';
import { lawIdOf } from '$lib/graph/types';
import { bronFullName, bronNaam } from '$lib/bron/naam';
import type { InstrumentMeta } from '$lib/text/instrument-meta';
import { textOf } from '$lib/text/words';
import { getEuLinks, getRelatedInstruments } from '$lib/api/verbonden';

type Validity = 'in_force' | 'all';
type Delegated = Awaited<ReturnType<typeof getLawDelegatedSummary>>;

/** A chosen law that may stand beside the keten's: its node id, BWB id and names. */
export type BesideLaw = { id: string; bwb: string; name: string; abbreviation: string };

/** The chosen laws other than the start: each may share a regulation with the keten. */
export function besideLaws(
	chosen: readonly GraphNode[],
	start: GraphNode | null,
	meta: Map<string, InstrumentMeta>
): BesideLaw[] {
	if (start?.collection !== 'instruments') return [];
	return chosen
		.filter((n) => n.id !== start.id && n.collection === 'instruments')
		.filter((n) => /^(?:wet|rijkswet|)$/i.test(textOf(n.raw?.props?.kind) ?? ''))
		.map((n) => ({
			id: n.id,
			bwb: lawIdOf(n.raw?.props) ?? n.key.toUpperCase(),
			name: bronFullName(n, meta),
			abbreviation: bronNaam(n, meta)
		}));
}

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

	/** The other chosen laws with their regulations: those that may stand beside the keten's. */
	private beside = $state.raw<{
		validity: Validity;
		laws: { law: BesideLaw; delegated: Delegated }[];
	} | null>(null);

	/** The laws beside the keten's that share a regulation with it, as `chain` takes them. */
	sisters(validity: Validity) {
		return this.beside?.validity === validity
			? this.beside.laws.map(({ law, delegated }) => ({
					id: law.id,
					name: law.name,
					abbreviation: law.abbreviation,
					delegated
				}))
			: [];
	}

	constructor(
		law: () => string | null,
		validity: () => Validity,
		/** Read to ask again (Opnieuw). */
		tries: () => number,
		/** Noemt is on, and the keten is a law's: an article names no law that refers to it. */
		mentions: () => boolean,
		/** A new keten is asked: its failure of before is gone. */
		onAsk: () => void,
		onFailure: (bwb: string, error: unknown) => void,
		/** The other chosen laws: their regulations come after the keten's own. */
		others: () => readonly BesideLaw[]
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
			const kept = validity();
			const laws = others();
			if (!bwb || this.asked?.bwb !== bwb || !laws.length) return;
			let current = true;
			Promise.all(
				laws.map((law) =>
					getLawDelegatedSummary(law.bwb, kept).catch((e) => (report('Keten zusterwet', e), null))
				)
			)
				.then((found) => {
					if (current)
						this.beside = {
							validity: kept,
							laws: laws.map((law, i) => ({ law, delegated: found[i] }))
						};
				})
				.catch((e) => report('Keten zusterwetten', e));
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

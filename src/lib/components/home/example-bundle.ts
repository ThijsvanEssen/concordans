// The Bundel of the start page: a research question kept with an article, a judgment and
// a note, as a shared link (`/gemarkeerd#m=…`, $lib/map/share). The link is fixed, so the
// card needs no work on load; a test keeps it equal to the bundel below.
import { bewaarItem, itemHref, type Map } from '$lib/map/map';

export const EXAMPLE_BUNDLE: Pick<
	Map,
	'naam' | 'notitie' | 'volgorde' | 'groepNotities' | 'items'
> = {
	naam: 'Aansprakelijkheid werkgever thuiswerk',
	notitie: 'Vraag: valt een RSI-klacht bij thuiswerk onder art. 7:658 BW?',
	volgorde: 'groep',
	groepNotities: {},
	items: [
		{
			...bewaarItem(
				'articles/bwbr0005290_658',
				{
					kort: 'art. 7:658 lid 1 BW',
					voluit: 'artikel 7:658 lid 1 Burgerlijk Wetboek',
					at: 'lid-1'
				},
				{ wet: 'BWBR0005290', groep: 'Burgerlijk Wetboek Boek 7' }
			),
			notitie: 'Zorgplicht, ook thuis?'
		},
		bewaarItem(
			'articles/bwbr0005290_611',
			{ kort: 'art. 7:611 BW', voluit: 'artikel 7:611 Burgerlijk Wetboek' },
			{ wet: 'BWBR0005290', groep: 'Burgerlijk Wetboek Boek 7' }
		),
		bewaarItem(
			'judgments/ecli_nl_hr_2005_au3313',
			{ kort: 'HR 11 november 2005, ECLI:NL:HR:2005:AU3313' },
			{ groep: 'HR 11 november 2005' }
		)
	]
};

/** The link of the bundel above, as Gemarkeerd's Kopieer link gives it. */
export const EXAMPLE_BUNDLE_HREF =
	'/gemarkeerd#m=tZLRS8MwEMb_lSPPnW035jQvsomw4fBhogNFSroebdY0KWnaIWP_u1e66cZUfPElcPm-I78vd1umhSgYZ2Ohq9KKHJVc5xnKBDZo8xQbtOCyWlZtyTwmHRYV469bJhNqE9bJlcLKjzexDYJg2L8OosvhFTmFI13JpBdSkRvrOvsFjDgZgBQIYbIksTGqlntZEsGpo7Yp2pYKluhigy1Fag2W1HAuwqQ9Rp2nLu_xnWwbdPwIkERtnHQSSXsxNi2VXGXOA2PyLuwN23m_JgzDQ8LzcOEvscL_CfRJu66TtEDtKh9XSkZaRZmN-uSKRD0YhINz6ukCCEqbBouYZt16Pbi7nc_4w5xPF7y94OOnffOB85uuU8I_gJSiJfbpj7rN0_4Pz-7ejgf2bIVIOTRCOUDUsHic9XIlaIAQy_XXsoLRCaEdrdxkSXP9AA';

/** The card's lines: each kept bron by its citation, to its place; the first one's note. */
export const EXAMPLE_LINES = EXAMPLE_BUNDLE.items.map((item) => ({
	id: item.id,
	collection: item.id.startsWith('judgments/') ? ('judgments' as const) : ('articles' as const),
	label: item.kort,
	href: itemHref(item)
}));
export const EXAMPLE_TITLE = EXAMPLE_BUNDLE.naam;
export const EXAMPLE_NOTE = EXAMPLE_BUNDLE.items[0].notitie ?? '';

// Where a day of votes in the procedure leads (Thijs, 10 Oct): to the amendementen in the
// reader, opened and in view, or to the votes of the Tweede Kamer in Verbonden.
import { zetOpen } from '$lib/components/ui/dicht.svelte';
import { openGroup } from '$lib/verbonden/open-group';

export const AMENDEMENTEN_ID = 'amendementen';

export function naarAmendementen() {
	zetOpen('Amendementen', true);
	requestAnimationFrame(() =>
		document.getElementById(AMENDEMENTEN_ID)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
	);
}

export const naarStemmingen = () => openGroup('decisions');

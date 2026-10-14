// Where a day of votes in the procedure leads (Thijs, 10 Oct): to the amendementen in the
// reader, opened and in view, or to the votes of the Tweede Kamer in Verbonden. The section
// is opened and found by one key (FOLD.amendments), its anchor too.
import { FOLD, zetOpen } from '$lib/components/ui/dicht.svelte';
import { openGroup } from '$lib/verbonden/open-group';

export function naarAmendementen() {
	zetOpen(FOLD.amendments, true);
	requestAnimationFrame(() =>
		document.getElementById(FOLD.amendments)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
	);
}

export const naarStemmingen = () => openGroup('decisions');

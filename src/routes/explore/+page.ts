import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { buildBronHref } from '$lib/bron/href';
import { versieDoelOfFocus } from '$lib/bron/versie';

// A version of a law is read as its law on the day it began (bron/versie.ts): an old or shared
// link to one goes there at once, in place of the empty version.
export const load: PageLoad = ({ url }) => {
	const focus = url.searchParams.get('focus');
	if (focus && versieDoelOfFocus(focus)) redirect(307, buildBronHref(null, focus));
};

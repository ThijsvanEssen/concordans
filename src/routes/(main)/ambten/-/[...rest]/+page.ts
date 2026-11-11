// The old address of an office without a ministry (/ambten/-/minister/werk-en-participatie), as
// the sitemap named it until its seat lost the "-": it moves to /ambten/minister/werk-en-participatie.
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { OFFICES_PATH } from '$lib/offices/office';

export const load: PageLoad = ({ params, url }) =>
	redirect(308, `${OFFICES_PATH}/${params.rest}${url.search}${url.hash}`);

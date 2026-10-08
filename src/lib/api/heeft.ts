// Whether a list route of the API takes a query parameter, by the schema this build was made
// with (vite.config, `__API_LIST_PARAMS__`). A filter the API does not take yet stays hidden,
// and shows once `npm run sync:api` brings the parameter in (Thijs, 9 Oct: the period in
// every list with dates).

export const heeftParameter = (route: string, ...namen: string[]): boolean => {
	const params = __API_LIST_PARAMS__[route] ?? [];
	return namen.every((n) => params.includes(n));
};

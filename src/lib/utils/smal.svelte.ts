// The width below which a horizontal figure becomes text (the posts of a cabinet, Naast
// elkaar): the phone of every page, 767px as in the stylesheets. Call it while a component
// sets up; it follows the window as it is turned or resized.
export function smalScherm(): { readonly smal: boolean } {
	const scherm = $state({ smal: false });
	$effect(() => {
		const query = window.matchMedia('(max-width: 767px)');
		scherm.smal = query.matches;
		const change = () => (scherm.smal = query.matches);
		query.addEventListener('change', change);
		return () => query.removeEventListener('change', change);
	});
	return scherm;
}

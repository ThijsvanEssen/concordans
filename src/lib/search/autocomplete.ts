export type Suggestion = {
	label: string;
	kind: 'article' | 'judgment' | 'node';
	href: string;
};

export async function getAutocompleteSuggestions(
	query: string,
	_profileId: string
): Promise<Suggestion[]> {
	if (!query.trim()) {
		return [];
	}

	// TODO: Backend needs an endpoint that returns relevant article, judgment, and node suggestions per profile.
	// TODO: Frontend must fetch from that endpoint, render a keyboard-navigable dropdown, and keep it in sync with the active profile.
	return [];
}

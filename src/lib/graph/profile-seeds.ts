export type ProfileSeed = {
	collection: string;
	key: string;
	label?: string;
};

export const profileSeeds: Record<string, ProfileSeed[]> = {
	strafrecht: [{ collection: 'instrument_articles', key: 'BWBR0001854_287', label: 'Art. 287 Sr' }],
	bestuursrecht: [
		{ collection: 'instrument_articles', key: 'BWBR0001854_287', label: 'Art. 287 Sr' }
	],
	belasting: [{ collection: 'instrument_articles', key: 'BWBR0001854_287', label: 'Art. 287 Sr' }],
	alles: [{ collection: 'instrument_articles', key: 'BWBR0001854_287', label: 'Art. 287 Sr' }]
};

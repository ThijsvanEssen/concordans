import { writable, derived } from 'svelte/store';

export type ProfileId = 'strafrecht' | 'bestuursrecht' | 'belasting' | 'alles';

export type Profile = {
	id: ProfileId;
	label: string;
	description?: string;
};

const AVAILABLE_PROFILES: Profile[] = [
	{ id: 'strafrecht', label: 'Strafrecht', description: 'Focus op WvSr, Sv, WVW, etc.' },
	{ id: 'bestuursrecht', label: 'Bestuursrecht', description: 'Raad van State, Awb, etc.' },
	{ id: 'belasting', label: 'Belastingrecht', description: 'AWR, Wet IB, etc.' },
	{ id: 'alles', label: 'Alle domeinen', description: 'Geen profiel-filter, alles tonen.' }
];

const initialProfile: ProfileId = 'strafrecht';

export const activeProfileId = writable<ProfileId>(initialProfile);
export const profiles = writable<Profile[]>(AVAILABLE_PROFILES);

export const activeProfile = derived(
	[profiles, activeProfileId],
	([$profiles, $id]) => $profiles.find((p) => p.id === $id) ?? $profiles[0]
);

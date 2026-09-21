import { writable } from 'svelte/store';

export type ReaderState = {
	activeArticleId: string | null;
	focusedCitationKey: string | null;
};

export const readerStore = writable<ReaderState>({
	activeArticleId: null,
	focusedCitationKey: null
});

export function setActiveArticle(articleId: string) {
	readerStore.update((s) => ({ ...s, activeArticleId: articleId }));
}

export function setFocusedCitation(citationKey: string | null) {
	readerStore.update((s) => ({ ...s, focusedCitationKey: citationKey }));
}

export function clearReader() {
	readerStore.set({ activeArticleId: null, focusedCitationKey: null });
}

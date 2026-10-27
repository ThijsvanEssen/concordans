// The groups as the panel counts them (the context of the bron, view.ts `contextGroups`): the
// filter sheet reads them, so its button and the head of Verbonden name one number.
export const panel = $state<{ groups: import('./groups').Group[] | null }>({ groups: null });

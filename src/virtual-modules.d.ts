// The modules vite.config.ts makes at build time.
declare module 'virtual:api-docs' {
	const docs: import('$lib/api/docs').ApiDocs;
	export default docs;
}

declare module 'virtual:api-limits' {
	const maxima: Record<string, number>;
	export default maxima;
}

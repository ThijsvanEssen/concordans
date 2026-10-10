// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	/** The query parameters of the API's list routes, set at build from the schema (vite.config). */
	const __API_LIST_PARAMS__: Record<string, string[]>;
	interface Window {
		/** The timer in app.html that shows the server's text when the app does not mount. */
		__seoTerug?: ReturnType<typeof setTimeout>;
	}
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};

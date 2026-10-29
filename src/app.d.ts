// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	interface Window {
		/** The timer in app.html that shows the server's text when the app does not mount. */
		__seoTerug?: ReturnType<typeof setTimeout>;
	}
	namespace App {
		interface Error {
			message: string;
			/** The kenmerk of a 500 the API logged ($lib/api/errors.ts, kenmerkOf). */
			kenmerk?: string | null;
		}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			/** The Leespaneel was opened by a click on this page: closing it is a step back. */
			readOpened?: boolean;
			/** Of the articles in the Leespaneel, the one it opens at (its key): the one clicked. */
			readFocus?: string;
			/** The panel came from a row of Verbonden, which it stands over: ‹ Verbonden goes back. */
			readFrom?: 'verbonden';
		}
		// interface Platform {}
	}
}

export {};

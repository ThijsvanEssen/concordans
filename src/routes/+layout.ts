// The app is served as static files with index.html for every path (svelte.config.js): no
// page is rendered on a server. The dev server and `vite preview` (the browser suite) do the
// same, so a click or a key before the app has started is what it is on the site, not a
// hydration's.
export const ssr = false;

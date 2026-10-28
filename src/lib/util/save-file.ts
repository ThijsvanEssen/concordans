/** `text` in characters every file system accepts, `max` at most; '' where nothing is left. */
export const safeFileName = (text: string, max = 120): string =>
	text
		// eslint-disable-next-line no-control-regex
		.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
		.replace(/\s+/g, ' ')
		.replace(/^[.\s]+|[.\s]+$/g, '')
		.slice(0, max)
		.trim();

/** Hands the browser a file to save. */
export function download(name: string, text: string, type = 'text/csv') {
	const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

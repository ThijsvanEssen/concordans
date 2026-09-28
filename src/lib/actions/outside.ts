/** Whether a click inside a clickable row landed on a control of its own (a link, a button). */
export const onControl = (e: Event) =>
	e.target instanceof Element && e.target !== e.currentTarget && !!e.target.closest('a, button');

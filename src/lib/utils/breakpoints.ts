// The phone, as the stylesheets write it: 768 px and narrower (Thijs, 14 Oct). A stylesheet
// cannot read a variable in `@media`, so it writes the same two widths; the breakpoint guard
// in style-scale.test holds them to these.
export const PHONE = '(max-width: 768px)';
/** Wider than a phone: a column beside another. */
export const BESIDE = '(min-width: 769px)';
/** The read view wide enough for Verbonden beside the text; narrower, both are tabs. */
export const READ_BESIDE = '(min-width: 1101px)';

// Dutch order, with numbers as numbers: 2 before 10, artikel 2a after artikel 2. One
// collator for the app: a sort that asks localeCompare with a locale builds one per
// comparison, sixteen times slower on the 456 bronnen of the Awb's canvas.
export const NL = new Intl.Collator('nl', { numeric: true });

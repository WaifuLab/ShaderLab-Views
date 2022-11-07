import { Facet } from "./facet.js";
export const languageData = Facet.define();
export const allowMultipleSelections = Facet.define({
    combine: values => values.some(v => v),
    static: true
});
export const lineSeparator = Facet.define({
    combine: values => values.length ? values[0] : undefined,
    static: true
});
export const changeFilter = Facet.define();
export const transactionFilter = Facet.define();
export const transactionExtender = Facet.define();
export const readOnly = Facet.define({
    combine: values => values.length ? values[0] : false
});

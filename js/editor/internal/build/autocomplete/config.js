import { Facet, combineConfig } from "../state/index.js";
export const completionConfig = Facet.define({
    combine(configs) {
        return combineConfig(configs, {
            activateOnTyping: true,
            selectOnOpen: true,
            override: null,
            closeOnBlur: true,
            maxRenderedOptions: 100,
            defaultKeymap: true,
            optionClass: () => "",
            aboveCursor: false,
            icons: true,
            addToOptions: [],
            compareCompletions: (a, b) => a.label.localeCompare(b.label),
            interactionDelay: 75
        }, {
            defaultKeymap: (a, b) => a && b,
            closeOnBlur: (a, b) => a && b,
            icons: (a, b) => a && b,
            optionClass: (a, b) => c => joinClass(a(c), b(c)),
            addToOptions: (a, b) => a.concat(b)
        });
    }
});
function joinClass(a, b) {
    return a ? b ? a + " " + b : a : b;
}

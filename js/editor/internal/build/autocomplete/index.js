import { Prec } from "../state/index.js";
import { keymap } from "../view/index.js";
import { completionState, setSelectedEffect } from "./state.js";
import { completionConfig } from "./config.js";
import { completionPlugin, moveCompletionSelection, acceptCompletion, startCompletion, closeCompletion } from "./view.js";
import { baseTheme } from "./theme.js";
export { snippet, snippetCompletion, nextSnippetField, prevSnippetField, clearSnippet, snippetKeymap } from "./snippet.js";
export { CompletionContext, pickedCompletion, completeFromList, ifIn, ifNotIn, insertCompletionText } from "./completion.js";
export { startCompletion, closeCompletion, acceptCompletion, moveCompletionSelection } from "./view.js";
export { completeAnyWord } from "./word.js";
export { closeBrackets, closeBracketsKeymap, deleteBracketPair, insertBracket } from "./closebrackets.js";
/** @return Returns an extension that enables autocompletion. */
export function autocompletion(config = {}) {
    return [
        completionState,
        completionConfig.of(config),
        completionPlugin,
        completionKeymapExt,
        baseTheme
    ];
}
/**
 * Basic keybindings for autocompletion.
 *
 *  - Ctrl-Space: {@link startCompletion}
 *  - Escape: {@link closeCompletion}
 *  - ArrowDown: {@link moveCompletionSelection}`(true)`
 *  - ArrowUp: {@link moveCompletionSelection}`(false)`
 *  - PageDown: {@link moveCompletionSelection}`(true, "page")`
 *  - PageDown: {@link moveCompletionSelection}`(true, "page")`
 *  - Enter: {@link acceptCompletion}
 */
export const completionKeymap = [
    { key: "Ctrl-Space", run: startCompletion },
    { key: "Escape", run: closeCompletion },
    { key: "ArrowDown", run: moveCompletionSelection(true) },
    { key: "ArrowUp", run: moveCompletionSelection(false) },
    { key: "PageDown", run: moveCompletionSelection(true, "page") },
    { key: "PageUp", run: moveCompletionSelection(false, "page") },
    { key: "Enter", run: acceptCompletion }
];
const completionKeymapExt = Prec.highest(keymap.computeN([completionConfig], state => state.facet(completionConfig).defaultKeymap ? [completionKeymap] : []));
/**
 * Get the current completion status.
 * @return When completions are available, this will return `"active"`.
 *         When completions are pending (in the process of being queried), this returns `"pending"`. Otherwise, it returns `null`.
 */
export function completionStatus(state) {
    let cState = state.field(completionState, false);
    return cState && cState.active.some(a => a.state == 1 /* State.Pending */) ? "pending" :
        cState && cState.active.some(a => a.state != 0 /* State.Inactive */) ? "active" : null;
}
const completionArrayCache = new WeakMap;
/** Returns the available completions as an array. */
export function currentCompletions(state) {
    let open = state.field(completionState, false)?.open;
    if (!open)
        return [];
    let completions = completionArrayCache.get(open.options);
    if (!completions)
        completionArrayCache.set(open.options, completions = open.options.map(o => o.completion));
    return completions;
}
/** Return the currently selected completion, if any. */
export function selectedCompletion(state) {
    let open = state.field(completionState, false)?.open;
    return open && open.selected >= 0 ? open.options[open.selected].completion : null;
}
/** Returns the currently selected position in the active completion list, or null if no completions are active. */
export function selectedCompletionIndex(state) {
    let open = state.field(completionState, false)?.open;
    return open && open.selected >= 0 ? open.selected : null;
}
/** Create an effect that can be attached to a transaction to change the currently selected completion. */
export function setSelectedCompletion(index) {
    return setSelectedEffect.of(index);
}

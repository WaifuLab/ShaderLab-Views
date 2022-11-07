import { Extension, EditorState, StateEffect } from "../state/index.js";
import { KeyBinding } from "../view/index.js";
import { Completion } from "./completion.js";
import { CompletionConfig } from "./config.js";
export { snippet, snippetCompletion, nextSnippetField, prevSnippetField, clearSnippet, snippetKeymap } from "./snippet.js";
export { Completion, CompletionContext, CompletionSource, CompletionResult, pickedCompletion, completeFromList, ifIn, ifNotIn, insertCompletionText } from "./completion.js";
export { startCompletion, closeCompletion, acceptCompletion, moveCompletionSelection } from "./view.js";
export { completeAnyWord } from "./word.js";
export { CloseBracketConfig, closeBrackets, closeBracketsKeymap, deleteBracketPair, insertBracket } from "./closebrackets.js";
/** @return Returns an extension that enables autocompletion. */
export declare function autocompletion(config?: CompletionConfig): Extension;
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
export declare const completionKeymap: readonly KeyBinding[];
/**
 * Get the current completion status.
 * @return When completions are available, this will return `"active"`.
 *         When completions are pending (in the process of being queried), this returns `"pending"`. Otherwise, it returns `null`.
 */
export declare function completionStatus(state: EditorState): null | "active" | "pending";
/** Returns the available completions as an array. */
export declare function currentCompletions(state: EditorState): readonly Completion[];
/** Return the currently selected completion, if any. */
export declare function selectedCompletion(state: EditorState): Completion | null;
/** Returns the currently selected position in the active completion list, or null if no completions are active. */
export declare function selectedCompletionIndex(state: EditorState): number | null;
/** Create an effect that can be attached to a transaction to change the currently selected completion. */
export declare function setSelectedCompletion(index: number): StateEffect<unknown>;

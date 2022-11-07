import { KeyBinding } from "../view/index.js";
import { EditorState, Transaction, StateCommand, Facet } from "../state/index.js";
import { Completion } from "./completion.js";
/**
 * Convert a snippet template to a function that can [apply]{@link Completion.apply} it.
 * Snippets are written using syntax like this:
 *
 * @example
 *   "for (let ${index} = 0; ${index} < ${end}; ${index}++) {\n\t${}\n}"
 *
 * Each `${}` placeholder (you may also use `#{}`) indicates a field that the user can fill
 * in. Its name, if any, will be the default content for the field.
 */
export declare function snippet(template: string): (editor: {
    state: EditorState;
    dispatch: (tr: Transaction) => void;
}, _completion: Completion, from: number, to: number) => void;
/** A command that clears the active snippet, if any. */
export declare const clearSnippet: StateCommand;
/** Move to the next snippet field, if available. */
export declare const nextSnippetField: StateCommand;
/** Move to the previous snippet field, if available. */
export declare const prevSnippetField: StateCommand;
/** A facet that can be used to configure the key bindings used by snippets. */
export declare const snippetKeymap: Facet<readonly KeyBinding[], readonly KeyBinding[]>;
/** Create a completion from a snippet. */
export declare function snippetCompletion(template: string, completion: Completion): Completion;

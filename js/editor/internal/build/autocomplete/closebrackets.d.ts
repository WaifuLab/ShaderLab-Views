import { KeyBinding } from "../view/index.js";
import { EditorState, Transaction, Extension, StateCommand } from "../state/index.js";
/**
 * Configures bracket closing behavior for a syntax (via [language data]{@link EditorState.languageDataAt})
 * using the `"closeBrackets"` identifier.
 */
export interface CloseBracketConfig {
    /**
     * The opening brackets to close. Defaults to `["(", "[", "{", "'", '"']`. Brackets may be single
     * characters or a triple of quotes (as in `"''''"`).
     */
    brackets?: string[];
    /** Characters in front of which newly opened brackets are automatically closed. */
    before?: string;
    /**
     * When determining whether a given node may be a string, recognize these prefixes before the opening
     * quote.
     */
    stringPrefixes?: string[];
}
/**
 * Extension to enable bracket-closing behavior. When a closeable bracket is typed, its closing bracket
 * is immediately inserted after the cursor. When closing a bracket directly in front of a closing bracket
 * inserted by the extension, the cursor moves over that bracket.
 */
export declare function closeBrackets(): Extension;
/** Command that implements deleting a pair of matching brackets when the cursor is between them. */
export declare const deleteBracketPair: StateCommand;
/** Close-brackets related key bindings. Binds Backspace to {@link deleteBracketPair}. */
export declare const closeBracketsKeymap: readonly KeyBinding[];
/**
 * Implements the extension's behavior on text insertion. If the given string counts as a bracket in the
 * language around the selection, and replacing the selection with it requires custom behavior (inserting
 * a closing version or skipping past a previously-closed bracket), this function returns a transaction
 * representing that custom behavior. (You only need this if you want to programmatically insert brackets
 * —the {@link closeBrackets} extension will take care of running this for user input.)
 */
export declare function insertBracket(state: EditorState, bracket: string): Transaction | null;

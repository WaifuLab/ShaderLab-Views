import { StateCommand } from "../state/index.js";
/**
 * An object of this type can be provided as [language data]{@link languageDataAt} under a
 * `"commentTokens"` property to configure comment syntax for a language.
 */
export interface CommentTokens {
    block?: {
        open: string;
        close: string;
    };
    line?: string;
}
/** Comment or uncomment the current selection. Will use line comments if available, otherwise falling back to block comments. */
export declare const toggleComment: StateCommand;
/** Comment or uncomment the current selection using line comments. The line comment syntax is taken from the {@link CommentTokens} [language data]{@link languageDataAt} */
export declare const toggleLineComment: StateCommand;
/** Comment the current selection using line comments. */
export declare const lineComment: StateCommand;
/** Uncomment the current selection using line comments. */
export declare const lineUncomment: StateCommand;
/** Comment or uncomment the current selection using block comments. The block comment syntax is taken from the {@link CommentTokens} [language data]{@link languageDataAt} */
export declare const toggleBlockComment: StateCommand;
/** Comment the current selection using block comments. */
export declare const blockComment: StateCommand;
/** Uncomment the current selection using block comments. */
export declare const blockUncomment: StateCommand;
/** Comment or uncomment the lines around the current selection using block comments. */
export declare const toggleBlockCommentByLine: StateCommand;

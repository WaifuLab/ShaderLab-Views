import { EditorView, Command, KeyBinding, Panel } from "../view/index.js";
import { EditorState, StateCommand, Extension, Text } from "../state/index.js";
import { SearchCursor } from "./cursor.js";
interface SearchConfig {
    /** Whether to position the search panel at the top of the editor (the default is at the bottom). */
    top?: boolean;
    /** Whether to enable case sensitivity by default when the search panel is activated (defaults to false). */
    caseSensitive?: boolean;
    /** Whether to treat string searches literally by default (defaults to false). */
    literal?: boolean;
    /** Controls whether the default query has by-word matching enabled. Defaults to false. */
    wholeWord?: boolean;
    /**
     * Can be used to override the way the search panel is implemented.
     * Should create a {@link Panel} that contains a form which lets the user:
     *
     *  - See the [current]{@link getSearchQuery} search query.
     *  - Manipulate the [query]{@link SearchQuery} and [update]{@link setSearchQuery} the search state with a new query.
     *  - Notice external changes to the query by reacting to the appropriate [state effect]{@link setSearchQuery}.
     *  - Run some of the search commands.
     */
    createPanel?: (view: EditorView) => Panel;
}
/**
 * Add search state to the editor configuration, and optionally configure the search extension.
 * ({@link openSearchPanel} will automatically enable this if it isn't already on).
 */
export declare function search(config?: SearchConfig): Extension;
/** A search query. Part of the editor's search state. */
export declare class SearchQuery {
    /** The search string (or regular expression). */
    readonly search: string;
    /** Indicates whether the search is case-sensitive. */
    readonly caseSensitive: boolean;
    /**
     * By default, string search will replace `\n`, `\r`, and `\t` in the query with newline,
     * return, and tab characters. When this is set to true, that behavior is disabled.
     */
    readonly literal: boolean;
    /** Then true, the search string is interpreted as a regular expression. */
    readonly regexp: boolean;
    /** The replace text, or the empty string if no replace text has been given. */
    readonly replace: string;
    /** Whether this query is non-empty and, in case of a regular expression search, syntactically valid. */
    readonly valid: boolean;
    /** When true, matches that contain words are ignored when there are further word characters around them. */
    readonly wholeWord: boolean;
    readonly unquoted: string;
    /**
     * Create a query object.
     * @param config.search The search string.
     * @param [config.cassSensitive] Controls whether the search should be case-sensitive.
     * @param [config.literal] By default, string search will replace `\n`, `\r`, and `\t` in
     *                         the query with newline, return, and tab characters. When this
     *                         is set to true, that behavior is disabled.
     * @param [config.regexp] When true, interpret the search string as a regular expression.
     * @param [config.replace] The replace text.
     * @param [config.wholeWord] Enable whole-word matching.
     */
    constructor(config: {
        search: string;
        caseSensitive?: boolean;
        literal?: boolean;
        regexp?: boolean;
        replace?: string;
        wholeWord?: boolean;
    });
    unquote(text: string): string;
    /** Compare this query to another query. */
    eq(other: SearchQuery): boolean;
    create(): QueryType;
    /** Get a search cursor for this query, searching through the given range in the given state. */
    getCursor(state: EditorState | Text, from?: number, to?: number): Iterator<{
        from: number;
        to: number;
    }>;
}
declare type SearchResult = typeof SearchCursor.prototype.value;
declare abstract class QueryType<Result extends SearchResult = SearchResult> {
    readonly spec: SearchQuery;
    constructor(spec: SearchQuery);
    abstract nextMatch(state: EditorState, curFrom: number, curTo: number): Result | null;
    abstract prevMatch(state: EditorState, curFrom: number, curTo: number): Result | null;
    abstract getReplacement(result: Result): string;
    abstract matchAll(state: EditorState, limit: number): readonly Result[] | null;
    abstract highlight(state: EditorState, from: number, to: number, add: (from: number, to: number) => void): void;
}
/**
 * A state effect that updates the current search query. Note that this only has an effect if the search
 * state has been initialized (by including {@link search} in your configuration or by running
 * {@link openSearchPanel} at least once).
 */
export declare const setSearchQuery: import("../state/transaction").StateEffectType<SearchQuery>;
/** Get the current search query from an editor state. */
export declare function getSearchQuery(state: EditorState): SearchQuery;
/** Query whether the search panel is open in the given editor state. */
export declare function searchPanelOpen(state: EditorState): boolean;
/**
 * Open the search panel if it isn't already open, and move the selection to the first match
 * after the current main selection. Will wrap around to the start of the document when it
 * reaches the end.
 */
export declare const findNext: Command;
/**
 * Move the selection to the previous instance of the search query, before the current main selection.
 * Will wrap past the start of the document to start searching at the end again.
 */
export declare const findPrevious: Command;
/** Select all instances of the search query. */
export declare const selectMatches: Command;
/** Select all instances of the currently selected text. */
export declare const selectSelectionMatches: StateCommand;
/** Replace the current match of the search query. */
export declare const replaceNext: Command;
/** Replace all instances of the search query with the given replacement. */
export declare const replaceAll: Command;
/** Make sure the search panel is open and focused. */
export declare const openSearchPanel: Command;
/** Close the search panel. */
export declare const closeSearchPanel: Command;
/**
 * Default search-related key bindings.
 *
 *  - Mod-f: {@link openSearchPanel}
 *  - F3, Mod-g: {@link findNext}
 *  - Shift-F3, Shift-Mod-g: {@link findPrevious}
 *  - Alt-g: {@link gotoLine}
 *  - Mod-d: {@link selectNextOccurrence}
 */
export declare const searchKeymap: readonly KeyBinding[];
export {};

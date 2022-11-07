import { EditorView } from "../view/index.js";
import { EditorState, TransactionSpec } from "../state/index.js";
import { ActiveResult } from "./state.js";
/** Objects type used to represent individual completions */
export interface Completion {
    /**
     * The label to show in the completion picker. This is what input is matched agains to determine
     * whether a completion matches (and how well it matches).
     */
    label: string;
    /** An optional short piece of information to show (with a different style) after the label. */
    detail?: string;
    /**
     * Additional info to show when the completion is selected. Can be a plain string or a function
     * that'll render the DOM structure to show when invoked.
     */
    info?: string | ((completion: Completion) => (Node | null | Promise<Node | null>));
    /**
     * How to apply the completion. The default is to replace it with its [label]{@link Completion.label}.
     * When this holds a string, the completion range is replaced by that string. When it is a function,
     * that function is called to perform the completion. If it fires a transaction, it is responsible for
     * adding the {@link pickedCompletion} annotation to it.
     */
    apply?: string | ((view: EditorView, completion: Completion, from: number, to: number) => void);
    /**
     * The type of the completion. This is used to pick an icon to show for the completion. Icons are
     * styled with a CSS class created by appending the type name to `"cm-completionIcon-"`. You can
     * define or restyle icons by defining these selectors. The base library defines simple icons for
     * `class`, `constant`, `enum`, `function`, `interface`, `keyword`, `method`, `namespace`, `property`,
     * `text`, `type`, and `variable`. Multiple types can be provided by separating them with spaces.
     */
    type?: string;
    /**
     * When given, should be a number from -99 to 99 that adjusts how this completion is ranked compared
     * to other completions that match the input as well as this one. A negative number moves it down the
     * list, a positive number moves it up.
     */
    boost?: number;
}
/** An instance of this is passed to completion source functions */
export declare class CompletionContext {
    /** The editor state that the completion happens in. */
    readonly state: EditorState;
    /** The position at which the completion is happening. */
    readonly pos: number;
    /**
     * Indicates whether completion was activated explicitly, or implicitly by typing. The usual
     * way to respond to this is to only return completions when either there is part of a
     * completable entity before the cursor, or `explicit` is true.
     */
    readonly explicit: boolean;
    abortListeners: (() => void)[] | null;
    constructor(
    /** The editor state that the completion happens in. */
    state: EditorState, 
    /** The position at which the completion is happening. */
    pos: number, 
    /**
     * Indicates whether completion was activated explicitly, or implicitly by typing. The usual
     * way to respond to this is to only return completions when either there is part of a
     * completable entity before the cursor, or `explicit` is true.
     */
    explicit: boolean);
    /** Get the extent, content, and (if there is a token) type of the token before `this.pos`. */
    tokenBefore(types: readonly string[]): {
        from: number;
        to: number;
        text: string;
        type: import("../lezer/common/tree").NodeType;
    } | null;
    /** Get the match of the given expression directly before the cursor */
    matchBefore(expr: RegExp): {
        from: number;
        to: number;
        text: string;
    } | null;
    get aborted(): boolean;
    /**
     * Allows you to register abort handlers, which will be called when the query is
     * {@link CompletionContext.aborted}.
     */
    addEventListener(type: "abort", listener: () => void): void;
}
/** Given a fixed array of options, return an autocompleter that completes them. */
export declare function completeFromList(list: readonly (string | Completion)[]): CompletionSource;
/**
 * Wrap the given completion source so that it will only fire when the cursor is in a syntax node with
 * one of the given names.
 */
export declare function ifIn(nodes: readonly string[], source: CompletionSource): CompletionSource;
/**
 * Wrap the given completion source so that it will not fire when the cursor is in a syntax node with
 * one of the given names.
 */
export declare function ifNotIn(nodes: readonly string[], source: CompletionSource): CompletionSource;
/**
 * The function signature for a completion source. Such a function may return its
 * [result]{@link CompletionResult} synchronously or as a promise. Returning null
 * indicates no completions are available.
 */
export declare type CompletionSource = (context: CompletionContext) => CompletionResult | null | Promise<CompletionResult | null>;
export interface CompletionResult {
    /** The start of the range that is being completed. */
    from: number;
    /** The end of the range that is being completed. Defaults to the main cursor position. */
    to?: number;
    /**
     * The completions returned. These don't have to be compared with the input by the source—the
     * autocompletion system will do its own matching (against the text between `from` and `to`) and
     * sorting.
     */
    options: readonly Completion[];
    /**
     * When given, further typing or deletion that causes the part of the document between
     * ([mapped]{@link mapPos}) `from` and `to` to match this regular expression or predicate
     * function will not query the completion source again, but continue with this list of
     * options. This can help a lot with responsiveness, since it allows the completion list
     * to be updated synchronously.
     */
    validFor?: RegExp | ((text: string, from: number, to: number, state: EditorState) => boolean);
    /**
     * By default, the library filters and scores completions. Set `filter` to `false` to disable this,
     * and cause your completions to all be included, in the order they were given. When there are other
     * sources, unfiltered completions appear at the top of the list of completions. `validFor` must not
     * be given when `filter` is `false`, because it only works when filtering.
     */
    filter?: boolean;
    /**
     * When {@link filter} is set to `false`, this may be provided to compute the ranges on the label that
     * match the input. Should return an array of numbers where each pair of adjacent numbers provide the
     * start and end of a range.
     */
    getMatch?: (completion: Completion) => readonly number[];
    /**
     * Synchronously update the completion result after typing or deletion. If given, this should not do
     * any expensive work, since it will be called during editor state updates. The function should make
     * sure (similar to [`validFor`]{@link CompletionResult.validFor}) that the completion still applies
     * in the new state.
     */
    update?: (current: CompletionResult, from: number, to: number, context: CompletionContext) => CompletionResult | null;
}
export declare class Option {
    readonly completion: Completion;
    readonly source: ActiveResult;
    readonly match: readonly number[];
    constructor(completion: Completion, source: ActiveResult, match: readonly number[]);
}
export declare function cur(state: EditorState): number;
/**
 * Make sure the given regexp has a $ at its end.
 * @param expr target regexp.
 * @param start if `start` is true, a ^ at its start.
 */
export declare function ensureAnchor(expr: RegExp, start: boolean): RegExp;
/** This annotation is added to transactions that are produced by picking a completion. */
export declare const pickedCompletion: import("../state/transaction").AnnotationType<Completion>;
/**
 * Helper function that returns a transaction spec which inserts a completion's text in the main
 * selection range, and any other selection range that has the same text in front of it.
 */
export declare function insertCompletionText(state: EditorState, text: string, from: number, to: number): TransactionSpec;
export declare function applyCompletion(view: EditorView, option: Option): void;
export declare function asSource(source: CompletionSource | readonly (string | Completion)[]): CompletionSource;

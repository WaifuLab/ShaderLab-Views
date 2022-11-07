import { NodeProp, SyntaxNode } from "../lezer/common/index.js";
import { EditorState, Facet, StateField, Extension } from "../state/index.js";
import { EditorView, BlockInfo, Command, DecorationSet, KeyBinding, ViewUpdate } from "../view/index.js";
/**
 * A facet that registers a code folding service. When called with the extent of a line, such a function
 * should return a foldable range that starts on that line (but continues beyond it), if one can be found.
 */
export declare const foldService: Facet<(state: EditorState, lineStart: number, lineEnd: number) => ({
    from: number;
    to: number;
} | null), readonly ((state: EditorState, lineStart: number, lineEnd: number) => ({
    from: number;
    to: number;
} | null))[]>;
/**
 * This node prop is used to associate folding information with syntax node types. Given a syntax node,
 * it should check whether that tree is foldable and return the range that can be collapsed when it is.
 */
export declare const foldNodeProp: NodeProp<(node: SyntaxNode, state: EditorState) => ({
    from: number;
    to: number;
} | null)>;
/**
 * [Fold](#language.foldNodeProp) function that folds everything but the first and the last child of a
 * syntax node. Useful for nodes that start and end with delimiters.
 */
export declare function foldInside(node: SyntaxNode): {
    from: number;
    to: number;
} | null;
/**
 * Check whether the given line is foldable. First asks any fold services registered through
 * {@link foldService}, and if none of them return a result, tries to query the
 * [fold node prop]{@link foldNodeProp} of syntax nodes that cover the end of the line.
 */
export declare function foldable(state: EditorState, lineStart: number, lineEnd: number): {
    from: number;
    to: number;
} | null;
declare type DocRange = {
    from: number;
    to: number;
};
/**
 * State effect that can be attached to a transaction to fold the given range. (You probably only
 * need this in exceptional circumstances—usually you'll just want to let {@link foldCode} and the
 * [fold gutter]{@link foldGutter} create the transactions.)
 */
export declare const foldEffect: import("../state/transaction").StateEffectType<DocRange>;
/** State effect that unfolds the given range (if it was folded). */
export declare const unfoldEffect: import("../state/transaction").StateEffectType<DocRange>;
/**
 * The state field that stores the folded ranges (as a [decoration set]{@link DecorationSet}). Can be
 * passed to {@link toJSON} and {@link fromJSON} to serialize the fold state.
 */
export declare const foldState: StateField<DecorationSet>;
/** Get a [range set](#state.RangeSet) containing the folded ranges in the given state. */
export declare function foldedRanges(state: EditorState): DecorationSet;
/** Fold the lines that are selected, if possible. */
export declare const foldCode: Command;
/** Unfold folded ranges on selected lines. */
export declare const unfoldCode: Command;
/**
 * Fold all top-level foldable ranges. Note that, in most cases, folding information will depend on the
 * [syntax tree]{@link syntaxTree}, and folding everything may not work reliably when the document hasn't
 * been fully parsed (either because the editor state was only just initialized, or because the document
 * is so big that the parser decided not to parse it entirely).
 */
export declare const foldAll: Command;
/** Unfold all folded code. */
export declare const unfoldAll: Command;
/**
 * Default fold-related key bindings.
 *  - Ctrl-Shift-[ (Cmd-Alt-[ on macOS): {@link foldCode}.
 *  - Ctrl-Shift-] (Cmd-Alt-] on macOS): {@link unfoldCode}.
 *  - Ctrl-Alt-[: {@link foldAll}.
 *  - Ctrl-Alt-]: {@link unfoldAll}.
 */
export declare const foldKeymap: readonly KeyBinding[];
interface FoldConfig {
    /**
     * A function that creates the DOM element used to indicate the position of folded code. The `onclick`
     * argument is the default click event handler, which toggles folding on the line that holds the
     * element, and should probably be added as an event handler to the returned element.
     *
     * When this option isn't given, the `placeholderText` option will be used to create the placeholder
     * element.
     */
    placeholderDOM?: ((view: EditorView, onclick: (event: Event) => void) => HTMLElement) | null;
    /**
     * Text to use as placeholder for folded text. Defaults to `"…"`.
     * Will be styled with the `"cm-foldPlaceholder"` class.
     */
    placeholderText?: string;
}
/** Create an extension that configures code folding. */
export declare function codeFolding(config?: FoldConfig): Extension;
declare type Handlers = {
    [event: string]: (view: EditorView, line: BlockInfo, event: Event) => boolean;
};
interface FoldGutterConfig {
    /**
     * A function that creates the DOM element used to indicate a given line is folded or can be folded.
     * When not given, the `openText`/`closeText` option will be used instead.
     */
    markerDOM?: ((open: boolean) => HTMLElement) | null;
    /** Text used to indicate that a given line can be folded. Defaults to `"⌄"`. */
    openText?: string;
    /** Text used to indicate that a given line is folded. Defaults to `"›"`. */
    closedText?: string;
    /** Supply event handlers for DOM events on this gutter. */
    domEventHandlers?: Handlers;
    /** When given, if this returns true for a given view update, recompute the fold markers. */
    foldingChanged?: (update: ViewUpdate) => boolean;
}
/**
 * Create an extension that registers a fold gutter, which shows a fold status indicator before foldable
 * lines (which can be clicked to fold or unfold the line).
 */
export declare function foldGutter(config?: FoldGutterConfig): Extension;
export {};

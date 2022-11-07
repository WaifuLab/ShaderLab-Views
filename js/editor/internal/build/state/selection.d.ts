import { ChangeDesc } from "./change.js";
/**
 * A single selection range. When {@link allowMultipleSelections} is enabled, a [selection]{@link EditorSelection}
 * may hold multiple ranges. By default, selections hold exactly one range.
 */
export declare class SelectionRange {
    /** The lower boundary of the range. */
    readonly from: number;
    /** The upper boundary of the range. */
    readonly to: number;
    private flags;
    private constructor();
    /** The anchor of the range—the side that doesn't move when you extend it. */
    get anchor(): number;
    /** The head of the range, which is moved when the range is [extended]{@link SelectionRange.extend}. */
    get head(): number;
    /** True when `anchor` and `head` are at the same position. */
    get empty(): boolean;
    /**
     * If this is a cursor that is explicitly associated with the character on one of its sides, this
     * returns the side. -1 means the character before its position, 1 the character after, and 0 means
     * no association.
     */
    get assoc(): -1 | 0 | 1;
    /** The bidirectional text level associated with this cursor, if any. */
    get bidiLevel(): number | null;
    /**
     * The goal column (stored vertical offset) associated with a cursor. This is used to preserve the
     * vertical position when [moving]{@link EditorView.moveVertically} across lines of different length.
     */
    get goalColumn(): number | undefined;
    /** Map this range through a change, producing a valid range in the updated document. */
    map(change: ChangeDesc, assoc?: number): SelectionRange;
    /** Extend this range to cover at least `from` to `to`. */
    extend(from: number, to?: number): SelectionRange;
    /** Compare this range to another range. */
    eq(other: SelectionRange): boolean;
    /** Return a JSON-serializable object representing the range. */
    toJSON(): any;
    /** Convert a JSON representation of a range to a `SelectionRange` instance. */
    static fromJSON(json: any): SelectionRange;
    static create(from: number, to: number, flags: number): SelectionRange;
}
/** An editor selection holds one or more selection ranges. */
export declare class EditorSelection {
    /** The ranges in the selection, sorted by position. Ranges cannot overlap (but they may touch, if they aren't empty). */
    readonly ranges: readonly SelectionRange[];
    /** The index of the _main_ range in the selection (which is usually the range that was added last). */
    readonly mainIndex: number;
    private constructor();
    /** Map a selection through a change. Used to adjust the selection position for changes. */
    map(change: ChangeDesc, assoc?: number): EditorSelection;
    /** Compare this selection to another selection. */
    eq(other: EditorSelection): boolean;
    /**
     * Get the primary selection range. Usually, you should make sure your code applies to _all_ ranges,
     * by using methods like [`changeByRange`]{@link EditorState.changeByRange}.
     */
    get main(): SelectionRange;
    /** Make sure the selection only has one range. Returns a selection holding only the main range from this selection. */
    asSingle(): EditorSelection;
    /** Extend this selection with an extra range. */
    addRange(range: SelectionRange, main?: boolean): EditorSelection;
    /** Replace a given range with another range, and then normalize the selection to merge and sort ranges if necessary. */
    replaceRange(range: SelectionRange, which?: number): EditorSelection;
    /** Convert this selection to an object that can be serialized to JSON. */
    toJSON(): any;
    /** Create a selection from a JSON representation. */
    static fromJSON(json: any): EditorSelection;
    /** Create a selection holding a single range. */
    static single(anchor: number, head?: number): EditorSelection;
    /** Sort and merge the given set of ranges, creating a valid selection. */
    static create(ranges: readonly SelectionRange[], mainIndex?: number): EditorSelection;
    /** Create a cursor selection range at the given position. You can safely ignore the optional arguments in most situations. */
    static cursor(pos: number, assoc?: number, bidiLevel?: number, goalColumn?: number): SelectionRange;
    /** Create a selection range. */
    static range(anchor: number, head: number, goalColumn?: number): SelectionRange;
    static normalized(ranges: SelectionRange[], mainIndex?: number): EditorSelection;
}
export declare function checkSelection(selection: EditorSelection, docLength: number): void;

import { Text } from "./text.js";
export declare const DefaultSplit: RegExp;
/** Distinguishes different ways in which positions can be mapped. */
export declare enum MapMode {
    Simple = 0,
    TrackDel = 1,
    TrackBefore = 2,
    TrackAfter = 3
}
/**
 * A change description is a variant of [change set]{@link ChangeSet} that doesn't store the
 * inserted text. As such, it can't be applied, but is cheaper to store and manipulate.
 */
export declare class ChangeDesc {
    readonly sections: readonly number[];
    protected constructor(sections: readonly number[]);
    /** The length of the document before the change. */
    get length(): number;
    /** The length of the document after the change. */
    get newLength(): number;
    /** False when there are actual changes in this set. */
    get empty(): boolean;
    /**
     * Iterate over the unchanged parts left by these changes.
     * @param func.posA the position of the range in the old document.
     * @param func.posB the new position in the changed document.
     */
    iterGaps(func: (posA: number, posB: number, length: number) => void): void;
    /**
     * Iterate over the ranges changed by these changes. (See {@link iterChanges} for a variant that
     * also provides you with the inserted text.) `fromA`/`toA` provides the extent of the change in
     * the starting document, `fromB`/`toB` the extent of the replacement in the changed document.
     * When `individual` is true, adjacent changes (which are kept separate for
     * [position mapping]{@link ChangeDesc.mapPos}) are reported separately.
     */
    iterChangedRanges(f: (fromA: number, toA: number, fromB: number, toB: number) => void, individual?: boolean): void;
    /** Get a description of the inverted form of these changes. */
    get invertedDesc(): ChangeDesc;
    /**
     * Compute the combined effect of applying another set of changes after this one. The
     * length of the document after this set should match the length before `other`.
     */
    composeDesc(other: ChangeDesc): ChangeDesc;
    /**
     * Map this description, which should start with the same document as `other`, over
     * another set of changes, so that it can be applied after it.
     * @param other
     * @param before When `before` is true, map as if the changes in `other` happened
     *               before the ones in `this`.
     */
    mapDesc(other: ChangeDesc, before?: boolean): ChangeDesc;
    /**
     * Map a given position through these changes, to produce a position pointing into the new document.
     * @param pos
     * @param assoc indicates which side the position should be associated with. When it is negative or zero,
     *          the mapping will try to keep the position close to the character before it (if any), and will
     *          move it before insertions at that point or replacements across that point. When it is positive,
     *          the position is associated with the character after it, and will be moved forward for insertions
     *          at or replacements across the position. Defaults to -1.
     */
    mapPos(pos: number, assoc?: number): number;
    mapPos(pos: number, assoc: number, mode: MapMode): number | null;
    /** Check whether these changes touch a given range. When one of the changes entirely covers the range, the string `"cover"` is returned. */
    touchesRange(from: number, to?: number): boolean | "cover";
    toString(): string;
    /** Serialize this change desc to a JSON-representable value. */
    toJSON(): readonly number[];
    /** Create a change desc from its JSON representation (as produced by {@link toJSON}. */
    static fromJSON(json: any): ChangeDesc;
    static create(sections: readonly number[]): ChangeDesc;
}
/**
 * This type is used as argument to {@link EditorState.changes} and in the [`changes` field]{@link TransactionSpec.changes}
 * of transaction specs to succinctly describe document changes. It may either be a plain object describing
 * a change (a deletion, insertion, or replacement, depending on which fields are present), a
 * [change set]{@link state.ChangeSet}, or an array of change specs.
 */
export declare type ChangeSpec = {
    from: number;
    to?: number;
    insert?: string | Text;
} | ChangeSet | readonly ChangeSpec[];
/**
 * A change set represents a group of modifications to a document. It stores the document length,
 * and can only be applied to documents with exactly that length.
 */
export declare class ChangeSet extends ChangeDesc {
    readonly inserted: readonly Text[];
    private constructor();
    /** Apply the changes to a document, returning the modified document. */
    apply(doc: Text): Text;
    mapDesc(other: ChangeDesc, before?: boolean): ChangeDesc;
    /**
     * Given the document as it existed _before_ the changes, return a change set that represents the inverse
     * of this set, which could be used to go from the document created by the changes back to the document as
     * it existed before the changes.
     */
    invert(doc: Text): ChangeSet;
    /**
     * Combine two subsequent change sets into a single set. `other` must start in the document produced by `this`.
     * If `this` goes `docA` → `docB` and `other` represents `docB` → `docC`, the returned value will represent
     * the change `docA` → `docC`.
     */
    compose(other: ChangeSet): ChangeSet;
    /**
     * Given another change set starting in the same document, maps this change set over the other, producing a
     * new change set that can be applied to the document produced by applying `other`. When `before` is `true`,
     * order changes as if `this` comes before `other`, otherwise (the default) treat `other` as coming first.
     *
     * Given two changes `A` and `B`, `A.compose(B.map(A))` and `B.compose(A.map(B, true))` will produce the same
     * document. This provides a basic form of [operational transformation]
     * (https://en.wikipedia.org/wiki/Operational_transformation),
     * and can be used for collaborative editing.
     */
    map(other: ChangeDesc, before?: boolean): ChangeSet;
    /** Iterate over the changed ranges in the document, calling `func` for each */
    iterChanges(f: (fromA: number, toA: number, fromB: number, toB: number, inserted: Text) => void, individual?: boolean): void;
    /** Get a [change description](#state.ChangeDesc) for this change set. */
    get desc(): ChangeDesc;
    filter(ranges: readonly number[]): {
        changes: ChangeSet;
        filtered: ChangeDesc;
    };
    /** Serialize this change set to a JSON-representable value. */
    toJSON(): any;
    /** Create a change set for the given changes, for a document of the given length, using `lineSep` as line separator. */
    static of(changes: ChangeSpec, length: number, lineSep?: string): ChangeSet;
    /** Create an empty changeset of the given length. */
    static empty(length: number): ChangeSet;
    /** Create a changeset from its JSON representation (as produced by [`toJSON`]{@link ChangeSet.toJSON}. */
    static fromJSON(json: any): ChangeSet;
    static createSet(sections: readonly number[], inserted: readonly Text[]): ChangeSet;
}

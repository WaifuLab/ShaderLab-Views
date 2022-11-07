import { ChangeDesc, MapMode } from "./change.js";
/** Each range is associated with a value, which must inherit from this class. */
export declare abstract class RangeValue {
    /**
     * Compare this value with another value. Used when comparing rangesets. The default implementation
     * compares by identity. Unless you are only creating a fixed number of unique instances of your
     * value type, it is a good idea to implement this properly.
     */
    eq(other: RangeValue): boolean;
    /**
     * The bias value at the start of the range. Determines how the range is positioned relative to other
     * ranges starting at this position. Defaults to 0.
     */
    startSide: number;
    /** The bias value at the end of the range. Defaults to 0. */
    endSide: number;
    /**
     * The mode with which the location of the range should be mapped when its `from` and `to` are the
     * same, to decide whether a change deletes the range. Defaults to `MapMode.TrackDel`.
     */
    mapMode: MapMode;
    /**
     * Determines whether this value marks a point range. Regular ranges affect the part of the document
     * they cover, and are meaningless when empty. Point ranges have a meaning on their own. When
     * non-empty, a point range is treated as atomic and shadows any ranges contained in it.
     */
    point: boolean;
    /** Create a [range](#state.Range) with this value. */
    range(from: number, to?: number): Range<this>;
}
/** A range associates a value with a range of positions. */
export declare class Range<T extends RangeValue> {
    /** The range's start position. */
    readonly from: number;
    /** Its end position. */
    readonly to: number;
    /** The value associated with this range. */
    readonly value: T;
    private constructor();
    static create<T extends RangeValue>(from: number, to: number, value: T): Range<T>;
}
/** Collection of methods used when comparing range sets. */
export interface RangeComparator<T extends RangeValue> {
    /**
     * Notifies the comparator that a range (in positions in the new document) has the given sets
     * of values associated with it, which are different in the old (A) and new (B) sets.
     */
    compareRange(from: number, to: number, activeA: T[], activeB: T[]): void;
    /** Notification for a changed (or inserted, or deleted) point range. */
    comparePoint(from: number, to: number, pointA: T | null, pointB: T | null): void;
}
/**
 * Methods used when iterating over the spans created by a set of ranges. The entire iterated range
 * will be covered with either `span` or `point` calls.
 */
export interface SpanIterator<T extends RangeValue> {
    /**
     * Called for any ranges not covered by point decorations. `active` holds the values that the
     * range is marked with (and may be empty). `openStart` indicates how many of those ranges are open
     * (continued) at the start of the span.
     */
    span(from: number, to: number, active: readonly T[], openStart: number): void;
    /**
     * Called when going over a point decoration. The active range decorations that cover the
     * point and have a higher precedence are provided in `active`. The open count in `openStart`
     * counts the number of those ranges that started before the point and. If the point started
     * before the iterated range, `openStart` will be `active.length + 1` to signal this.
     */
    point(from: number, to: number, value: T, active: readonly T[], openStart: number, index: number): void;
}
declare class Chunk<T extends RangeValue> {
    readonly from: readonly number[];
    readonly to: readonly number[];
    readonly value: readonly T[];
    readonly maxPoint: number;
    constructor(from: readonly number[], to: readonly number[], value: readonly T[], maxPoint: number);
    get length(): number;
    findIndex(pos: number, side: number, end: boolean, startAt?: number): number;
    between(offset: number, from: number, to: number, f: (from: number, to: number, value: T) => void | false): void | false;
    map(offset: number, changes: ChangeDesc): {
        mapped: Chunk<T> | null;
        pos: number;
    };
}
/** A range cursor is an object that moves to the next range every time you call `next` on it. */
export interface RangeCursor<T> {
    /** Move the iterator forward. */
    next: () => void;
    /** The next range's value. Holds `null` when the cursor has reached its end. */
    value: T | null;
    /** The next range's start position. */
    from: number;
    /** The next end position. */
    to: number;
}
declare type RangeSetUpdate<T extends RangeValue> = {
    /**
     * An array of ranges to add. If given, this should be sorted by `from` position and `startSide` unless
     * [`sort`]{@link update.sort} is given as `true`.
     */
    add?: readonly Range<T>[];
    /** Indicates whether the library should sort the ranges in `add`. Defaults to `false`. */
    sort?: boolean;
    /** Filter the ranges already in the set. Only those for which this function returns `true` are kept. */
    filter?: (from: number, to: number, value: T) => boolean;
    /**
     * Can be used to limit the range on which the filter is applied. Filtering only a small range,
     * as opposed to the entire set, can make updates cheaper.
     */
    filterFrom?: number;
    /** The end position to apply the filter to. */
    filterTo?: number;
};
/**
 * A range set stores a collection of [ranges]{@link Range} in a way that makes them efficient to
 * {@link map} and {@link update}. This is an immutable data structure.
 */
export declare class RangeSet<T extends RangeValue> {
    readonly chunkPos: readonly number[];
    readonly chunk: readonly Chunk<T>[];
    readonly nextLayer: RangeSet<T>;
    readonly maxPoint: number;
    private constructor();
    static create<T extends RangeValue>(chunkPos: readonly number[], chunk: readonly Chunk<T>[], nextLayer: RangeSet<T>, maxPoint: number): RangeSet<T>;
    get length(): number;
    /** The number of ranges in the set. */
    get size(): number;
    chunkEnd(index: number): number;
    /** Update the range set, optionally adding new ranges or filtering out existing ones. */
    update<U extends T>(updateSpec: RangeSetUpdate<U>): RangeSet<T>;
    /** Map this range set through a set of changes, return the new set. */
    map(changes: ChangeDesc): RangeSet<T>;
    /**
     * Iterate over the ranges that touch the region `from` to `to`, calling `f` for each. There is
     * no guarantee that the ranges will be reported in any specific order. When the callback returns
     * `false`, iteration stops.
     */
    between(from: number, to: number, f: (from: number, to: number, value: T) => void | false): void;
    /** Iterate over the ranges in this set, in order, including all ranges that end at or after `from`. */
    iter(from?: number): RangeCursor<T>;
    get isEmpty(): boolean;
    /** Iterate over the ranges in a collection of sets, in order, starting from `from`. */
    static iter<T extends RangeValue>(sets: readonly RangeSet<T>[], from?: number): RangeCursor<T>;
    /**
     * Iterate over two groups of sets, calling methods on `comparator` to notify it of possible
     * differences.
     */
    static compare<T extends RangeValue>(oldSets: readonly RangeSet<T>[], newSets: readonly RangeSet<T>[], textDiff: ChangeDesc, comparator: RangeComparator<T>, minPointSize?: number): void;
    /** Compare the contents of two groups of range sets, returning true if they are equivalent in the given range. */
    static eq<T extends RangeValue>(oldSets: readonly RangeSet<T>[], newSets: readonly RangeSet<T>[], from?: number, to?: number): boolean;
    /**
     * Iterate over a group of range sets at the same time, notifying the iterator about the ranges
     * covering every given piece of content. Returns the open count (see {@link SpanIterator.span})
     * at the end of the iteration.
     */
    static spans<T extends RangeValue>(sets: readonly RangeSet<T>[], from: number, to: number, iterator: SpanIterator<T>, 
    /** When given and greater than -1, only points of at least this size are taken into account. */
    minPointSize?: number): number;
    /**
     * Create a range set for the given range or array of ranges. By default, this expects the
     * ranges to be _sorted_ (by start position and, if two start at the same position,
     * `value.startSide`). You can pass `true` as second argument to cause the method to sort them.
     */
    static of<T extends RangeValue>(ranges: readonly Range<T>[] | Range<T>, sort?: boolean): RangeSet<T>;
    /** The empty set of ranges. */
    static empty: RangeSet<any>;
}
/**
 * A range set builder is a data structure that helps build up a [range set]{@link RangeSet} directly,
 * without first allocating an array of [`Range`]{@link Range} objects.
 */
export declare class RangeSetBuilder<T extends RangeValue> {
    private chunks;
    private chunkPos;
    private chunkStart;
    private last;
    private lastFrom;
    private lastTo;
    private from;
    private to;
    private value;
    private maxPoint;
    private setMaxPoint;
    private nextLayer;
    private finishChunk;
    /** Create an empty builder. */
    constructor();
    /** Add a range. Ranges should be added in sorted (by `from` and `value.startSide`) order. */
    add(from: number, to: number, value: T): void;
    addInner(from: number, to: number, value: T): boolean;
    addChunk(from: number, chunk: Chunk<T>): boolean;
    /**
     * Finish the range set. Returns the new set. The builder can't be used anymore after this has been
     * called.
     */
    finish(): RangeSet<T>;
    finishInner(next: RangeSet<T>): RangeSet<T>;
}
export {};

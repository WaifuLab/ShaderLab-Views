declare const enum Open {
    From = 1,
    To = 2
}
/** A text iterator iterates over a sequence of strings. When iterating over a {@link Text} document, result values will either be lines or line breaks. */
export interface TextIterator extends Iterator<string>, Iterable<string> {
    /**
     * Retrieve the next string.
     * @param skip skip the number of position after the current position
     */
    next(skip?: number): this;
    /** The current string. Will be the empty string when the cursor is at its end or `next` hasn't been called on it yet. */
    value: string;
    /** Whether the end of the iteration has been reached. You should probably check this right after calling `next`. */
    done: boolean;
    /** Whether the current string represents a line break. */
    lineBreak: boolean;
}
/** The data structure for documents. */
export declare abstract class Text implements Iterable<string> {
    /** The length of the string. */
    abstract readonly length: number;
    /** The number of lines in the string (always >= 1). */
    abstract readonly lines: number;
    /** Get the line description around the given position. */
    lineAt(pos: number): Line;
    /** Get the description for the given (1-based) line number. */
    line(n: number): Line;
    abstract lineInner(target: number, isLine: boolean, line: number, offset: number): Line;
    /** Replace a range of the text with the given content. */
    replace(from: number, to: number, text: Text): Text;
    /** Append another document to this one. */
    append(other: Text): Text;
    /** Retrieve the text between the given points. */
    slice(from: number, to?: number): Text;
    /** Retrieve a part of the document as a string */
    abstract sliceString(from: number, to?: number, lineSep?: string): string;
    abstract flatten(target: string[]): void;
    abstract scanIdentical(other: Text, dir: 1 | -1): number;
    /** Test whether this text is equal to another instance. */
    eq(other: Text): boolean;
    /** Iterate over the text. -1 from end to start */
    iter(dir?: 1 | -1): TextIterator;
    /** Iterate over a range of the text. When `from` > `to`, the iterator will run in reverse. */
    iterRange(from: number, to?: number): TextIterator;
    /**
     * Return a cursor that iterates over the given range of lines, _without_ returning the
     * line breaks between, and yielding empty strings for empty lines.
     * @param [from] line start
     * @param [to] line end
     */
    iterLines(from?: number, to?: number): TextIterator;
    abstract decompose(from: number, to: number, target: Text[], open: Open): void;
    toString(): string;
    /** Convert the document to an array of lines (which can be deserialized again via {@link Text.of}). */
    toJSON(): string[];
    protected constructor();
    /** If this is a branch node, `children` will hold the `Text` objects that it is made up of. For leaf nodes, this holds null. */
    abstract readonly children: readonly Text[] | null;
    [Symbol.iterator]: () => Iterator<string>;
    /** Create a `Text` instance for the given array of lines. */
    static of(text: readonly string[]): Text;
    /** The empty document. */
    static empty: Text;
}
/** This type describes a line in the document. It is created on-demand when lines are [queried]{@link Text.lineAt}. */
export declare class Line {
    /** The position of the start of the line. */
    readonly from: number;
    /** The position at the end of the line (_before_ the line break, or at the end of document for the last line). */
    readonly to: number;
    /** This line's line number (1-based). */
    readonly number: number;
    /** The line's content. */
    readonly text: string;
    constructor(
    /** The position of the start of the line. */
    from: number, 
    /** The position at the end of the line (_before_ the line break, or at the end of document for the last line). */
    to: number, 
    /** This line's line number (1-based). */
    number: number, 
    /** The line's content. */
    text: string);
    /** The length of the line (not including any line break after it). */
    get length(): number;
}
export {};

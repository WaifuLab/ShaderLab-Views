import { Text } from "../state/index.js";
/** A search cursor provides an iterator over text matches in a document. */
export declare class SearchCursor implements Iterator<{
    from: number;
    to: number;
}> {
    private test?;
    private iter;
    /**
     * The current match (only holds a meaningful value after [`next`]{@link SearchCursor.next} has been
     * called and when `done` is false).
     */
    value: {
        from: number;
        to: number;
    };
    /** Whether the end of the iterated region has been reached. */
    done: boolean;
    private matches;
    private buffer;
    private bufferPos;
    private bufferStart;
    private normalize;
    private query;
    /**
     * Create a text cursor. The query is the search string, `from` to `to` provides the region to search.
     *
     * When `normalize` is given, it will be called, on both the query string and the content it is matched
     * against, before comparing. You can, for example, create a case-insensitive search by passing
     * `s => s.toLowerCase()`.
     *
     * Text is always normalized with
     * [`.normalize("NFKD")`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize) (when supported).
     */
    constructor(text: Text, query: string, from?: number, to?: number, normalize?: (string: string) => string, test?: ((from: number, to: number, buffer: string, bufferPos: number) => boolean) | undefined);
    private peek;
    /**
     * Look for the next match. Updates the iterator's [`value`]{@link SearchCursor.value} and
     * [`done`]{@link SearchCursor.done} properties. Should be called at least once before using the cursor.
     */
    next(): this;
    /**
     * The `next` method will ignore matches that partially overlap a previous match. This method behaves
     * like `next`, but includes such matches.
     */
    nextOverlapping(): this;
    private match;
    [Symbol.iterator]: () => Iterator<{
        from: number;
        to: number;
    }>;
}

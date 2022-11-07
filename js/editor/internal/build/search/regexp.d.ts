import { Text } from "../state/index.js";
export interface RegExpCursorOptions {
    ignoreCase?: boolean;
    test?: (from: number, to: number, match: RegExpExecArray) => boolean;
}
/**
 * This class is similar to {@link SearchCursor} but searches for a regular expression pattern instead
 * of a plain string.
 */
export declare class RegExpCursor implements Iterator<{
    from: number;
    to: number;
    match: RegExpExecArray;
}> {
    private text;
    private to;
    private iter;
    private re;
    private test?;
    private curLine;
    private curLineStart;
    private matchPos;
    /** Set to `true` when the cursor has reached the end of the search range. */
    done: boolean;
    /**
     * Will contain an object with the extent of the match and the match object when {@link next} sucessfully
     * finds a match.
     */
    value: {
        from: number;
        to: number;
        match: RegExpExecArray;
    };
    /** Create a cursor that will search the given range in the given document. */
    constructor(text: Text, query: string, options?: RegExpCursorOptions, from?: number, to?: number);
    private getLine;
    private nextLine;
    /** Move to the next match, if there is one. */
    next(): this;
    [Symbol.iterator]: () => Iterator<{
        from: number;
        to: number;
        match: RegExpExecArray;
    }>;
}
export declare function validRegExp(source: string): boolean;

/** Returns a next grapheme cluster break _after_ (not equal to) `pos` */
export declare function findClusterBreak(str: string, pos: number, forward?: boolean, includeExtending?: boolean): number;
/**
 * Find the code point at the given position in a string (like the
 * [`codePointAt`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/codePointAt)
 * string method).
 */
export declare function codePointAt(str: string, pos: number): number;
/**
 * Given a Unicode codepoint, return the JavaScript string that respresents it (like
 * [`String.fromCodePoint`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/fromCodePoint)).
 */
export declare function fromCodePoint(code: number): string;
/** The amount of positions a character takes up a JavaScript string. */
export declare function codePointSize(code: number): 1 | 2;

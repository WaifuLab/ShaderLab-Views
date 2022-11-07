/** Encapsulates a single line of input. Given to stream syntax code, which uses it to tokenize the content. */
export declare class StringStream {
    /** The line. */
    string: string;
    private tabSize;
    /** The current indent unit size. */
    indentUnit: number;
    /** The current position on the line. */
    pos: number;
    /** The start position of the current token. */
    start: number;
    private lastColumnPos;
    private lastColumnValue;
    /** Create a stream. */
    constructor(
    /** The line. */
    string: string, tabSize: number, 
    /** The current indent unit size. */
    indentUnit: number);
    /** True if we are at the end of the line. */
    eol(): boolean;
    /** True if we are at the start of the line. */
    sol(): boolean;
    /** Get the next code unit after the current position, or undefined if we're at the end of the line. */
    peek(): string | undefined;
    /** Read the next code unit and advance `this.pos`. */
    next(): string | void;
    /** Match the next character against the given string, regular expression, or predicate. Consume and return it if it matches. */
    eat(match: string | RegExp | ((ch: string) => boolean)): string | void;
    /**
     * Continue matching characters that match the given string, regular expression, or
     * predicate function. Return true if any characters were consumed.
     */
    eatWhile(match: string | RegExp | ((ch: string) => boolean)): boolean;
    /** Consume whitespace ahead of `this.pos`. Return true if any was found. */
    eatSpace(): boolean;
    /** Move to the end of the line. */
    skipToEnd(): void;
    /** Move to directly before the given character, if found on the current line. */
    skipTo(ch: string): boolean | void;
    /** Move back `n` characters. */
    backUp(n: number): void;
    /** Get the column position at `this.pos`. */
    column(): number;
    /** Get the indentation column of the current line. */
    indentation(): number;
    /**
     * Match the input against the given string or regular expression (which should start with a `^`).
     * Return true or the regexp match if it matches.
     *
     * Unless `consume` is set to `false`, this will move `this.pos` past the matched text.
     *
     * When matching a string `caseInsensitive` can be set to true to make the match case-insensitive.
     */
    match(pattern: string | RegExp, consume?: boolean, caseInsensitive?: boolean): boolean | RegExpMatchArray | null;
    /** Get the current token. */
    current(): string;
}

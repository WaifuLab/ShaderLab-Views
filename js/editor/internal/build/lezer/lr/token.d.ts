import { Input } from "../common/index.js";
import { Stack } from "./stack.js";
export declare class CachedToken {
    start: number;
    value: number;
    end: number;
    extended: number;
    lookAhead: number;
    mask: number;
    context: number;
}
export declare class InputStream {
    readonly input: Input;
    readonly ranges: readonly {
        from: number;
        to: number;
    }[];
    chunk: string;
    chunkOff: number;
    chunkPos: number;
    private chunk2;
    private chunk2Pos;
    next: number;
    token: CachedToken;
    pos: number;
    end: number;
    private rangeIndex;
    private range;
    constructor(input: Input, ranges: readonly {
        from: number;
        to: number;
    }[]);
    resolveOffset(offset: number, assoc: -1 | 1): number | null;
    clipPos(pos: number): number;
    /**
     * Look at a code unit near the stream position. `.peek(0)` equals `.next`, `.peek(-1)`
     * gives you the previous character, and so on.
     */
    peek(offset: number): number;
    /**
     * Accept a token. By default, the end of the token is set to the current stream position,
     * but you can pass an offset (relative to the stream position) to change that.
     */
    acceptToken(token: number, endOffset?: number): void;
    private getChunk;
    private readNext;
    advance(n?: number): number;
    private setDone;
    reset(pos: number, token?: CachedToken): this;
    read(from: number, to: number): string;
}
export interface Tokenizer {
    token(input: InputStream, stack: Stack): void;
    contextual: boolean;
    fallback: boolean;
    extend: boolean;
}
export declare class TokenGroup implements Tokenizer {
    readonly data: Readonly<Uint16Array>;
    readonly id: number;
    contextual: boolean;
    fallback: boolean;
    extend: boolean;
    constructor(data: Readonly<Uint16Array>, id: number);
    token(input: InputStream, stack: Stack): void;
}
interface ExternalOptions {
    /**
     * When set to true, mark this tokenizer as depending on the current parse stack,
     * which prevents its result from being cached between parser actions at the same
     * positions.
     */
    contextual?: boolean;
    /**
     * tokenizers with lower precedence from even running. When `fallback` is true,
     * the tokenizer is allowed to run when a previous tokenizer returned a token
     * that didn't match any of the current state's actions.
     */
    fallback?: boolean;
    /**
     * When set to true, tokenizing will not stop after this tokenizer has produced a
     * token. (But it will still fail to reach this one if a higher-precedence
     * tokenizer produced a token.)
     */
    extend?: boolean;
}
export declare class ExternalTokenizer {
    readonly token: (input: InputStream, stack: Stack) => void;
    contextual: boolean;
    fallback: boolean;
    extend: boolean;
    constructor(token: (input: InputStream, stack: Stack) => void, options?: ExternalOptions);
}
export {};

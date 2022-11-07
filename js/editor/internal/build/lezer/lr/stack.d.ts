import { Parse, ContextTracker } from "./parse.js";
import { Tree, BufferCursor } from "../common/index.js";
export declare class Stack {
    readonly p: Parse;
    readonly stack: number[];
    state: number;
    reducePos: number;
    pos: number;
    score: number;
    buffer: number[];
    bufferBase: number;
    curContext: StackContext | null;
    lookAhead: number;
    parent: Stack | null;
    constructor(p: Parse, stack: number[], state: number, reducePos: number, pos: number, score: number, buffer: number[], bufferBase: number, curContext: StackContext | null, lookAhead: number, parent: Stack | null);
    toString(): string;
    static start(p: Parse, state: number, pos?: number): Stack;
    get context(): any;
    pushState(state: number, start: number): void;
    reduce(action: number): void;
    storeNode(term: number, start: number, end: number, size?: number, isReduce?: boolean): void;
    shift(action: number, next: number, nextEnd: number): void;
    apply(action: number, next: number, nextEnd: number): void;
    useNode(value: Tree, next: number): void;
    split(): Stack;
    recoverByDelete(next: number, nextEnd: number): void;
    canShift(term: number): boolean;
    recoverByInsert(next: number): Stack[];
    forceReduce(): boolean;
    forceAll(): this;
    get deadEnd(): boolean;
    restart(): void;
    sameState(other: Stack): boolean;
    /** Get the parser used by this stack. */
    get parser(): import("./parse").LRParser;
    /** Test whether a given dialect (by numeric ID, as exported from the terms file) is enabled. */
    dialectEnabled(dialectID: number): boolean;
    private shiftContext;
    private reduceContext;
    private emitContext;
    emitLookAhead(): void;
    private updateContext;
    setLookAhead(lookAhead: number): void;
    close(): void;
}
declare class StackContext {
    readonly tracker: ContextTracker<any>;
    readonly context: any;
    readonly hash: number;
    constructor(tracker: ContextTracker<any>, context: any);
}
export declare const enum Recover {
    Insert = 200,
    Delete = 190,
    Reduce = 100,
    MaxNext = 4,
    MaxInsertStackDepth = 300,
    DampenInsertStackDepth = 120
}
export declare class StackBufferCursor implements BufferCursor {
    stack: Stack;
    pos: number;
    index: number;
    buffer: number[];
    constructor(stack: Stack, pos: number, index: number);
    static create(stack: Stack, pos?: number): StackBufferCursor;
    maybeNext(): void;
    get id(): number;
    get start(): number;
    get end(): number;
    get size(): number;
    next(): void;
    fork(): StackBufferCursor;
}
export {};

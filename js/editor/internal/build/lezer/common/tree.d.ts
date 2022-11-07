import { Parser } from "./parse.js";
export declare const DefaultBufferLength = 1024;
export declare class Range {
    readonly from: number;
    readonly to: number;
    constructor(from: number, to: number);
}
export declare class NodeProp<T> {
    id: number;
    perNode: boolean;
    /**
     * A method that deserializes a value of this prop from a string. Can be used to
     * allow a prop to be directly written in a grammar file.
     */
    deserialize: (str: string) => T;
    constructor(config?: {
        deserialize?: (str: string) => T;
        perNode?: boolean;
    });
    add(match: {
        [selector: string]: T;
    } | ((type: NodeType) => T | undefined)): NodePropSource;
    static closedBy: NodeProp<readonly string[]>;
    static openedBy: NodeProp<readonly string[]>;
    static group: NodeProp<readonly string[]>;
    static contextHash: NodeProp<number>;
    static lookAhead: NodeProp<number>;
    static mounted: NodeProp<MountedTree>;
}
export declare class MountedTree {
    readonly tree: Tree;
    readonly overlay: readonly {
        from: number;
        to: number;
    }[] | null;
    readonly parser: Parser;
    constructor(tree: Tree, overlay: readonly {
        from: number;
        to: number;
    }[] | null, parser: Parser);
}
export declare type NodePropSource = (type: NodeType) => null | [NodeProp<any>, any];
export declare class NodeType {
    readonly name: string;
    readonly props: {
        readonly [prop: number]: any;
    };
    readonly id: number;
    readonly flags: number;
    constructor(name: string, props: {
        readonly [prop: number]: any;
    }, id: number, flags?: number);
    static define(spec: {
        id: number;
        name?: string;
        props?: readonly ([NodeProp<any>, any] | NodePropSource)[];
        top?: boolean;
        error?: boolean;
        skipped?: boolean;
    }): NodeType;
    prop<T>(prop: NodeProp<T>): T | undefined;
    get isTop(): boolean;
    get isSkipped(): boolean;
    get isError(): boolean;
    get isAnonymous(): boolean;
    is(name: string | number): boolean;
    static none: NodeType;
    static match<T>(map: {
        [selector: string]: T;
    }): (node: NodeType) => T | undefined;
}
export declare class NodeSet {
    readonly types: readonly NodeType[];
    constructor(types: readonly NodeType[]);
    extend(...props: NodePropSource[]): NodeSet;
}
export declare enum IterMode {
    ExcludeBuffers = 1,
    IncludeAnonymous = 2,
    IgnoreMounts = 4,
    IgnoreOverlays = 8
}
export declare class Tree {
    readonly type: NodeType;
    readonly children: readonly (Tree | TreeBuffer)[];
    readonly positions: readonly number[];
    readonly length: number;
    props: null | {
        [id: number]: any;
    };
    constructor(type: NodeType, children: readonly (Tree | TreeBuffer)[], positions: readonly number[], length: number, props?: readonly [NodeProp<any> | number, any][]);
    toString(): string;
    static empty: Tree;
    cursor(mode?: IterMode): TreeCursor;
    cursorAt(pos: number, side?: -1 | 0 | 1, mode?: IterMode): TreeCursor;
    get topNode(): SyntaxNode;
    resolve(pos: number, side?: -1 | 0 | 1): SyntaxNode;
    resolveInner(pos: number, side?: -1 | 0 | 1): SyntaxNode;
    iterate(spec: {
        enter(node: SyntaxNodeRef): boolean | void;
        leave?(node: SyntaxNodeRef): void;
        from?: number;
        to?: number;
        mode?: IterMode;
    }): void;
    prop<T>(prop: NodeProp<T>): T | undefined;
    get propValues(): readonly [NodeProp<any> | number, any][];
    balance(config?: {
        makeTree?: (children: readonly (Tree | TreeBuffer)[], positions: readonly number[], length: number) => Tree;
    }): Tree;
    static build(data: BuildData): Tree;
}
declare type BuildData = {
    buffer: BufferCursor | readonly number[];
    nodeSet: NodeSet;
    topID: number;
    start?: number;
    bufferStart?: number;
    length?: number;
    maxBufferLength?: number;
    reused?: readonly Tree[];
    minRepeatType?: number;
};
export interface BufferCursor {
    pos: number;
    id: number;
    start: number;
    end: number;
    size: number;
    next(): void;
    fork(): BufferCursor;
}
export declare class TreeBuffer {
    readonly buffer: Uint16Array;
    readonly length: number;
    readonly set: NodeSet;
    constructor(buffer: Uint16Array, length: number, set: NodeSet);
    get type(): NodeType;
    toString(): string;
    childString(index: number): string;
    findChild(startIndex: number, endIndex: number, dir: 1 | -1, pos: number, side: Side): number;
    slice(startI: number, endI: number, from: number, to: number): TreeBuffer;
}
export interface SyntaxNodeRef {
    readonly from: number;
    readonly to: number;
    readonly type: NodeType;
    readonly name: string;
    readonly tree: Tree | null;
    readonly node: SyntaxNode;
    /** Test whether the node matches a given context. */
    matchContext(context: readonly string[]): boolean;
}
export interface SyntaxNode extends SyntaxNodeRef {
    parent: SyntaxNode | null;
    firstChild: SyntaxNode | null;
    lastChild: SyntaxNode | null;
    childAfter(pos: number): SyntaxNode | null;
    childBefore(pos: number): SyntaxNode | null;
    enter(pos: number, side: -1 | 0 | 1, mode?: IterMode): SyntaxNode | null;
    nextSibling: SyntaxNode | null;
    prevSibling: SyntaxNode | null;
    cursor(mode?: IterMode): TreeCursor;
    resolve(pos: number, side?: -1 | 0 | 1): SyntaxNode;
    resolveInner(pos: number, side?: -1 | 0 | 1): SyntaxNode;
    enterUnfinishedNodesBefore(pos: number): SyntaxNode;
    toTree(): Tree;
    getChild(type: string | number, before?: string | number | null, after?: string | number | null): SyntaxNode | null;
    getChildren(type: string | number, before?: string | number | null, after?: string | number | null): SyntaxNode[];
    matchContext(context: readonly string[]): boolean;
}
declare const enum Side {
    Before = -2,
    AtOrBefore = -1,
    Around = 0,
    AtOrAfter = 1,
    After = 2,
    DontCare = 4
}
export declare class TreeNode implements SyntaxNode {
    readonly _tree: Tree;
    readonly from: number;
    readonly index: number;
    readonly _parent: TreeNode | null;
    constructor(_tree: Tree, from: number, index: number, _parent: TreeNode | null);
    get type(): NodeType;
    get name(): string;
    get to(): number;
    nextChild(i: number, dir: 1 | -1, pos: number, side: Side, mode?: IterMode): TreeNode | BufferNode | null;
    get firstChild(): TreeNode | BufferNode | null;
    get lastChild(): TreeNode | BufferNode | null;
    childAfter(pos: number): TreeNode | BufferNode | null;
    childBefore(pos: number): TreeNode | BufferNode | null;
    enter(pos: number, side: -1 | 0 | 1, mode?: number): TreeNode | BufferNode | null;
    nextSignificantParent(): TreeNode;
    get parent(): TreeNode | null;
    get nextSibling(): SyntaxNode | null;
    get prevSibling(): SyntaxNode | null;
    cursor(mode?: IterMode): TreeCursor;
    get tree(): Tree;
    toTree(): Tree;
    resolve(pos: number, side?: -1 | 0 | 1): SyntaxNode;
    resolveInner(pos: number, side?: -1 | 0 | 1): SyntaxNode;
    enterUnfinishedNodesBefore(pos: number): SyntaxNode;
    getChild(type: string | number, before?: string | number | null, after?: string | number | null): SyntaxNode | null;
    getChildren(type: string | number, before?: string | number | null, after?: string | number | null): SyntaxNode[];
    toString(): string;
    get node(): this;
    matchContext(context: readonly string[]): boolean;
}
declare class BufferContext {
    readonly parent: TreeNode;
    readonly buffer: TreeBuffer;
    readonly index: number;
    readonly start: number;
    constructor(parent: TreeNode, buffer: TreeBuffer, index: number, start: number);
}
declare class BufferNode implements SyntaxNode {
    readonly context: BufferContext;
    readonly _parent: BufferNode | null;
    readonly index: number;
    type: NodeType;
    get name(): string;
    get from(): number;
    get to(): number;
    constructor(context: BufferContext, _parent: BufferNode | null, index: number);
    child(dir: 1 | -1, pos: number, side: Side): BufferNode | null;
    get firstChild(): BufferNode | null;
    get lastChild(): BufferNode | null;
    childAfter(pos: number): BufferNode | null;
    childBefore(pos: number): BufferNode | null;
    enter(pos: number, side: -1 | 0 | 1, mode?: IterMode): BufferNode | null;
    get parent(): SyntaxNode | null;
    externalSibling(dir: 1 | -1): TreeNode | BufferNode | null;
    get nextSibling(): SyntaxNode | null;
    get prevSibling(): SyntaxNode | null;
    cursor(mode?: IterMode): TreeCursor;
    get tree(): null;
    toTree(): Tree;
    resolve(pos: number, side?: -1 | 0 | 1): SyntaxNode;
    resolveInner(pos: number, side?: -1 | 0 | 1): SyntaxNode;
    enterUnfinishedNodesBefore(pos: number): SyntaxNode;
    toString(): string;
    getChild(type: string | number, before?: string | number | null, after?: string | number | null): SyntaxNode | null;
    getChildren(type: string | number, before?: string | number | null, after?: string | number | null): SyntaxNode[];
    get node(): this;
    matchContext(context: readonly string[]): boolean;
}
export declare class TreeCursor implements SyntaxNodeRef {
    readonly mode: number;
    type: NodeType;
    get name(): string;
    from: number;
    to: number;
    _tree: TreeNode;
    buffer: BufferContext | null;
    private stack;
    index: number;
    private bufferNode;
    constructor(node: TreeNode | BufferNode, mode?: number);
    private yieldNode;
    private yieldBuf;
    private yield;
    toString(): string;
    enterChild(dir: 1 | -1, pos: number, side: Side): boolean;
    firstChild(): boolean;
    lastChild(): boolean;
    childAfter(pos: number): boolean;
    childBefore(pos: number): boolean;
    enter(pos: number, side: -1 | 0 | 1, mode?: IterMode): boolean;
    /** Move to the node's parent node, if this isn't the top node. */
    parent(): boolean;
    sibling(dir: 1 | -1): boolean;
    nextSibling(): boolean;
    prevSibling(): boolean;
    private atLastNode;
    private move;
    next(enter?: boolean): boolean;
    prev(enter?: boolean): boolean;
    moveTo(pos: number, side?: -1 | 0 | 1): this;
    get node(): SyntaxNode;
    get tree(): Tree | null;
    iterate(enter: (node: SyntaxNodeRef) => boolean | void, leave?: (node: SyntaxNodeRef) => void): void;
    matchContext(context: readonly string[]): boolean;
}
export declare class NodeWeakMap<T> {
    private map;
    private setBuffer;
    private getBuffer;
    set(node: SyntaxNode, value: T): void;
    get(node: SyntaxNode): T | undefined;
    /** Set the value for the node that a cursor currently points to. */
    cursorSet(cursor: TreeCursor, value: T): void;
    /** Retrieve the value for the node that a cursor currently points to. */
    cursorGet(cursor: TreeCursor): T | undefined;
}
export {};

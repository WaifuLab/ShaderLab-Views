import { Tree, TreeFragment, NodeSet, NodeType, NodeProp, NodePropSource, Input, PartialParse, Parser, ParseWrapper } from "../common/index.js";
import { Stack } from "./stack.js";
import { Tokenizer, ExternalTokenizer, CachedToken, InputStream } from "./token.js";
declare class FragmentCursor {
    readonly fragments: readonly TreeFragment[];
    readonly nodeSet: NodeSet;
    i: number;
    fragment: TreeFragment | null;
    safeFrom: number;
    safeTo: number;
    trees: Tree[];
    start: number[];
    index: number[];
    nextStart: number;
    constructor(fragments: readonly TreeFragment[], nodeSet: NodeSet);
    nextFragment(): void;
    nodeAt(pos: number): Tree | null;
}
declare class TokenCache {
    readonly stream: InputStream;
    tokens: CachedToken[];
    mainToken: CachedToken | null;
    actions: number[];
    constructor(parser: LRParser, stream: InputStream);
    getActions(stack: Stack): number[];
    getMainToken(stack: Stack): CachedToken;
    updateCachedToken(token: CachedToken, tokenizer: Tokenizer, stack: Stack): void;
    putAction(action: number, token: number, end: number, index: number): number;
    addActions(stack: Stack, token: number, end: number, index: number): number;
}
export declare class Parse implements PartialParse {
    readonly parser: LRParser;
    readonly input: Input;
    readonly ranges: readonly {
        from: number;
        to: number;
    }[];
    stacks: Stack[];
    recovering: number;
    fragments: FragmentCursor | null;
    nextStackID: number;
    minStackPos: number;
    reused: Tree[];
    stream: InputStream;
    tokens: TokenCache;
    topTerm: number;
    stoppedAt: null | number;
    constructor(parser: LRParser, input: Input, fragments: readonly TreeFragment[], ranges: readonly {
        from: number;
        to: number;
    }[]);
    get parsedPos(): number;
    advance(): Tree | null;
    stopAt(pos: number): void;
    private advanceStack;
    private advanceFully;
    private runRecovery;
    stackToTree(stack: Stack): Tree;
    private stackID;
}
export declare class Dialect {
    readonly source: string | undefined;
    readonly flags: readonly boolean[];
    readonly disabled: null | Uint8Array;
    constructor(source: string | undefined, flags: readonly boolean[], disabled: null | Uint8Array);
    allows(term: number): boolean;
}
export declare class ContextTracker<T> {
    start: T;
    shift: (context: T, term: number, stack: Stack, input: InputStream) => T;
    reduce: (context: T, term: number, stack: Stack, input: InputStream) => T;
    reuse: (context: T, node: Tree, stack: Stack, input: InputStream) => T;
    hash: (context: T) => number;
    strict: boolean;
    constructor(spec: {
        /** The initial value of the context at the start of the parse. */
        start: T;
        /**
         * Update the context when the parser executes a
         * [shift](https://en.wikipedia.org/wiki/LR_parser#Shift_and_reduce_actions)
         * action.
         */
        shift?(context: T, term: number, stack: Stack, input: InputStream): T;
        /** Update the context when the parser executes a reduce action. */
        reduce?(context: T, term: number, stack: Stack, input: InputStream): T;
        /** Update the context when the parser reuses a node from a tree fragment. */
        reuse?(context: T, node: Tree, stack: Stack, input: InputStream): T;
        /** Reduce a context value to a number (for cheap storage and comparison). Only needed for strict contexts. */
        hash?(context: T): number;
        /**
         * By default, nodes can only be reused during incremental parsing if they were
         * created in the same context as the one in which they are reused. Set this to
         * false to disable that check (and the overhead of storing the hashes).
         */
        strict?: boolean;
    });
}
declare type SpecializerSpec = {
    term: number;
    get?: (value: string, stack: Stack) => number;
    external?: any;
    extend?: boolean;
};
declare type ParserSpec = {
    version: number;
    states: string | Uint32Array;
    stateData: string | Uint16Array;
    goto: string | Uint16Array;
    nodeNames: string;
    maxTerm: number;
    repeatNodeCount: number;
    nodeProps?: [NodeProp<any> | string, ...(string | number)[]][];
    propSources?: NodePropSource[];
    skippedNodes?: number[];
    tokenData: string;
    tokenizers: (Tokenizer | number)[];
    topRules: {
        [name: string]: [number, number];
    };
    context: ContextTracker<any> | null;
    dialects?: {
        [name: string]: number;
    };
    dynamicPrecedences?: {
        [term: number]: number;
    };
    specialized?: SpecializerSpec[];
    tokenPrec: number;
    termNames?: {
        [id: number]: string;
    };
};
export interface ParserConfig {
    /** Node prop values to add to the parser's node set. */
    props?: readonly NodePropSource[];
    top?: string;
    dialect?: string;
    tokenizers?: {
        from: ExternalTokenizer;
        to: ExternalTokenizer;
    }[];
    specializers?: {
        from: (value: string, stack: Stack) => number;
        to: (value: string, stack: Stack) => number;
    }[];
    contextTracker?: ContextTracker<any>;
    strict?: boolean;
    wrap?: ParseWrapper;
    bufferLength?: number;
}
export declare class LRParser extends Parser {
    readonly states: Readonly<Uint32Array>;
    readonly data: Readonly<Uint16Array>;
    readonly goto: Readonly<Uint16Array>;
    readonly maxTerm: number;
    readonly minRepeatTerm: number;
    readonly tokenizers: readonly Tokenizer[];
    readonly topRules: {
        [name: string]: [number, number];
    };
    readonly context: ContextTracker<unknown> | null;
    readonly dialects: {
        [name: string]: number;
    };
    readonly dynamicPrecedences: {
        [term: number]: number;
    } | null;
    readonly specialized: Uint16Array;
    readonly specializers: ((value: string, stack: Stack) => number)[];
    readonly specializerSpecs: SpecializerSpec[];
    readonly tokenPrecTable: number;
    readonly termNames: null | {
        [id: number]: string;
    };
    readonly maxNode: number;
    readonly dialect: Dialect;
    readonly wrappers: readonly ParseWrapper[];
    readonly top: [number, number];
    readonly bufferLength: number;
    readonly strict: boolean;
    readonly nodeSet: NodeSet;
    constructor(spec: ParserSpec);
    createParse(input: Input, fragments: readonly TreeFragment[], ranges: readonly {
        from: number;
        to: number;
    }[]): PartialParse;
    getGoto(state: number, term: number, loose?: boolean): number;
    hasAction(state: number, terminal: number): number;
    stateSlot(state: number, slot: number): number;
    stateFlag(state: number, flag: number): boolean;
    validAction(state: number, action: number): boolean;
    nextStates(state: number): readonly number[];
    overrides(token: number, prev: number): boolean;
    /**
     * Configure the parser. Returns a new parser instance that has the given settings
     * modified. Settings not provided in `config` are kept from the original parser.
     */
    configure(config: ParserConfig): LRParser;
    hasWrappers(): boolean;
    getName(term: number): string;
    /** The eof term id is always allocated directly after the node types. @internal */
    get eofTerm(): number;
    /** The type of top node produced by the parser. */
    get topNode(): NodeType;
    dynamicPrecedence(term: number): number;
    parseDialect(dialect?: string): Dialect;
    static deserialize(spec: any): LRParser;
}
export {};

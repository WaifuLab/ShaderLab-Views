import { NodeType, NodeProp } from "../lezer/common/index.js";
import { Tag } from "../lezer/highlight/index.js";
import { Language } from "./language.js";
import { IndentContext } from "./indent.js";
import { StringStream } from "./stringstream.js";
export { StringStream };
export interface StreamParser<State> {
    /** A name for this language. */
    name?: string;
    /** Produce a start state for the parser. */
    startState?(indentUnit: number): State;
    /**
     * Read one token, advancing the stream past it, and returning a string indicating the token's
     * style tag—either the name of one of the tags in
     * [`tags`](https://lezer.codemirror.net/docs/ref#highlight.tags),
     * or such a name suffixed by one or more tag
     * [modifier](https://lezer.codemirror.net/docs/ref#highlight.Tag^defineModifier)
     * names, separated by periods. For example `"keyword"` or "`variableName.constant"`.
     * It is okay to return a zero-length token, but only if that updates the state so that the
     * next call will return a non-empty token again.
     */
    token(stream: StringStream, state: State): string | null;
    /** This notifies the parser of a blank line in the input. It can update its state here if it needs to. */
    blankLine?(state: State, indentUnit: number): void;
    /** Copy a given state. By default, a shallow object copy is done which also copies arrays held at the top level of the object. */
    copyState?(state: State): State;
    /** Compute automatic indentation for the line that starts with the given state and text. */
    indent?(state: State, textAfter: string, context: IndentContext): number | null;
    /** Default [language data](#state.EditorState.languageDataAt) to attach to this language. */
    languageData?: {
        [name: string]: any;
    };
    /**
     * Extra tokens to use in this parser. When the tokenizer returns a token name that
     * exists as a property in this object, the corresponding tag will be assigned to the token.
     */
    tokenTable?: {
        [name: string]: Tag;
    };
}
/** A [language]{@link Language} class based on a CodeMirror 5-style [streaming parser](#language.StreamParser). */
export declare class StreamLanguage<State> extends Language {
    streamParser: Required<StreamParser<State>>;
    stateAfter: NodeProp<State>;
    tokenTable: TokenTable;
    topNode: NodeType;
    private constructor();
    /** Define a stream language. */
    static define<State>(spec: StreamParser<State>): StreamLanguage<State>;
    private getIndent;
    get allowsNesting(): boolean;
}
declare class TokenTable {
    readonly extra: {
        [name: string]: Tag;
    };
    table: {
        [name: string]: number;
    };
    constructor(extra: {
        [name: string]: Tag;
    });
    resolve(tag: string): number;
}

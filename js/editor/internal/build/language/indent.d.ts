import { NodeProp, SyntaxNode } from "../lezer/common/index.js";
import { EditorState, Extension, Facet } from "../state/index.js";
/**
 * Facet that defines a way to provide a function that computes the appropriate indentation depth, as
 * a column number (see {@link indentString}), at the start of a given line, or `null` to indicate no
 * appropriate indentation could be determined.
 */
export declare const indentService: Facet<(context: IndentContext, pos: number) => number | null, readonly ((context: IndentContext, pos: number) => number | null)[]>;
export declare const indentUnit: Facet<string, string>;
export declare function getIndentUnit(state: EditorState): number;
export declare function indentString(state: EditorState, cols: number): string;
export declare function getIndentation(context: IndentContext | EditorState, pos: number): number | null;
export declare function indentRange(state: EditorState, from: number, to: number): import("../state/change").ChangeSet;
export declare class IndentContext {
    readonly state: EditorState;
    readonly options: {
        overrideIndentation?: (pos: number) => number;
        simulateBreak?: number;
        simulateDoubleBreak?: boolean;
    };
    unit: number;
    constructor(state: EditorState, options?: {
        overrideIndentation?: (pos: number) => number;
        simulateBreak?: number;
        simulateDoubleBreak?: boolean;
    });
    lineAt(pos: number, bias?: -1 | 1): {
        text: string;
        from: number;
    };
    textAfterPos(pos: number, bias?: -1 | 1): string;
    column(pos: number, bias?: -1 | 1): number;
    countColumn(line: string, pos?: number): number;
    lineIndent(pos: number, bias?: -1 | 1): number;
    get simulatedBreak(): number | null;
}
export declare const indentNodeProp: NodeProp<(context: TreeIndentContext) => number | null>;
/** Objects of this type provide context information and helper methods to indentation functions registered on syntax nodes. */
export declare class TreeIndentContext extends IndentContext {
    private base;
    readonly pos: number;
    readonly node: SyntaxNode;
    private constructor();
    static create(base: IndentContext, pos: number, node: SyntaxNode): TreeIndentContext;
    /**
     * Get the text directly after `this.pos`, either the entire line or the next 100 characters,
     * whichever is shorter.
     */
    get textAfter(): string;
    /**
     * Get the indentation at the reference line for `this.node`, which is the line on which it starts,
     * unless there is a node that is _not_ a parent of this node covering the start of that line. If
     * so, the line at the start of that node is tried, again skipping on if it is covered by another
     * such node.
     */
    get baseIndent(): number;
    /** Continue looking for indentations in the node's parent nodes, and return the result of that. */
    continue(): number | null;
}
/**
 * An indentation strategy for delimited (usually bracketed) nodes. Will, by default, indent one unit more
 * than the parent's base indent unless the line starts with a closing token. When `align` is true and
 * there are non-skipped nodes on the node's opening line, the content of the node will be aligned with the
 * end of the opening node, like this:
 *     foo(bar,
 *         baz)
 */
export declare function delimitedIndent({ closing, align, units }: {
    closing: string;
    align?: boolean;
    units?: number;
}): (context: TreeIndentContext) => number;
/** An indentation strategy that aligns a node's content to its base indentation. */
export declare const flatIndent: (context: TreeIndentContext) => number;
/**
 * Creates an indentation strategy that, by default, indents continued lines one unit more than the node's
 * base indentation. You can provide `except` to prevent indentation of lines that match a pattern (for
 * example `/^else\b/` in `if`/`else` constructs), and you can change the amount of units used with the
 * `units` option.
 */
export declare function continuedIndent({ except, units }?: {
    except?: RegExp;
    units?: number;
}): (context: TreeIndentContext) => number;
/**
 * Enables reindentation on input. When a language defines an `indentOnInput` field in its
 * [language data]{@link EditorState.languageDataAt}, which must hold a regular expression, the line at
 * the cursor will be reindented whenever new text is typed and the input from the start of the line up
 * to the cursor matches that regexp.
 *
 * To avoid unneccesary reindents, it is recommended to start the regexp with `^` (usually followed by
 * `\s*`), and end it with `$`. For example, `/^\s*\}$/` will reindent when a closing brace is added at
 * the start of a line.
 */
export declare function indentOnInput(): Extension;

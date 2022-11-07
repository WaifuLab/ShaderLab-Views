import { Tree, NodeType, SyntaxNodeRef } from "../common/index.js";
export declare class Tag {
    /** The set of this tag and all its parent tags, starting with this one itself and sorted in order of decreasing specificity. */
    readonly set: Tag[];
    /** The base unmodified tag that this one is based on, if it's modified @internal */
    readonly base: Tag | null;
    /** The modifiers applied to this.base @internal */
    readonly modified: readonly Modifier[];
    id: number;
    constructor(
    /** The set of this tag and all its parent tags, starting with this one itself and sorted in order of decreasing specificity. */
    set: Tag[], 
    /** The base unmodified tag that this one is based on, if it's modified @internal */
    base: Tag | null, 
    /** The modifiers applied to this.base @internal */
    modified: readonly Modifier[]);
    /**
     * Define a new tag. If `parent` is given, the tag is treated as a sub-tag of that
     * parent, and [highlighters]{@link tagHighlighter} that don't mention this tag will
     * try to fall back to the parent tag (or grandparent tag, etc).
     */
    static define(parent?: Tag): Tag;
    /**
     * Define a tag _modifier_, which is a function that, given a tag, will return a tag
     * that is a subtag of the original. Applying the same modifier to a twice tag will
     * return the same value (`m1(t1) == m1(t1)`) and applying multiple modifiers will,
     * regardless or order, produce the same tag (`m1(m2(t1)) == m2(m1(t1))`).
     */
    static defineModifier(): (tag: Tag) => Tag;
}
declare class Modifier {
    instances: Tag[];
    id: number;
    static get(base: Tag, mods: readonly Modifier[]): Tag;
}
export declare function styleTags(spec: {
    [selector: string]: Tag | readonly Tag[];
}): import("../common/tree").NodePropSource;
/**
 * A highlighter defines a mapping from highlighting tags and language scopes to CSS class names.
 * They are usually defined via {@link tagHighlighter} or some wrapper around that, but it is also
 * possible to implement them from scratch.
 */
export interface Highlighter {
    /**
     * Get the set of classes that should be applied to the given set of highlighting tags, or
     * null if this highlighter doesn't assign a style to the tags.
     */
    style(tags: readonly Tag[]): string | null;
    /**
     * When given, the highlighter will only be applied to trees on whose [top]{@link NodeType.isTop}
     * node this predicate returns true.
     */
    scope?(node: NodeType): boolean;
}
/**
 * Define a [highlighter]{@link Highlighter} from an array of tag/class pairs. Classes
 * associated with more specific tags will take precedence.
 */
export declare function tagHighlighter(tags: readonly {
    tag: Tag | readonly Tag[];
    class: string;
}[], options?: {
    scope?: (node: NodeType) => boolean;
    all?: string;
}): Highlighter;
/**
 * Highlight the given [tree]{@link Tree} with the given [highlighter]{@link Highlighter}.
 * @param tree
 * @param highlighter
 * @param putStyle Assign styling to a region of the text. Will be called, in order
 *                 of position, for any ranges where more than zero classes apply.
 *                 `classes` is a space separated string of CSS classes.
 * @param from The start of the range to highlight.
 * @param to The end of the range.
 */
export declare function highlightTree(tree: Tree, highlighter: Highlighter | readonly Highlighter[], putStyle: (from: number, to: number, classes: string) => void, from?: number, to?: number): void;
/**
 * Match a syntax node's [highlight rules]{@link styleTags}. If there's a match, return its set of
 * tags, and whether it is opaque (uses a `!`) or applies to all child nodes (`/...`).
 */
export declare function getStyleTags(node: SyntaxNodeRef): {
    tags: readonly Tag[];
    opaque: boolean;
    inherit: boolean;
} | null;
export declare const tags: {
    /** A comment. */
    comment: Tag;
    /** A line [comment]{@link tags.comment}. */
    lineComment: Tag;
    /** A block [comment]{@link tags.comment}. */
    blockComment: Tag;
    /** A documentation [comment]{@link tags.comment}. */
    docComment: Tag;
    /** Any kind of identifier. */
    name: Tag;
    /** The [name]{@link tags.name} of a variable. */
    variableName: Tag;
    /** A type [name]{@link tags.name}. */
    typeName: Tag;
    /** A tag name (subtag of [`typeName`]{@link tags.typeName}). */
    tagName: Tag;
    /** A property or field [name]{@link tags.name}. */
    propertyName: Tag;
    /** An attribute name (subtag of [`propertyName`]{@link tags.propertyName}). */
    attributeName: Tag;
    /** The [name]{@link tags.name} of a class. */
    className: Tag;
    /** A label [name]{@link tags.name}. */
    labelName: Tag;
    /** A namespace [name]{@link tags.name}. */
    namespace: Tag;
    /** The [name]{@link tags.name} of a macro. */
    macroName: Tag;
    literal: Tag;
    string: Tag;
    docString: Tag;
    character: Tag;
    attributeValue: Tag;
    number: Tag;
    integer: Tag;
    float: Tag;
    bool: Tag;
    regexp: Tag;
    escape: Tag;
    color: Tag;
    url: Tag;
    keyword: Tag;
    self: Tag;
    null: Tag;
    atom: Tag;
    unit: Tag;
    modifier: Tag;
    operatorKeyword: Tag;
    controlKeyword: Tag;
    definitionKeyword: Tag;
    moduleKeyword: Tag;
    operator: Tag;
    derefOperator: Tag;
    arithmeticOperator: Tag;
    logicOperator: Tag;
    bitwiseOperator: Tag;
    compareOperator: Tag;
    updateOperator: Tag;
    definitionOperator: Tag;
    typeOperator: Tag;
    controlOperator: Tag;
    punctuation: Tag;
    separator: Tag;
    bracket: Tag;
    angleBracket: Tag;
    squareBracket: Tag;
    paren: Tag;
    brace: Tag;
    content: Tag;
    heading: Tag;
    heading1: Tag;
    heading2: Tag;
    heading3: Tag;
    heading4: Tag;
    heading5: Tag;
    heading6: Tag;
    contentSeparator: Tag;
    list: Tag;
    quote: Tag;
    emphasis: Tag;
    strong: Tag;
    link: Tag;
    monospace: Tag;
    strikethrough: Tag;
    inserted: Tag;
    deleted: Tag;
    changed: Tag;
    invalid: Tag;
    meta: Tag;
    documentMeta: Tag;
    annotation: Tag;
    processingInstruction: Tag;
    definition: (tag: Tag) => Tag;
    constant: (tag: Tag) => Tag;
    function: (tag: Tag) => Tag;
    standard: (tag: Tag) => Tag;
    local: (tag: Tag) => Tag;
    /**
     * A generic variant [modifier]{@link Tag.defineModifier} that can be used to tag
     * language-specific alternative variants of some common tag. It is recommended for
     * themes to define special forms of at least the [string]{@link tags.string} and
     * [variable name]{@link tags.variableName} tags, since those come up a lot.
     */
    special: (tag: Tag) => Tag;
};
/**
 * This is a highlighter that adds stable, predictable classes to tokens, for styling
 * with external CSS.
 *
 * The following tags are mapped to their name prefixed with `"tok-"` (for example
 * `"tok-comment"`):
 *
 * * [`link`]{@link tags.link}
 * * [`heading`]{@link tags.heading}
 * * [`emphasis`]{@link tags.emphasis}
 * * [`strong`]{@link tags.strong}
 * * [`keyword`]{@link tags.keyword}
 * * [`atom`]{@link tags.atom}
 * * [`bool`]{@link tags.bool}
 * * [`url`]{@link tags.url}
 * * [`labelName`]{@link tags.labelName}
 * * [`inserted`]{@link tags.inserted}
 * * [`deleted`]{@link tags.deleted}
 * * [`literal`]{@link tags.literal}
 * * [`string`]{@link tags.string}
 * * [`number`]{@link tags.number}
 * * [`variableName`]{@link tags.variableName}
 * * [`typeName`]{@link tags.typeName}
 * * [`namespace`]{@link tags.namespace}
 * * [`className`]{@link tags.className}
 * * [`macroName`]{@link tags.macroName}
 * * [`propertyName`]{@link tags.propertyName}
 * * [`operator`]{@link tags.operator}
 * * [`comment`]{@link tags.comment}
 * * [`meta`]{@link tags.meta}
 * * [`punctuation`]{@link tags.punctuation}
 * * [`invalid`]{@link tags.invalid}
 *
 * In addition, these mappings are provided:
 *
 * * [`regexp`]{@link tags.regexp}, [`escape`]{@link tags.escape}, and [`special`]{@link tags.special} [`(string)`]{@link tags.string} are mapped to `"tok-string2"`
 * * [`special`]{@link tags.special}[`(variableName)`]{@link tags.variableName} to `"tok-variableName2"`
 * * [`local`]{@link tags.local)[`(variableName)`]{@link tags.variableName} to `"tok-variableName tok-local"`
 * * [`definition`]{@link tags.definition}[`(variableName)`]{@link tags.variableName} to `"tok-variableName tok-definition"`
 * * [`definition`]{@link tags.definition}[`(propertyName)`]{@link tags.propertyName} to `"tok-propertyName tok-definition"`
 */
export declare const classHighlighter: Highlighter;
export {};

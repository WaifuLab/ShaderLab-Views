import { NodeType } from "../lezer/common/index.js";
import { Tag, Highlighter } from "../lezer/highlight/index.js";
import { StyleSpec, StyleModule } from "../utils/style-mod.js";
import { EditorState, Extension } from "../state/index.js";
import { Language } from "./language.js";
/** A highlight style associates CSS styles with higlighting [tags](https://lezer.codemirror.net/docs/ref#highlight.Tag). */
export declare class HighlightStyle implements Highlighter {
    readonly specs: readonly TagStyle[];
    /**
     * A style module holding the CSS rules for this highlight style. When using
     * [`highlightTree`](https://lezer.codemirror.net/docs/ref#highlight.highlightTree)
     * outside of the editor, you may want to manually mount this module to show the highlighting.
     */
    readonly module: StyleModule | null;
    readonly themeType: "dark" | "light" | undefined;
    readonly style: (tags: readonly Tag[]) => string | null;
    readonly scope: ((type: NodeType) => boolean) | undefined;
    private constructor();
    /**
     * Create a highlighter style that associates the given styles to the given tags. The specs must
     * be objects that hold a style tag or array of tags in their `tag` property, and either a single
     * `class` property providing a static CSS class (for highlighter that rely on external styling),
     * or a [`style-mod`](https://github.com/marijnh/style-mod#documentation)-style set of CSS
     * properties (which define the styling for those tags). The CSS rules created for a highlighter
     * will be emitted in the order of the spec's properties. That means that for elements that have
     * multiple tags associated with them, styles defined further down in the list will have a higher
     * CSS precedence than styles defined earlier.
     */
    static define(specs: readonly TagStyle[], options?: {
        /**
         * By default, highlighters apply to the entire document. You can scope them to a single
         * language by providing the language object or a language's top node type here.
         */
        scope?: Language | NodeType;
        /** Add a style to _all_ content. Probably only useful in combination with `scope`. */
        all?: string | StyleSpec;
        /**
         * Specify that this highlight style should only be active then the theme is dark or light.
         * By default, it is active regardless of theme.
         */
        themeType?: "dark" | "light";
    }): HighlightStyle;
}
/**
 * Wrap a highlighter in an editor extension that uses it to apply syntax highlighting to the editor content.
 *
 * When multiple (non-fallback) styles are provided, the styling applied is the union of the classes they emit.
 */
export declare function syntaxHighlighting(highlighter: Highlighter, options?: {
    fallback: boolean;
}): Extension;
/**
 * Returns the CSS classes (if any) that the highlighters active in the state would assign to the
 * given style [tags](https://lezer.codemirror.net/docs/ref#highlight.Tag) and (optional) language
 * [scope]{@link options.scope}.
 */
export declare function highlightingFor(state: EditorState, tags: readonly Tag[], scope?: NodeType): string | null;
/**
 * The type of object used in {@link HighlightStyle.define}. Assigns a style to one or more highlighting
 * [tags](https://lezer.codemirror.net/docs/ref#highlight.Tag), which can either be a fixed class name
 * (which must be defined elsewhere), or a set of CSS properties, for which the library will define
 * an anonymous class.
 */
export interface TagStyle {
    /** The tag or tags to target. */
    tag: Tag | readonly Tag[];
    /** If given, this maps the tags to a fixed class name. */
    class?: string;
    /**
     * Any further properties (if `class` isn't given) will be interpreted as in style objects given to
     * [style-mod](https://github.com/marijnh/style-mod#documentation).
     */
    [styleProperty: string]: any;
}
/** A default highlight style (works well with light themes). */
export declare const defaultHighlightStyle: HighlightStyle;

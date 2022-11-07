import { tags, tagHighlighter, highlightTree } from "../lezer/highlight/index.js";
import { StyleModule } from "../utils/style-mod.js";
import { EditorView, ViewPlugin, Decoration } from "../view/index.js";
import { Prec, Facet, RangeSetBuilder } from "../state/index.js";
import { syntaxTree, Language, languageDataProp } from "./language.js";
/** A highlight style associates CSS styles with higlighting [tags](https://lezer.codemirror.net/docs/ref#highlight.Tag). */
export class HighlightStyle {
    constructor(specs, options) {
        this.specs = specs;
        let modSpec;
        function def(spec) {
            let cls = StyleModule.newName();
            (modSpec || (modSpec = Object.create(null)))["." + cls] = spec;
            return cls;
        }
        const all = typeof options.all == "string" ? options.all : options.all ? def(options.all) : undefined;
        const scopeOpt = options.scope;
        this.scope = scopeOpt instanceof Language ? (type) => type.prop(languageDataProp) == scopeOpt.data
            : scopeOpt ? (type) => type == scopeOpt : undefined;
        this.style = tagHighlighter(specs.map(style => ({
            tag: style.tag,
            class: style.class || def(Object.assign({}, style, { tag: null }))
        })), {
            all,
        }).style;
        this.module = modSpec ? new StyleModule(modSpec) : null;
        this.themeType = options.themeType;
    }
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
    static define(specs, options) {
        return new HighlightStyle(specs, options || {});
    }
}
const highlighterFacet = Facet.define();
const fallbackHighlighter = Facet.define({
    combine(values) { return values.length ? [values[0]] : null; }
});
function getHighlighters(state) {
    let main = state.facet(highlighterFacet);
    return main.length ? main : state.facet(fallbackHighlighter);
}
/**
 * Wrap a highlighter in an editor extension that uses it to apply syntax highlighting to the editor content.
 *
 * When multiple (non-fallback) styles are provided, the styling applied is the union of the classes they emit.
 */
export function syntaxHighlighting(highlighter, options) {
    let ext = [treeHighlighter], themeType;
    if (highlighter instanceof HighlightStyle) {
        if (highlighter.module)
            ext.push(EditorView.styleModule.of(highlighter.module));
        themeType = highlighter.themeType;
    }
    if (options?.fallback)
        ext.push(fallbackHighlighter.of(highlighter));
    else if (themeType)
        ext.push(highlighterFacet.computeN([EditorView.darkTheme], state => {
            return state.facet(EditorView.darkTheme) == (themeType == "dark") ? [highlighter] : [];
        }));
    else
        ext.push(highlighterFacet.of(highlighter));
    return ext;
}
/**
 * Returns the CSS classes (if any) that the highlighters active in the state would assign to the
 * given style [tags](https://lezer.codemirror.net/docs/ref#highlight.Tag) and (optional) language
 * [scope]{@link options.scope}.
 */
export function highlightingFor(state, tags, scope) {
    let highlighters = getHighlighters(state);
    let result = null;
    if (highlighters)
        for (let highlighter of highlighters) {
            if (!highlighter.scope || scope && highlighter.scope(scope)) {
                let cls = highlighter.style(tags);
                if (cls)
                    result = result ? result + " " + cls : cls;
            }
        }
    return result;
}
class TreeHighlighter {
    constructor(view) {
        this.markCache = Object.create(null);
        this.tree = syntaxTree(view.state);
        this.decorations = this.buildDeco(view, getHighlighters(view.state));
    }
    update(update) {
        let tree = syntaxTree(update.state), highlighters = getHighlighters(update.state);
        let styleChange = highlighters != getHighlighters(update.startState);
        if (tree.length < update.view.viewport.to && !styleChange && tree.type == this.tree.type) {
            this.decorations = this.decorations.map(update.changes);
        }
        else if (tree != this.tree || update.viewportChanged || styleChange) {
            this.tree = tree;
            this.decorations = this.buildDeco(update.view, highlighters);
        }
    }
    buildDeco(view, highlighters) {
        if (!highlighters || !this.tree.length)
            return Decoration.none;
        let builder = new RangeSetBuilder();
        for (let { from, to } of view.visibleRanges) {
            highlightTree(this.tree, highlighters, (from, to, style) => {
                builder.add(from, to, this.markCache[style] || (this.markCache[style] = Decoration.mark({ class: style })));
            }, from, to);
        }
        return builder.finish();
    }
}
const treeHighlighter = Prec.high(ViewPlugin.fromClass(TreeHighlighter, {
    decorations: v => v.decorations
}));
/** A default highlight style (works well with light themes). */
export const defaultHighlightStyle = HighlightStyle.define([
    { tag: tags.meta,
        color: "#7a757a" },
    { tag: tags.link,
        textDecoration: "underline" },
    { tag: tags.heading,
        textDecoration: "underline",
        fontWeight: "bold" },
    { tag: tags.emphasis,
        fontStyle: "italic" },
    { tag: tags.strong,
        fontWeight: "bold" },
    { tag: tags.strikethrough,
        textDecoration: "line-through" },
    { tag: tags.keyword,
        color: "#708" },
    { tag: [tags.atom, tags.bool, tags.url, tags.contentSeparator, tags.labelName],
        color: "#219" },
    { tag: [tags.literal, tags.inserted],
        color: "#164" },
    { tag: [tags.string, tags.deleted],
        color: "#a11" },
    { tag: [tags.regexp, tags.escape, tags.special(tags.string)],
        color: "#e40" },
    { tag: tags.definition(tags.variableName),
        color: "#00f" },
    { tag: tags.local(tags.variableName),
        color: "#30a" },
    { tag: [tags.typeName, tags.namespace],
        color: "#085" },
    { tag: tags.className,
        color: "#167" },
    { tag: [tags.special(tags.variableName), tags.macroName],
        color: "#256" },
    { tag: tags.definition(tags.propertyName),
        color: "#00c" },
    { tag: tags.comment,
        color: "#940" },
    { tag: tags.invalid,
        color: "#f00" }
]);

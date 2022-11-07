import { EditorView } from "./editorview.js";
import { ViewUpdate } from "./extension.js";
import { Decoration, DecorationSet } from "./decoration.js";
/**
 * Helper class used to make it easier to maintain decorations on visible code that matches a
 * given regular expression. To be used in a [view plugin]{@link ViewPlugin}. Instances of this
 * object represent a matching configuration.
 */
export declare class MatchDecorator {
    private regexp;
    private addMatch;
    private boundary;
    private maxLength;
    /**
     * Create a decorator.
     * @param config.regexp The regular expression to match against the content. Will only be matched
     *                      inside lines (not across them). Should have its 'g' flag set.
     * @param config.decoration The decoration to apply to matches, either directly or as a function
     *                      of the match.
     * @param config.decorate Customize the way decorations are added for matches.
     * @param config.boundary By default, changed lines are re-matched entirely. You can provide a
     *                      boundary expression,which should match single character strings that can
     *                      never occur in `regexp`, to reducethe amount of re-matching.
     * @param config.maxLength Matching happens by line, by default, but when lines are folded or very
     *                      long lines are onlypartially drawn, the decorator may avoid matching part
     *                      of them for speed. This controls howmuch additional invisible content it
     *                      should include in its matches. Defaults to 1000.
     */
    constructor(config: {
        regexp: RegExp;
        decoration?: Decoration | ((match: RegExpExecArray, view: EditorView, pos: number) => Decoration | null);
        decorate?: (add: (from: number, to: number, decoration: Decoration) => void, from: number, to: number, match: RegExpExecArray, view: EditorView) => void;
        boundary?: RegExp;
        maxLength?: number;
    });
    /**
     * Compute the full set of decorations for matches in the given view's viewport. You'll want to call
     * this when initializing your plugin.
     */
    createDeco(view: EditorView): import("../state/rangeset").RangeSet<Decoration>;
    /**
     * Update a set of decorations for a view update. `deco` _must_ be the set of decorations produced by
     * _this_ `MatchDecorator` for the view state before the update.
     */
    updateDeco(update: ViewUpdate, deco: DecorationSet): DecorationSet;
    private updateRange;
}

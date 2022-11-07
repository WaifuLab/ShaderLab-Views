import { ChangeSet, Facet, StateEffect } from "../state/index.js";
import { Decoration } from "./decoration.js";
export const clickAddsSelectionRange = Facet.define();
export const dragMovesSelection = Facet.define();
export const mouseSelectionStyle = Facet.define();
export const exceptionSink = Facet.define();
export const updateListener = Facet.define();
export const inputHandler = Facet.define();
export const perLineTextDirection = Facet.define({
    combine: values => values.some(x => x)
});
export class ScrollTarget {
    constructor(range, y = "nearest", x = "nearest", yMargin = 5, xMargin = 5) {
        this.range = range;
        this.y = y;
        this.x = x;
        this.yMargin = yMargin;
        this.xMargin = xMargin;
    }
    map(changes) {
        return changes.empty ? this : new ScrollTarget(this.range.map(changes), this.y, this.x, this.yMargin, this.xMargin);
    }
}
export const scrollIntoView = StateEffect.define({ map: (t, ch) => t.map(ch) });
/**
 * Log or report an unhandled exception in client code. Should probably only be used by extension code
 * that allows client code to provide functions, and calls those functions in a context where an exception
 * can't be propagated to calling code in a reasonable way (for example when in an event handler).
 *
 * Either calls a handler registered with {@link EditorView.exceptionSink}, `window.onerror`, if defined,
 * or `console.error` (in which case it'll pass `context`, when given, as first argument).
 */
export function logException(state, exception, context) {
    let handler = state.facet(exceptionSink);
    if (handler.length)
        handler[0](exception);
    else if (window.onerror)
        window.onerror(String(exception), context, undefined, undefined, exception);
    else if (context)
        console.error(context + ":", exception);
    else
        console.error(exception);
}
export const editable = Facet.define({ combine: values => values.length ? values[0] : true });
let nextPluginID = 0;
export const viewPlugin = Facet.define();
/**
 * View plugins associate stateful values with a view. They can influence the way the content is drawn,
 * and are notified of things that happen in the view.
 */
export class ViewPlugin {
    constructor(
    // @internal
    id, 
    // @internal
    create, 
    // @internal
    domEventHandlers, buildExtensions) {
        this.id = id;
        this.create = create;
        this.domEventHandlers = domEventHandlers;
        this.extension = buildExtensions(this);
    }
    /** Define a plugin from a constructor function that creates the plugin's value, given an editor view. */
    static define(create, spec) {
        const { eventHandlers, provide, decorations: deco } = spec || {};
        return new ViewPlugin(nextPluginID++, create, eventHandlers, plugin => {
            let ext = [viewPlugin.of(plugin)];
            if (deco)
                ext.push(decorations.of(view => {
                    let pluginInst = view.plugin(plugin);
                    return pluginInst ? deco(pluginInst) : Decoration.none;
                }));
            if (provide)
                ext.push(provide(plugin));
            return ext;
        });
    }
    /** Create a plugin for a class whose constructor takes a single editor view as argument. */
    static fromClass(cls, spec) {
        return ViewPlugin.define(view => new cls(view), spec);
    }
}
export class PluginInstance {
    constructor(spec) {
        this.spec = spec;
        /**
         * When starting an update, all plugins have this field set to the update object, indicating
         * they need to be updated. When finished updating, it is set to `false`. Retrieving a plugin
         * that needs to be updated with `view.plugin` forces an eager update.
         */
        this.mustUpdate = null;
        /** This is null when the plugin is initially created, but initialized on the first update. */
        this.value = null;
    }
    update(view) {
        if (!this.value) {
            if (this.spec) {
                try {
                    this.value = this.spec.create(view);
                }
                catch (e) {
                    logException(view.state, e, "CodeMirror plugin crashed");
                    this.deactivate();
                }
            }
        }
        else if (this.mustUpdate) {
            let update = this.mustUpdate;
            this.mustUpdate = null;
            if (this.value.update) {
                try {
                    this.value.update(update);
                }
                catch (e) {
                    logException(update.state, e, "CodeMirror plugin crashed");
                    if (this.value.destroy)
                        try {
                            this.value.destroy();
                        }
                        catch (_) { }
                    this.deactivate();
                }
            }
        }
        return this;
    }
    destroy(view) {
        if (this.value?.destroy) {
            try {
                this.value.destroy();
            }
            catch (e) {
                logException(view.state, e, "CodeMirror plugin crashed");
            }
        }
    }
    deactivate() {
        this.spec = this.value = null;
    }
}
export const editorAttributes = Facet.define();
export const contentAttributes = Facet.define();
// Provide decorations
export const decorations = Facet.define();
export const atomicRanges = Facet.define();
export const scrollMargins = Facet.define();
export const styleModule = Facet.define();
export class ChangedRange {
    constructor(fromA, toA, fromB, toB) {
        this.fromA = fromA;
        this.toA = toA;
        this.fromB = fromB;
        this.toB = toB;
    }
    join(other) {
        return new ChangedRange(Math.min(this.fromA, other.fromA), Math.max(this.toA, other.toA), Math.min(this.fromB, other.fromB), Math.max(this.toB, other.toB));
    }
    addToSet(set) {
        let i = set.length, me = this;
        for (; i > 0; i--) {
            let range = set[i - 1];
            if (range.fromA > me.toA)
                continue;
            if (range.toA < me.fromA)
                break;
            me = me.join(range);
            set.splice(i - 1, 1);
        }
        set.splice(i, 0, me);
        return set;
    }
    static extendWithRanges(diff, ranges) {
        if (ranges.length == 0)
            return diff;
        let result = [];
        for (let dI = 0, rI = 0, posA = 0, posB = 0;; dI++) {
            let next = dI == diff.length ? null : diff[dI], off = posA - posB;
            let end = next ? next.fromB : 1e9;
            while (rI < ranges.length && ranges[rI] < end) {
                let from = ranges[rI], to = ranges[rI + 1];
                let fromB = Math.max(posB, from), toB = Math.min(end, to);
                if (fromB <= toB)
                    new ChangedRange(fromB + off, toB + off, fromB, toB).addToSet(result);
                if (to > end)
                    break;
                else
                    rI += 2;
            }
            if (!next)
                return result;
            new ChangedRange(next.fromA, next.toA, next.fromB, next.toB).addToSet(result);
            posA = next.toA;
            posB = next.toB;
        }
    }
}
/** View [plugins]{@link ViewPlugin} are given instances of this class, which describe what happened, whenever the view is updated. */
export class ViewUpdate {
    constructor(
    /** The editor view that the update is associated with. */
    view, 
    /** The new editor state. */
    state, 
    /** The transactions involved in the update. May be empty. */
    transactions) {
        this.view = view;
        this.state = state;
        this.transactions = transactions;
        // @internal
        this.flags = 0;
        this.startState = view.state;
        this.changes = ChangeSet.empty(this.startState.doc.length);
        for (let tr of transactions)
            this.changes = this.changes.compose(tr.changes);
        let changedRanges = [];
        this.changes.iterChangedRanges((fromA, toA, fromB, toB) => changedRanges.push(new ChangedRange(fromA, toA, fromB, toB)));
        this.changedRanges = changedRanges;
        let focus = view.hasFocus;
        if (focus != view.inputState.notifiedFocused) {
            view.inputState.notifiedFocused = focus;
            this.flags |= 1 /* UpdateFlag.Focus */;
        }
    }
    // @internal
    static create(view, state, transactions) {
        return new ViewUpdate(view, state, transactions);
    }
    /** Tells you whether the [viewport]{@link EditorView.viewport} or [visible ranges]{@link EditorView.visibleRanges} changed in this update. */
    get viewportChanged() {
        return (this.flags & 4 /* UpdateFlag.Viewport */) > 0;
    }
    /** Indicates whether the height of a block element in the editor changed in this update. */
    get heightChanged() {
        return (this.flags & 2 /* UpdateFlag.Height */) > 0;
    }
    /** Returns true when the document was modified or the size of the editor, or elements within the editor, changed. */
    get geometryChanged() {
        return this.docChanged || (this.flags & (8 /* UpdateFlag.Geometry */ | 2 /* UpdateFlag.Height */)) > 0;
    }
    /** True when this update indicates a focus change. */
    get focusChanged() {
        return (this.flags & 1 /* UpdateFlag.Focus */) > 0;
    }
    /** Whether the document changed in this update. */
    get docChanged() {
        return !this.changes.empty;
    }
    /** Whether the selection was explicitly set in this update. */
    get selectionSet() {
        return this.transactions.some(tr => tr.selection);
    }
    // @internal
    get empty() { return this.flags == 0 && this.transactions.length == 0; }
}

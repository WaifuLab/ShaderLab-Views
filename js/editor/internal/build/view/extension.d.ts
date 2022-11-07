import { EditorState, Transaction, ChangeSet, ChangeDesc, Facet, Extension, SelectionRange, RangeSet } from "../state/index.js";
import { StyleModule } from "../utils/style-mod.js";
import { DecorationSet } from "./decoration.js";
import { EditorView, DOMEventHandlers } from "./editorview.js";
import { Attrs } from "./attributes.js";
import { Rect, ScrollStrategy } from "./dom.js";
import { MakeSelectionStyle } from "./input.js";
/**
 * Command functions are used in key bindings and other types of user actions. Given an editor view,
 * they check whether their effect can apply to the editor, and if it can, perform it as a side effect
 * (which usually means [dispatching](#view.EditorView.dispatch) a transaction) and return `true`.
 */
export declare type Command = (target: EditorView) => boolean;
export declare const clickAddsSelectionRange: Facet<(event: MouseEvent) => boolean, readonly ((event: MouseEvent) => boolean)[]>;
export declare const dragMovesSelection: Facet<(event: MouseEvent) => boolean, readonly ((event: MouseEvent) => boolean)[]>;
export declare const mouseSelectionStyle: Facet<MakeSelectionStyle, readonly MakeSelectionStyle[]>;
export declare const exceptionSink: Facet<(exception: any) => void, readonly ((exception: any) => void)[]>;
export declare const updateListener: Facet<(update: ViewUpdate) => void, readonly ((update: ViewUpdate) => void)[]>;
export declare const inputHandler: Facet<(view: EditorView, from: number, to: number, text: string) => boolean, readonly ((view: EditorView, from: number, to: number, text: string) => boolean)[]>;
export declare const perLineTextDirection: Facet<boolean, boolean>;
export declare class ScrollTarget {
    readonly range: SelectionRange;
    readonly y: ScrollStrategy;
    readonly x: ScrollStrategy;
    readonly yMargin: number;
    readonly xMargin: number;
    constructor(range: SelectionRange, y?: ScrollStrategy, x?: ScrollStrategy, yMargin?: number, xMargin?: number);
    map(changes: ChangeDesc): ScrollTarget;
}
export declare const scrollIntoView: import("../state/transaction").StateEffectType<ScrollTarget>;
/**
 * Log or report an unhandled exception in client code. Should probably only be used by extension code
 * that allows client code to provide functions, and calls those functions in a context where an exception
 * can't be propagated to calling code in a reasonable way (for example when in an event handler).
 *
 * Either calls a handler registered with {@link EditorView.exceptionSink}, `window.onerror`, if defined,
 * or `console.error` (in which case it'll pass `context`, when given, as first argument).
 */
export declare function logException(state: EditorState, exception: any, context?: string): void;
export declare const editable: Facet<boolean, boolean>;
/** This is the interface plugin objects conform to. */
export interface PluginValue extends Object {
    /**
     * Notifies the plugin of an update that happened in the view. This is called _before_ the view
     * updates its own DOM. It is responsible for updating the plugin's internal state (including
     * any state that may be read by plugin fields) and _writing_ to the DOM for the changes in the
     * update. To avoid unnecessary layout recomputations, it should _not_ read the DOM layout—use
     * [`requestMeasure`](#view.EditorView.requestMeasure) to schedule your code in a DOM reading
     * phase if you need to.
     */
    update?(update: ViewUpdate): void;
    /**
     * Called when the plugin is no longer going to be used. Should revert any changes the plugin made
     * to the DOM.
     */
    destroy?(): void;
}
export declare const viewPlugin: Facet<ViewPlugin<any>, readonly ViewPlugin<any>[]>;
/** Provides additional information when defining a [view plugin]{@link ViewPlugin}. */
export interface PluginSpec<V extends PluginValue> {
    /**
     * Register the given [event handlers](#view.EditorView^domEventHandlers) for the plugin. When
     * called, these will have their `this` bound to the plugin value.
     */
    eventHandlers?: DOMEventHandlers<V>;
    /** Specify that the plugin provides additional extensions when added to an editor configuration. */
    provide?: (plugin: ViewPlugin<V>) => Extension;
    /**
     * Allow the plugin to provide decorations. When given, this should be a function that take
     * the plugin value and return a [decoration set]{@link DecorationSet}. See also the caveat
     * about [layout-changing decorations]{@link EditorView.decorations} that depend on the view.
     */
    decorations?: (value: V) => DecorationSet;
}
/**
 * View plugins associate stateful values with a view. They can influence the way the content is drawn,
 * and are notified of things that happen in the view.
 */
export declare class ViewPlugin<V extends PluginValue> {
    readonly id: number;
    readonly create: (view: EditorView) => V;
    readonly domEventHandlers: DOMEventHandlers<V> | undefined;
    /** Instances of this class act as extensions. */
    extension: Extension;
    private constructor();
    /** Define a plugin from a constructor function that creates the plugin's value, given an editor view. */
    static define<V extends PluginValue>(create: (view: EditorView) => V, spec?: PluginSpec<V>): ViewPlugin<V>;
    /** Create a plugin for a class whose constructor takes a single editor view as argument. */
    static fromClass<V extends PluginValue>(cls: {
        new (view: EditorView): V;
    }, spec?: PluginSpec<V>): ViewPlugin<V>;
}
export declare class PluginInstance {
    spec: ViewPlugin<any> | null;
    /**
     * When starting an update, all plugins have this field set to the update object, indicating
     * they need to be updated. When finished updating, it is set to `false`. Retrieving a plugin
     * that needs to be updated with `view.plugin` forces an eager update.
     */
    mustUpdate: ViewUpdate | null;
    /** This is null when the plugin is initially created, but initialized on the first update. */
    value: PluginValue | null;
    constructor(spec: ViewPlugin<any> | null);
    update(view: EditorView): this;
    destroy(view: EditorView): void;
    deactivate(): void;
}
export interface MeasureRequest<T> {
    /** Called in a DOM read phase to gather information that requires DOM layout. Should _not_ mutate the document. */
    read(view: EditorView): T;
    /** Called in a DOM write phase to update the document. Should _not_ do anything that triggers DOM layout. */
    write?(measure: T, view: EditorView): void;
    /** When multiple requests with the same key are scheduled, only the last one will actually be ran. */
    key?: any;
}
export declare type AttrSource = Attrs | ((view: EditorView) => Attrs | null);
export declare const editorAttributes: Facet<AttrSource, readonly AttrSource[]>;
export declare const contentAttributes: Facet<AttrSource, readonly AttrSource[]>;
export declare const decorations: Facet<DecorationSet | ((view: EditorView) => DecorationSet), readonly (DecorationSet | ((view: EditorView) => DecorationSet))[]>;
export declare const atomicRanges: Facet<(view: EditorView) => RangeSet<any>, readonly ((view: EditorView) => RangeSet<any>)[]>;
export declare const scrollMargins: Facet<(view: EditorView) => Partial<Rect> | null, readonly ((view: EditorView) => Partial<Rect> | null)[]>;
export declare const styleModule: Facet<StyleModule, readonly StyleModule[]>;
export declare const enum UpdateFlag {
    Focus = 1,
    Height = 2,
    Viewport = 4,
    Geometry = 8
}
export declare class ChangedRange {
    readonly fromA: number;
    readonly toA: number;
    readonly fromB: number;
    readonly toB: number;
    constructor(fromA: number, toA: number, fromB: number, toB: number);
    join(other: ChangedRange): ChangedRange;
    addToSet(set: ChangedRange[]): ChangedRange[];
    static extendWithRanges(diff: readonly ChangedRange[], ranges: number[]): readonly ChangedRange[];
}
/** View [plugins]{@link ViewPlugin} are given instances of this class, which describe what happened, whenever the view is updated. */
export declare class ViewUpdate {
    /** The editor view that the update is associated with. */
    readonly view: EditorView;
    /** The new editor state. */
    readonly state: EditorState;
    /** The transactions involved in the update. May be empty. */
    readonly transactions: readonly Transaction[];
    /** The changes made to the document by this update. */
    readonly changes: ChangeSet;
    /** The previous editor state. */
    readonly startState: EditorState;
    flags: number;
    changedRanges: readonly ChangedRange[];
    private constructor();
    static create(view: EditorView, state: EditorState, transactions: readonly Transaction[]): ViewUpdate;
    /** Tells you whether the [viewport]{@link EditorView.viewport} or [visible ranges]{@link EditorView.visibleRanges} changed in this update. */
    get viewportChanged(): boolean;
    /** Indicates whether the height of a block element in the editor changed in this update. */
    get heightChanged(): boolean;
    /** Returns true when the document was modified or the size of the editor, or elements within the editor, changed. */
    get geometryChanged(): boolean;
    /** True when this update indicates a focus change. */
    get focusChanged(): boolean;
    /** Whether the document changed in this update. */
    get docChanged(): boolean;
    /** Whether the selection was explicitly set in this update. */
    get selectionSet(): boolean;
    get empty(): boolean;
}

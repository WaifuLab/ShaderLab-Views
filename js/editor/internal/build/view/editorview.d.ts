import { EditorState, Transaction, TransactionSpec, Extension, SelectionRange, StateEffect, Facet, Line, EditorStateConfig } from "../state/index.js";
import { StyleModule, StyleSpec } from "../utils/style-mod.js";
import { DocView } from "./docview.js";
import { InputState } from "./input.js";
import { Rect, ScrollStrategy } from "./dom.js";
import { BlockInfo } from "./heightmap.js";
import { ViewState } from "./viewstate.js";
import { ViewUpdate, AttrSource, ViewPlugin, PluginValue, MeasureRequest } from "./extension.js";
import { DOMObserver } from "./domobserver.js";
import { BidiSpan, Direction } from "./bidi.js";
/** The type of object given to the {@link EditorView} constructor. */
export interface EditorViewConfig extends EditorStateConfig {
    /** The view's initial state. Defaults to an extension-less state with an empty document. */
    state?: EditorState;
    /**
     * When given, the editor is immediately appended to the given element on creation. (Otherwise,
     * you'll have to place the view's [`dom`]{@link EditorView.dom} element in the document yourself.)
     */
    parent?: Element | DocumentFragment;
    /**
     * If the view is going to be mounted in a shadow root or document other than the one held by the
     * global variable `document` (the default), you should pass it here. If you provide `parent`, but
     * not this option, the editor will automatically look up a root from the parent.
     */
    root?: Document | ShadowRoot;
    /**
     * Override the transaction [dispatch function]{@link EditorView.dispatch} for this editor view,
     * which is the way updates get routed to the view. Your implementation, if provided, should
     * probably call the view's [`update` method]{@link EditorView.update}.
     */
    dispatch?: (tr: Transaction) => void;
}
export declare const enum UpdateState {
    Idle = 0,
    Measuring = 1,
    Updating = 2
}
/**
 * An editor view represents the editor's user interface. It holds the editable DOM surface, and possibly
 * other elements such as the line number gutter. It handles events and dispatches state transactions for
 * editing actions.
 */
export declare class EditorView {
    /** The current editor state. */
    get state(): EditorState;
    /**
     * To be able to display large documents without consuming too much memory or overloading the
     * browser, CodeMirror only draws the code that is visible (plus a margin around it) to the
     * DOM. This property tells you the extent of the current drawn viewport, in document positions.
     */
    get viewport(): {
        from: number;
        to: number;
    };
    /**
     * When there are, for example, large collapsed ranges in the viewport, its size can be a lot bigger
     * than the actual visible content. Thus, if you are doing something like styling the content in the
     * viewport, it is preferable to only do so for these ranges, which are the subset of the viewport
     * that is actually drawn.
     */
    get visibleRanges(): readonly {
        from: number;
        to: number;
    }[];
    /** Returns false when the editor is entirely scrolled out of view or otherwise hidden. */
    get inView(): boolean;
    /**
     * Indicates whether the user is currently composing text via [IME](https://en.wikipedia.org/wiki/Input_method),
     * and at least one change has been made in the current composition.
     */
    get composing(): boolean;
    /**
     * Indicates whether the user is currently in composing state. Note that on some platforms, like
     * Android, this will be the case a lot, since just putting the cursor on a word starts a composition
     * there.
     */
    get compositionStarted(): boolean;
    private _dispatch;
    private _root;
    /** The document or shadow root that the view lives in. */
    get root(): DocumentOrShadowRoot;
    get win(): Window & typeof globalThis;
    /** The DOM element that wraps the entire editor view. */
    readonly dom: HTMLElement;
    /** The DOM element that can be styled to scroll. (Note that it may not have been, so you can't assume this is scrollable.) */
    readonly scrollDOM: HTMLElement;
    /**
     * The editable DOM element holding the editor content. You should not, usually, interact with this
     * content directly though the DOM, since the editor will immediately undo most of the changes you
     * make. Instead, [dispatch]{@link EditorView.dispatch} [transactions]{@link Transaction} to modify
     * content, and [decorations]{@link Decoration} to style it.
     */
    readonly contentDOM: HTMLElement;
    private announceDOM;
    inputState: InputState;
    viewState: ViewState;
    docView: DocView;
    private plugins;
    private pluginMap;
    private editorAttrs;
    private contentAttrs;
    private styleModules;
    private bidiCache;
    private destroyed;
    updateState: UpdateState;
    observer: DOMObserver;
    measureScheduled: number;
    measureRequests: MeasureRequest<any>[];
    /**
     * Construct a new view. You'll want to either provide a `parent` option, or put `view.dom` into
     * your document after creating a view, so that the user can see the editor.
     * @param config Initialization options.
     */
    constructor(config?: EditorViewConfig);
    /**
     * All regular editor state updates should go through this. It takes a transaction or transaction
     * spec and updates the view to show the new state produced by that transaction. Its implementation
     * can be overridden with an [option]{@link EditorView.constructor.config.dispatch}. This
     * function is bound to the view instance, so it does not have to be called as a method.
     */
    dispatch(tr: Transaction): void;
    dispatch(...specs: TransactionSpec[]): void;
    /**
     * Update the view for the given array of transactions. This will update the visible document and
     * selection to match the state produced by the transactions, and notify view plugins of the change.
     * You should usually call [`dispatch`]{@link EditorView.dispatch} instead, which uses this as a
     * primitive.
     */
    update(transactions: readonly Transaction[]): void;
    /**
     * Reset the view to the given state. (This will cause the entire document to be redrawn and all
     * view plugins to be reinitialized, so you should probably only use it when the new state isn't
     * derived from the old state. Otherwise, use [`dispatch`]{@link EditorView.dispatch} instead.)
     */
    setState(newState: EditorState): void;
    private updatePlugins;
    measure(flush?: boolean): void;
    /** Get the CSS classes for the currently active editor themes. */
    get themeClasses(): string;
    private updateAttrs;
    private showAnnouncements;
    private mountStyles;
    private readMeasured;
    /**
     * Schedule a layout measurement, optionally providing callbacks to do custom DOM measuring followed
     * by a DOM write phase. Using this is preferable reading DOM layout directly from, for example, an
     * event handler, because it'll make sure measuring and drawing done by other components is
     * synchronized, avoiding unnecessary DOM layout computations.
     */
    requestMeasure<T>(request?: MeasureRequest<T>): void;
    /**
     * Get the value of a specific plugin, if present. Note that plugins that crash can be dropped from
     * a view, so even when you know you registered a given plugin, it is recommended to check the return
     * value of this method.
     */
    plugin<T extends PluginValue>(plugin: ViewPlugin<T>): T | null;
    /**
     * The top position of the document, in screen coordinates. This may be negative when the editor is
     * scrolled down. Points directly to the top of the first line, not above the padding.
     */
    get documentTop(): number;
    /** Reports the padding above and below the document. */
    get documentPadding(): {
        top: number;
        bottom: number;
    };
    /**
     * Find the text line or block widget at the given vertical position (which is interpreted as
     * relative to the [top of the document]{@link documentTop}
     */
    elementAtHeight(height: number): BlockInfo;
    /** Find the line block (see [`lineBlockAt`]{@link lineBlockAt} at the given height. */
    lineBlockAtHeight(height: number): BlockInfo;
    /**
     * Get the extent and vertical position of all [line blocks]{@link lineBlockAt} in the viewport.
     * Positions are relative to the [top of the document]{@link documentTop};
     */
    get viewportLineBlocks(): BlockInfo[];
    /**
     * Find the line block around the given document position. A line block is a range delimited on
     * both sides by either a non-[hidden]{@link Decoration.replace} line breaks, or the start/end
     * of the document. It will usually just hold a line of text, but may be broken into multiple
     * textblocks by block widgets.
     */
    lineBlockAt(pos: number): BlockInfo;
    /** The editor's total content height. */
    get contentHeight(): number;
    /**
     * Move a cursor position by [grapheme cluster]{@link findClusterBreak}. `forward` determines whether
     * the motion is away from the line start, or towards it. In bidirectional text, the line is traversed
     * in visual order, using the editor's [text direction](#view.EditorView.textDirection). When the
     * start position was the last one on the line, the returned position will be across the line break.
     * If there is no further line, the original position is returned.
     *
     * By default, this method moves over a single cluster. The optional `by` argument can be used to move
     * across more. It will be called with the first cluster as argument, and should return a predicate
     * that determines, for each subsequent cluster, whether it should also be moved over.
     */
    moveByChar(start: SelectionRange, forward: boolean, by?: (initial: string) => (next: string) => boolean): SelectionRange;
    /**
     * Move a cursor position across the next group of either [letters]{@link charCategorizer}
     * or non-letter non-whitespace characters.
     */
    moveByGroup(start: SelectionRange, forward: boolean): SelectionRange;
    /**
     * Move to the next line boundary in the given direction. If `includeWrap` is true, line wrapping is
     * on, and there is a further wrap point on the current line, the wrap point will be returned. Otherwise
     * this function will return the start or end of the line.
     */
    moveToLineBoundary(start: SelectionRange, forward: boolean, includeWrap?: boolean): SelectionRange;
    /**
     * Move a cursor position vertically. When `distance` isn't given, it defaults to moving to the next
     * line (including wrapped lines). Otherwise, `distance` should provide a positive distance in pixels.
     * When `start` has a [`goalColumn`]{@link SelectionRange.goalColumn}, the vertical motion will use
     * that as a target horizontal position. Otherwise, the cursor's own horizontal position is used. The
     * returned cursor will have its goal column set to whichever column was used.
     */
    moveVertically(start: SelectionRange, forward: boolean, distance?: number): SelectionRange;
    /**
     * Find the DOM parent node and offset (child offset if `node` is an element, character offset when
     * it is a text node) at the given document position. Note that for positions that aren't currently
     * in `visibleRanges`, the resulting DOM position isn't necessarily meaningful (it may just point
     * before or after a placeholder element).
     */
    domAtPos(pos: number): {
        node: Node;
        offset: number;
    };
    /**
     * Find the document position at the given DOM node. Can be useful for associating positions with
     * DOM events. Will raise an error when `node` isn't part of the editor content.
     */
    posAtDOM(node: Node, offset?: number): number;
    /**
     * Get the document position at the given screen coordinates. For positions not covered by the visible
     * viewport's DOM structure, this will return null, unless `false` is passed as second argument, in
     * which case it'll return an estimated position that would be near the coordinates if it were rendered.
     */
    posAtCoords(coords: {
        x: number;
        y: number;
    }, precise: false): number;
    posAtCoords(coords: {
        x: number;
        y: number;
    }): number | null;
    /**
     * Get the screen coordinates at the given document position. `side` determines whether the coordinates
     * are based on the element before (-1) or after (1) the position (if no element is available on the
     * given side, the method will transparently use another strategy to get reasonable coordinates).
     */
    coordsAtPos(pos: number, side?: -1 | 1): Rect | null;
    /**
     * The default width of a character in the editor. May not accurately reflect the width of all
     * characters (given variable width fonts or styling of invididual ranges).
     */
    get defaultCharacterWidth(): number;
    /** The default height of a line in the editor. May not be accurate for all lines. */
    get defaultLineHeight(): number;
    /**
     * The text direction ([`direction`](https://developer.mozilla.org/en-US/docs/Web/CSS/direction)
     * CSS property) of the editor's content element.
     */
    get textDirection(): Direction;
    /** Find the text direction of the block at the given position, as assigned by CSS. */
    textDirectionAt(pos: number): Direction;
    /**
     * Whether this editor [wraps lines](#view.EditorView.lineWrapping)
     * (as determined by the [`white-space`](https://developer.mozilla.org/en-US/docs/Web/CSS/white-space)
     * CSS property of its content element).
     */
    get lineWrapping(): boolean;
    /**
     * Returns the bidirectional text structure of the given line (which should be in the current
     * document) as an array of span objects. The order of these spans matches the
     * [text direction]{@link textDirection}—if that is left-to-right, the leftmost spans come first,
     * otherwise the rightmost spans come first.
     */
    bidiSpans(line: Line): readonly BidiSpan[];
    /** Check whether the editor has focus. */
    get hasFocus(): boolean;
    /** Put focus on the editor. */
    focus(): void;
    /**
     * Update the [root]{@link EditorViewConfig.root} in which the editor lives. This is only necessary when
     * moving the editor's existing DOM to a new window or shadow root.
     */
    setRoot(root: Document | ShadowRoot): void;
    /**
     * Clean up this editor view, removing its element from the document, unregistering event
     * handlers, and notifying plugins. The view instance can no longer be used after calling this.
     */
    destroy(): void;
    /**
     * Returns an effect that can be [added]{@link TransactionSpec.effects} to a transaction to
     * cause it to scroll the given position or range into view.
     * @param options.y By default (`"nearest"`) the position will be vertically scrolled only
     *          the minimal amount required to move the given position into view. You can set
     *          this to `"start"` to move it to the top of the view, `"end"` to move it to the
     *          bottom, or `"center"` to move it to the center.
     * @param options.x Effect similar to [`y`]{@link scrollIntoView.options.y}, but for the
     *          horizontal scroll position.
     * @param options.yMargin Extra vertical distance to add when moving something into view.
     *          Not used with the `"center"` strategy. Defaults to 5.
     * @param options.xMargin Extra horizontal distance to add. Not used with the `"center"`
     *          strategy. Defaults to 5.
     */
    static scrollIntoView(pos: number | SelectionRange, options?: {
        y?: ScrollStrategy;
        x?: ScrollStrategy;
        yMargin?: number;
        xMargin?: number;
    }): StateEffect<unknown>;
    /**
     * Facet to add a [style module](https://github.com/marijnh/style-mod#documentation) to
     * an editor view. The view will ensure that the module is mounted in its
     * [document root]{@link root}.
     */
    static styleModule: Facet<StyleModule, readonly StyleModule[]>;
    /**
     * Returns an extension that can be used to add DOM event handlers. The value should be an object
     * mapping event names to handler functions. For any given event, such functions are ordered by
     * extension precedence, and the first handler to return true will be assumed to have handled that
     * event, and no other handlers or built-in behavior will be activated for it. These are registered
     * on the [content element]{@link contentDOM}, except for `scroll` handlers, which will be called
     * any time the editor's [scroll element]{@link scrollDOM} or one of its parent nodes is scrolled.
     */
    static domEventHandlers(handlers: DOMEventHandlers<any>): Extension;
    /**
     * An input handler can override the way changes to the editable DOM content are handled. Handlers
     * are passed the document positions between which the change was found, and the new content. When
     * one returns true, no further input handlers are called and the default behavior is prevented.
     */
    static inputHandler: Facet<(view: EditorView, from: number, to: number, text: string) => boolean, readonly ((view: EditorView, from: number, to: number, text: string) => boolean)[]>;
    /**
     * By default, the editor assumes all its content has the same [text direction]{@link Direction}.
     * Configure this with a `true` value to make it read the text direction of every (rendered)
     * line separately.
     */
    static perLineTextDirection: Facet<boolean, boolean>;
    /**
     * Allows you to provide a function that should be called when the library catches an exception
     * from an extension (mostly from view plugins, but may be used by other extensions to route
     * exceptions from user-code-provided callbacks). This is mostly useful for debugging and logging.
     * See {@link logException}.
     */
    static exceptionSink: Facet<(exception: any) => void, readonly ((exception: any) => void)[]>;
    /** A facet that can be used to register a function to be called every time the view updates. */
    static updateListener: Facet<(update: ViewUpdate) => void, readonly ((update: ViewUpdate) => void)[]>;
    /**
     * Facet that controls whether the editor content DOM is editable. When its highest-precedence
     * value is `false`, the element will not have its `contenteditable` attribute set. (Note that
     * this doesn't affect API calls that change the editor content, even when those are bound to keys
     * or buttons. See the {@link readOnly} facet for that.)
     */
    static editable: Facet<boolean, boolean>;
    /**
     * Allows you to influence the way mouse selection happens. The functions in this facet will be
     * called for a `mousedown` event on the editor, and can return an object that overrides the way a
     * selection is computed from that mouse click or drag.
     */
    static mouseSelectionStyle: Facet<import("./input").MakeSelectionStyle, readonly import("./input").MakeSelectionStyle[]>;
    /**
     * Facet used to configure whether a given selection drag event should move or copy the selection.
     * The given predicate will be called with the `mousedown` event, and can return `true` when the
     * drag should move the content.
     */
    static dragMovesSelection: Facet<(event: MouseEvent) => boolean, readonly ((event: MouseEvent) => boolean)[]>;
    /**
     * Facet used to configure whether a given selecting click adds a new range to the existing
     * selection or replaces it entirely. The default behavior is to check `event.metaKey` on macOS,
     * and `event.ctrlKey` elsewhere.
     */
    static clickAddsSelectionRange: Facet<(event: MouseEvent) => boolean, readonly ((event: MouseEvent) => boolean)[]>;
    /**
     * A facet that determines which [decorations](#view.Decoration) are shown in the view.
     * Decorations can be provided in two ways—directly, or via a function that takes an editor view.
     *
     * Only decoration sets provided directly are allowed to influence the editor's vertical
     * layout structure. The ones provided as functions are called _after_ the new viewport
     * has been computed, and thus **must not** introduce block widgets or replacing decorations
     * that cover line breaks.
     */
    static decorations: Facet<import("./decoration").DecorationSet | ((view: EditorView) => import("./decoration").DecorationSet), readonly (import("./decoration").DecorationSet | ((view: EditorView) => import("./decoration").DecorationSet))[]>;
    /**
     * Used to provide ranges that should be treated as atoms as far as cursor motion is concerned.
     * This causes methods like [`moveByChar`]{@link moveByChar} and [`moveVertically`]{@link moveVertically}
     * (and the commands built on top of them) to skip across such regions when a selection endpoint
     * would enter them. This does _not_ prevent direct programmatic
     * [selection updates]{@link TransactionSpec.selection} from moving into such regions.
     */
    static atomicRanges: Facet<(view: EditorView) => import("../state/rangeset").RangeSet<any>, readonly ((view: EditorView) => import("../state/rangeset").RangeSet<any>)[]>;
    /**
     * Facet that allows extensions to provide additional scroll margins (space around the sides of
     * the scrolling element that should be considered invisible). This can be useful when the plugin
     * introduces elements that cover part of that element (for example a horizontally fixed gutter).
     */
    static scrollMargins: Facet<(view: EditorView) => Partial<Rect> | null, readonly ((view: EditorView) => Partial<Rect> | null)[]>;
    /**
     * Create a theme extension. The first argument can be a [`style-mod`](https://github.com/marijnh/style-mod#documentation)
     * style spec providing the styles for the theme. These will be prefixed with a generated class for
     * the style. Because the selectors will be prefixed with a scope class, rule that directly match
     * the editor's [wrapper element]{@link EditorView.dom}—to which the scope class will be added—need
     * to be explicitly differentiated by adding an `&` to the selector for that element—for example
     * `&.cm-focused`. When `dark` is set to true, the theme will be marked as dark, which will cause
     * the `&dark` rules from [base themes]{@link baseTheme} to be used (as opposed to `&light` when a
     * light theme is active).
     */
    static theme(spec: {
        [selector: string]: StyleSpec;
    }, options?: {
        dark?: boolean;
    }): Extension;
    /**
     * This facet records whether a dark theme is active. The extension returned by [`theme`]{@link theme}
     * automatically includes an instance of this when the `dark` option is set to true.
     */
    static darkTheme: Facet<boolean, boolean>;
    /**
     * Create an extension that adds styles to the base theme. Like with [`theme`]{@link theme}, use `&`
     * to indicate the place of the editor wrapper element when directly targeting that. You can also use
     * `&dark` or `&light` instead to only target editors with a dark or light theme.
     */
    static baseTheme(spec: {
        [selector: string]: StyleSpec;
    }): Extension;
    /** Facet that provides additional DOM attributes for the editor's editable DOM element. */
    static contentAttributes: Facet<AttrSource, readonly AttrSource[]>;
    /** Facet that provides DOM attributes for the editor's outer element. */
    static editorAttributes: Facet<AttrSource, readonly AttrSource[]>;
    /** An extension that enables line wrapping in the editor (by setting CSS `white-space` to `pre-wrap` in the content). */
    static lineWrapping: Extension;
    /**
     * State effect used to include screen reader announcements in a transaction. These will be added to
     * the DOM in a visually hidden element with `aria-live="polite"` set, and should be used to describe
     * effects that are visually obvious but may not be noticed by screen reader users (such as moving to
     * the next search match).
     */
    static announce: import("../state/transaction").StateEffectType<string>;
    /** Retrieve an editor view instance from the view's DOM representation. */
    static findFromDOM(dom: HTMLElement): EditorView | null;
}
/** Helper type that maps event names to event object types, or the `any` type for unknown events. */
export interface DOMEventMap extends HTMLElementEventMap {
    [other: string]: any;
}
/**
 * Event handlers are specified with objects like this. For event types known by TypeScript, this will
 * infer the event argument type to hold the appropriate event object type. For unknown events, it is
 * inferred to `any`, and should be explicitly set if you want type checking.
 */
export declare type DOMEventHandlers<This> = {
    [event in keyof DOMEventMap]?: (this: This, event: DOMEventMap[event], view: EditorView) => boolean | void;
};
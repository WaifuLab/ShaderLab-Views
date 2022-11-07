import { EditorState, Transaction, Prec, EditorSelection, StateEffect } from "../state/index.js";
import { StyleModule } from "../utils/style-mod.js";
import { DocView } from "./docview.js";
import { ContentView } from "./contentview.js";
import { InputState } from "./input.js";
import { focusPreventScroll, flattenRect, getRoot, dispatchKey } from "./dom.js";
import { posAtCoords, moveByChar, moveToLineBoundary, byGroup, moveVertically, skipAtoms } from "./cursor.js";
import { ViewState } from "./viewstate.js";
import { ViewUpdate, styleModule, contentAttributes, editorAttributes, clickAddsSelectionRange, dragMovesSelection, mouseSelectionStyle, exceptionSink, updateListener, logException, viewPlugin, ViewPlugin, PluginInstance, decorations, atomicRanges, scrollMargins, editable, inputHandler, perLineTextDirection, scrollIntoView, ScrollTarget } from "./extension.js";
import { theme, darkTheme, buildTheme, baseThemeID, baseLightID, baseDarkID, lightDarkIDs, baseTheme } from "./theme.js";
import { DOMObserver } from "./domobserver.js";
import { updateAttrs, combineAttrs } from "./attributes.js";
import browser from "./browser.js";
import { computeOrder, trivialOrder, BidiSpan, Direction } from "./bidi.js";
import { applyDOMChange } from "./domchange.js";
// The editor's update state machine looks something like this:
//
//     Idle → Updating ⇆ Idle (unchecked) → Measuring → Idle
//                                         ↑      ↓
//                                         Updating (measure)
//
// The difference between 'Idle' and 'Idle (unchecked)' lies in
// whether a layout check has been scheduled. A regular update through
// the `update` method updates the DOM in a write-only fashion, and
// relies on a check (scheduled with `requestAnimationFrame`) to make
// sure everything is where it should be and the viewport covers the
// visible code. That check continues to measure and then optionally
// update until it reaches a coherent state.
/**
 * An editor view represents the editor's user interface. It holds the editable DOM surface, and possibly
 * other elements such as the line number gutter. It handles events and dispatches state transactions for
 * editing actions.
 */
export class EditorView {
    /**
     * Construct a new view. You'll want to either provide a `parent` option, or put `view.dom` into
     * your document after creating a view, so that the user can see the editor.
     * @param config Initialization options.
     */
    constructor(config = {}) {
        this.plugins = [];
        this.pluginMap = new Map;
        this.editorAttrs = {};
        this.contentAttrs = {};
        this.bidiCache = [];
        this.destroyed = false;
        // @internal
        this.updateState = 2 /* UpdateState.Updating */;
        // @internal
        this.measureScheduled = -1;
        // @internal
        this.measureRequests = [];
        this.contentDOM = document.createElement("div");
        this.scrollDOM = document.createElement("div");
        this.scrollDOM.tabIndex = -1;
        this.scrollDOM.className = "cm-scroller";
        this.scrollDOM.appendChild(this.contentDOM);
        this.announceDOM = document.createElement("div");
        this.announceDOM.style.cssText = "position: absolute; top: -10000px";
        this.announceDOM.setAttribute("aria-live", "polite");
        this.dom = document.createElement("div");
        this.dom.appendChild(this.announceDOM);
        this.dom.appendChild(this.scrollDOM);
        this._dispatch = config.dispatch || ((tr) => this.update([tr]));
        this.dispatch = this.dispatch.bind(this);
        this._root = (config.root || getRoot(config.parent) || document);
        this.viewState = new ViewState(config.state || EditorState.create(config));
        this.plugins = this.state.facet(viewPlugin).map(spec => new PluginInstance(spec));
        for (let plugin of this.plugins)
            plugin.update(this);
        this.observer = new DOMObserver(this);
        this.inputState = new InputState(this);
        this.inputState.ensureHandlers(this, this.plugins);
        this.docView = new DocView(this);
        this.mountStyles();
        this.updateAttrs();
        this.updateState = 0 /* UpdateState.Idle */;
        this.requestMeasure();
        if (config.parent)
            config.parent.appendChild(this.dom);
    }
    /** The current editor state. */
    get state() { return this.viewState.state; }
    /**
     * To be able to display large documents without consuming too much memory or overloading the
     * browser, CodeMirror only draws the code that is visible (plus a margin around it) to the
     * DOM. This property tells you the extent of the current drawn viewport, in document positions.
     */
    get viewport() { return this.viewState.viewport; }
    /**
     * When there are, for example, large collapsed ranges in the viewport, its size can be a lot bigger
     * than the actual visible content. Thus, if you are doing something like styling the content in the
     * viewport, it is preferable to only do so for these ranges, which are the subset of the viewport
     * that is actually drawn.
     */
    get visibleRanges() { return this.viewState.visibleRanges; }
    /** Returns false when the editor is entirely scrolled out of view or otherwise hidden. */
    get inView() { return this.viewState.inView; }
    /**
     * Indicates whether the user is currently composing text via [IME](https://en.wikipedia.org/wiki/Input_method),
     * and at least one change has been made in the current composition.
     */
    get composing() { return this.inputState.composing > 0; }
    /**
     * Indicates whether the user is currently in composing state. Note that on some platforms, like
     * Android, this will be the case a lot, since just putting the cursor on a word starts a composition
     * there.
     */
    get compositionStarted() { return this.inputState.composing >= 0; }
    /** The document or shadow root that the view lives in. */
    get root() { return this._root; }
    // @internal
    get win() { return this.dom.ownerDocument.defaultView || window; }
    dispatch(...input) {
        this._dispatch(input.length == 1 && input[0] instanceof Transaction ? input[0] :
            this.state.update(...input));
    }
    /**
     * Update the view for the given array of transactions. This will update the visible document and
     * selection to match the state produced by the transactions, and notify view plugins of the change.
     * You should usually call [`dispatch`]{@link EditorView.dispatch} instead, which uses this as a
     * primitive.
     */
    update(transactions) {
        if (this.updateState != 0 /* UpdateState.Idle */)
            throw new Error("Calls to EditorView.update are not allowed while an update is in progress");
        let redrawn = false, attrsChanged = false, update;
        let state = this.state;
        for (let tr of transactions) {
            if (tr.startState != state)
                throw new RangeError("Trying to update state with a transaction that doesn't start from the previous state.");
            state = tr.state;
        }
        if (this.destroyed) {
            this.viewState.state = state;
            return;
        }
        // If there was a pending DOM change, eagerly read it and try to apply it after the given transactions.
        let pendingKey = this.observer.delayedAndroidKey, domChange = null;
        if (pendingKey) {
            this.observer.clearDelayedAndroidKey();
            domChange = this.observer.readChange();
            // Only try to apply DOM changes if the transactions didn't
            // change the doc or selection.
            if (domChange && !this.state.doc.eq(state.doc) || !this.state.selection.eq(state.selection))
                domChange = null;
        }
        else {
            this.observer.clear();
        }
        // When the phrases change, redraw the editor
        if (state.facet(EditorState.phrases) != this.state.facet(EditorState.phrases))
            return this.setState(state);
        update = ViewUpdate.create(this, state, transactions);
        let scrollTarget = this.viewState.scrollTarget;
        try {
            this.updateState = 2 /* UpdateState.Updating */;
            for (let tr of transactions) {
                if (scrollTarget)
                    scrollTarget = scrollTarget.map(tr.changes);
                if (tr.scrollIntoView) {
                    let { main } = tr.state.selection;
                    scrollTarget = new ScrollTarget(main.empty ? main : EditorSelection.cursor(main.head, main.head > main.anchor ? -1 : 1));
                }
                for (let e of tr.effects)
                    if (e.is(scrollIntoView))
                        scrollTarget = e.value;
            }
            this.viewState.update(update, scrollTarget);
            this.bidiCache = CachedOrder.update(this.bidiCache, update.changes);
            if (!update.empty) {
                this.updatePlugins(update);
                this.inputState.update(update);
            }
            redrawn = this.docView.update(update);
            if (this.state.facet(styleModule) != this.styleModules)
                this.mountStyles();
            attrsChanged = this.updateAttrs();
            this.showAnnouncements(transactions);
            this.docView.updateSelection(redrawn, transactions.some(tr => tr.isUserEvent("select.pointer")));
        }
        finally {
            this.updateState = 0 /* UpdateState.Idle */;
        }
        if (update.startState.facet(theme) != update.state.facet(theme))
            this.viewState.mustMeasureContent = true;
        if (redrawn || attrsChanged || scrollTarget || this.viewState.mustEnforceCursorAssoc || this.viewState.mustMeasureContent)
            this.requestMeasure();
        if (!update.empty)
            for (let listener of this.state.facet(updateListener))
                listener(update);
        if (domChange) {
            if (!applyDOMChange(this, domChange) && pendingKey.force)
                dispatchKey(this.contentDOM, pendingKey.key, pendingKey.keyCode);
        }
    }
    /**
     * Reset the view to the given state. (This will cause the entire document to be redrawn and all
     * view plugins to be reinitialized, so you should probably only use it when the new state isn't
     * derived from the old state. Otherwise, use [`dispatch`]{@link EditorView.dispatch} instead.)
     */
    setState(newState) {
        if (this.updateState != 0 /* UpdateState.Idle */)
            throw new Error("Calls to EditorView.setState are not allowed while an update is in progress");
        if (this.destroyed) {
            this.viewState.state = newState;
            return;
        }
        this.updateState = 2 /* UpdateState.Updating */;
        let hadFocus = this.hasFocus;
        try {
            for (let plugin of this.plugins)
                plugin.destroy(this);
            this.viewState = new ViewState(newState);
            this.plugins = newState.facet(viewPlugin).map(spec => new PluginInstance(spec));
            this.pluginMap.clear();
            for (let plugin of this.plugins)
                plugin.update(this);
            this.docView = new DocView(this);
            this.inputState.ensureHandlers(this, this.plugins);
            this.mountStyles();
            this.updateAttrs();
            this.bidiCache = [];
        }
        finally {
            this.updateState = 0 /* UpdateState.Idle */;
        }
        if (hadFocus)
            this.focus();
        this.requestMeasure();
    }
    updatePlugins(update) {
        let prevSpecs = update.startState.facet(viewPlugin), specs = update.state.facet(viewPlugin);
        if (prevSpecs != specs) {
            let newPlugins = [];
            for (let spec of specs) {
                let found = prevSpecs.indexOf(spec);
                if (found < 0) {
                    newPlugins.push(new PluginInstance(spec));
                }
                else {
                    let plugin = this.plugins[found];
                    plugin.mustUpdate = update;
                    newPlugins.push(plugin);
                }
            }
            for (let plugin of this.plugins)
                if (plugin.mustUpdate != update)
                    plugin.destroy(this);
            this.plugins = newPlugins;
            this.pluginMap.clear();
            this.inputState.ensureHandlers(this, this.plugins);
        }
        else {
            for (let p of this.plugins)
                p.mustUpdate = update;
        }
        for (let i = 0; i < this.plugins.length; i++)
            this.plugins[i].update(this);
    }
    // @internal
    measure(flush = true) {
        if (this.destroyed)
            return;
        if (this.measureScheduled > -1)
            cancelAnimationFrame(this.measureScheduled);
        this.measureScheduled = 0; // Prevent requestMeasure calls from scheduling another animation frame
        if (flush)
            this.observer.forceFlush();
        let updated = null;
        let { scrollHeight, scrollTop, clientHeight } = this.scrollDOM;
        let refHeight = scrollTop > scrollHeight - clientHeight - 4 ? scrollHeight : scrollTop;
        try {
            for (let i = 0;; i++) {
                this.updateState = 1 /* UpdateState.Measuring */;
                let oldViewport = this.viewport;
                let refBlock = this.viewState.lineBlockAtHeight(refHeight);
                let changed = this.viewState.measure(this);
                if (!changed && !this.measureRequests.length && this.viewState.scrollTarget == null)
                    break;
                if (i > 5) {
                    console.warn(this.measureRequests.length ? "Measure loop restarted more than 5 times" : "Viewport failed to stabilize");
                    break;
                }
                let measuring = [];
                // Only run measure requests in this cycle when the viewport didn't change
                if (!(changed & 4 /* UpdateFlag.Viewport */))
                    [this.measureRequests, measuring] = [measuring, this.measureRequests];
                let measured = measuring.map(m => {
                    try {
                        return m.read(this);
                    }
                    catch (e) {
                        logException(this.state, e);
                        return BadMeasure;
                    }
                });
                let update = ViewUpdate.create(this, this.state, []), redrawn = false, scrolled = false;
                update.flags |= changed;
                if (!updated)
                    updated = update;
                else
                    updated.flags |= changed;
                this.updateState = 2 /* UpdateState.Updating */;
                if (!update.empty) {
                    this.updatePlugins(update);
                    this.inputState.update(update);
                    this.updateAttrs();
                    redrawn = this.docView.update(update);
                }
                for (let i = 0; i < measuring.length; i++)
                    if (measured[i] != BadMeasure) {
                        try {
                            let m = measuring[i];
                            if (m.write)
                                m.write(measured[i], this);
                        }
                        catch (e) {
                            logException(this.state, e);
                        }
                    }
                if (this.viewState.editorHeight) {
                    if (this.viewState.scrollTarget) {
                        this.docView.scrollIntoView(this.viewState.scrollTarget);
                        this.viewState.scrollTarget = null;
                        scrolled = true;
                    }
                    else {
                        let diff = this.viewState.lineBlockAt(refBlock.from).top - refBlock.top;
                        if (diff > 1 || diff < -1) {
                            this.scrollDOM.scrollTop += diff;
                            scrolled = true;
                        }
                    }
                }
                if (redrawn)
                    this.docView.updateSelection(true);
                if (this.viewport.from == oldViewport.from && this.viewport.to == oldViewport.to &&
                    !scrolled && this.measureRequests.length == 0)
                    break;
            }
        }
        finally {
            this.updateState = 0 /* UpdateState.Idle */;
            this.measureScheduled = -1;
        }
        if (updated && !updated.empty)
            for (let listener of this.state.facet(updateListener))
                listener(updated);
    }
    /** Get the CSS classes for the currently active editor themes. */
    get themeClasses() {
        return baseThemeID + " " +
            (this.state.facet(darkTheme) ? baseDarkID : baseLightID) + " " +
            this.state.facet(theme);
    }
    updateAttrs() {
        let editorAttrs = attrsFromFacet(this, editorAttributes, {
            class: "cm-editor" + (this.hasFocus ? " cm-focused " : " ") + this.themeClasses
        });
        let contentAttrs = {
            spellcheck: "false",
            autocorrect: "off",
            autocapitalize: "off",
            translate: "no",
            contenteditable: !this.state.facet(editable) ? "false" : "true",
            class: "cm-content",
            style: `${browser.tabSize}: ${this.state.tabSize}`,
            role: "textbox",
            "aria-multiline": "true"
        };
        if (this.state.readOnly)
            contentAttrs["aria-readonly"] = "true";
        attrsFromFacet(this, contentAttributes, contentAttrs);
        let changed = this.observer.ignore(() => {
            let changedContent = updateAttrs(this.contentDOM, this.contentAttrs, contentAttrs);
            let changedEditor = updateAttrs(this.dom, this.editorAttrs, editorAttrs);
            return changedContent || changedEditor;
        });
        this.editorAttrs = editorAttrs;
        this.contentAttrs = contentAttrs;
        return changed;
    }
    showAnnouncements(trs) {
        let first = true;
        for (let tr of trs)
            for (let effect of tr.effects)
                if (effect.is(EditorView.announce)) {
                    if (first)
                        this.announceDOM.textContent = "";
                    first = false;
                    let div = this.announceDOM.appendChild(document.createElement("div"));
                    div.textContent = effect.value;
                }
    }
    mountStyles() {
        this.styleModules = this.state.facet(styleModule);
        StyleModule.mount(this.root, this.styleModules.concat(baseTheme).reverse());
    }
    readMeasured() {
        if (this.updateState == 2 /* UpdateState.Updating */)
            throw new Error("Reading the editor layout isn't allowed during an update");
        if (this.updateState == 0 /* UpdateState.Idle */ && this.measureScheduled > -1)
            this.measure(false);
    }
    /**
     * Schedule a layout measurement, optionally providing callbacks to do custom DOM measuring followed
     * by a DOM write phase. Using this is preferable reading DOM layout directly from, for example, an
     * event handler, because it'll make sure measuring and drawing done by other components is
     * synchronized, avoiding unnecessary DOM layout computations.
     */
    requestMeasure(request) {
        if (this.measureScheduled < 0)
            this.measureScheduled = this.win.requestAnimationFrame(() => this.measure());
        if (request) {
            if (request.key != null)
                for (let i = 0; i < this.measureRequests.length; i++) {
                    if (this.measureRequests[i].key === request.key) {
                        this.measureRequests[i] = request;
                        return;
                    }
                }
            this.measureRequests.push(request);
        }
    }
    /**
     * Get the value of a specific plugin, if present. Note that plugins that crash can be dropped from
     * a view, so even when you know you registered a given plugin, it is recommended to check the return
     * value of this method.
     */
    plugin(plugin) {
        let known = this.pluginMap.get(plugin);
        if (known === undefined || known && known.spec != plugin)
            this.pluginMap.set(plugin, known = this.plugins.find(p => p.spec == plugin) || null);
        return known && known.update(this).value;
    }
    /**
     * The top position of the document, in screen coordinates. This may be negative when the editor is
     * scrolled down. Points directly to the top of the first line, not above the padding.
     */
    get documentTop() {
        return this.contentDOM.getBoundingClientRect().top + this.viewState.paddingTop;
    }
    /** Reports the padding above and below the document. */
    get documentPadding() {
        return { top: this.viewState.paddingTop, bottom: this.viewState.paddingBottom };
    }
    /**
     * Find the text line or block widget at the given vertical position (which is interpreted as
     * relative to the [top of the document]{@link documentTop}
     */
    elementAtHeight(height) {
        this.readMeasured();
        return this.viewState.elementAtHeight(height);
    }
    /** Find the line block (see [`lineBlockAt`]{@link lineBlockAt} at the given height. */
    lineBlockAtHeight(height) {
        this.readMeasured();
        return this.viewState.lineBlockAtHeight(height);
    }
    /**
     * Get the extent and vertical position of all [line blocks]{@link lineBlockAt} in the viewport.
     * Positions are relative to the [top of the document]{@link documentTop};
     */
    get viewportLineBlocks() {
        return this.viewState.viewportLines;
    }
    /**
     * Find the line block around the given document position. A line block is a range delimited on
     * both sides by either a non-[hidden]{@link Decoration.replace} line breaks, or the start/end
     * of the document. It will usually just hold a line of text, but may be broken into multiple
     * textblocks by block widgets.
     */
    lineBlockAt(pos) {
        return this.viewState.lineBlockAt(pos);
    }
    /** The editor's total content height. */
    get contentHeight() {
        return this.viewState.contentHeight;
    }
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
    moveByChar(start, forward, by) {
        return skipAtoms(this, start, moveByChar(this, start, forward, by));
    }
    /**
     * Move a cursor position across the next group of either [letters]{@link charCategorizer}
     * or non-letter non-whitespace characters.
     */
    moveByGroup(start, forward) {
        return skipAtoms(this, start, moveByChar(this, start, forward, initial => byGroup(this, start.head, initial)));
    }
    /**
     * Move to the next line boundary in the given direction. If `includeWrap` is true, line wrapping is
     * on, and there is a further wrap point on the current line, the wrap point will be returned. Otherwise
     * this function will return the start or end of the line.
     */
    moveToLineBoundary(start, forward, includeWrap = true) {
        return moveToLineBoundary(this, start, forward, includeWrap);
    }
    /**
     * Move a cursor position vertically. When `distance` isn't given, it defaults to moving to the next
     * line (including wrapped lines). Otherwise, `distance` should provide a positive distance in pixels.
     * When `start` has a [`goalColumn`]{@link SelectionRange.goalColumn}, the vertical motion will use
     * that as a target horizontal position. Otherwise, the cursor's own horizontal position is used. The
     * returned cursor will have its goal column set to whichever column was used.
     */
    moveVertically(start, forward, distance) {
        return skipAtoms(this, start, moveVertically(this, start, forward, distance));
    }
    /**
     * Find the DOM parent node and offset (child offset if `node` is an element, character offset when
     * it is a text node) at the given document position. Note that for positions that aren't currently
     * in `visibleRanges`, the resulting DOM position isn't necessarily meaningful (it may just point
     * before or after a placeholder element).
     */
    domAtPos(pos) {
        return this.docView.domAtPos(pos);
    }
    /**
     * Find the document position at the given DOM node. Can be useful for associating positions with
     * DOM events. Will raise an error when `node` isn't part of the editor content.
     */
    posAtDOM(node, offset = 0) {
        return this.docView.posFromDOM(node, offset);
    }
    posAtCoords(coords, precise = true) {
        this.readMeasured();
        return posAtCoords(this, coords, precise);
    }
    /**
     * Get the screen coordinates at the given document position. `side` determines whether the coordinates
     * are based on the element before (-1) or after (1) the position (if no element is available on the
     * given side, the method will transparently use another strategy to get reasonable coordinates).
     */
    coordsAtPos(pos, side = 1) {
        this.readMeasured();
        let rect = this.docView.coordsAt(pos, side);
        if (!rect || rect.left == rect.right)
            return rect;
        let line = this.state.doc.lineAt(pos), order = this.bidiSpans(line);
        let span = order[BidiSpan.find(order, pos - line.from, -1, side)];
        return flattenRect(rect, (span.dir == Direction.LTR) == (side > 0));
    }
    /**
     * The default width of a character in the editor. May not accurately reflect the width of all
     * characters (given variable width fonts or styling of invididual ranges).
     */
    get defaultCharacterWidth() { return this.viewState.heightOracle.charWidth; }
    /** The default height of a line in the editor. May not be accurate for all lines. */
    get defaultLineHeight() { return this.viewState.heightOracle.lineHeight; }
    /**
     * The text direction ([`direction`](https://developer.mozilla.org/en-US/docs/Web/CSS/direction)
     * CSS property) of the editor's content element.
     */
    get textDirection() { return this.viewState.defaultTextDirection; }
    /** Find the text direction of the block at the given position, as assigned by CSS. */
    textDirectionAt(pos) {
        let perLine = this.state.facet(perLineTextDirection);
        if (!perLine || pos < this.viewport.from || pos > this.viewport.to)
            return this.textDirection;
        this.readMeasured();
        return this.docView.textDirectionAt(pos);
    }
    /**
     * Whether this editor [wraps lines](#view.EditorView.lineWrapping)
     * (as determined by the [`white-space`](https://developer.mozilla.org/en-US/docs/Web/CSS/white-space)
     * CSS property of its content element).
     */
    get lineWrapping() { return this.viewState.heightOracle.lineWrapping; }
    /**
     * Returns the bidirectional text structure of the given line (which should be in the current
     * document) as an array of span objects. The order of these spans matches the
     * [text direction]{@link textDirection}—if that is left-to-right, the leftmost spans come first,
     * otherwise the rightmost spans come first.
     */
    bidiSpans(line) {
        if (line.length > MaxBidiLine)
            return trivialOrder(line.length);
        let dir = this.textDirectionAt(line.from);
        for (let entry of this.bidiCache)
            if (entry.from == line.from && entry.dir == dir)
                return entry.order;
        let order = computeOrder(line.text, dir);
        this.bidiCache.push(new CachedOrder(line.from, line.to, dir, order));
        return order;
    }
    /** Check whether the editor has focus. */
    get hasFocus() {
        // Safari return false for hasFocus when the context menu is open
        // or closing, which leads us to ignore selection changes from the
        // context menu because it looks like the editor isn't focused.
        // This kludges around that.
        return (this.dom.ownerDocument.hasFocus() || browser.safari && this.inputState?.lastContextMenu > Date.now() - 3e4) &&
            this.root.activeElement == this.contentDOM;
    }
    /** Put focus on the editor. */
    focus() {
        this.observer.ignore(() => {
            focusPreventScroll(this.contentDOM);
            this.docView.updateSelection();
        });
    }
    /**
     * Update the [root]{@link EditorViewConfig.root} in which the editor lives. This is only necessary when
     * moving the editor's existing DOM to a new window or shadow root.
     */
    setRoot(root) {
        if (this._root != root) {
            this._root = root;
            this.observer.setWindow((root.nodeType == 9 ? root : root.ownerDocument).defaultView);
            this.mountStyles();
        }
    }
    /**
     * Clean up this editor view, removing its element from the document, unregistering event
     * handlers, and notifying plugins. The view instance can no longer be used after calling this.
     */
    destroy() {
        for (let plugin of this.plugins)
            plugin.destroy(this);
        this.plugins = [];
        this.inputState.destroy();
        this.dom.remove();
        this.observer.destroy();
        if (this.measureScheduled > -1)
            cancelAnimationFrame(this.measureScheduled);
        this.destroyed = true;
    }
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
    static scrollIntoView(pos, options = {}) {
        return scrollIntoView.of(new ScrollTarget(typeof pos == "number" ? EditorSelection.cursor(pos) : pos, options.y, options.x, options.yMargin, options.xMargin));
    }
    /**
     * Facet to add a [style module](https://github.com/marijnh/style-mod#documentation) to
     * an editor view. The view will ensure that the module is mounted in its
     * [document root]{@link root}.
     */
    static { this.styleModule = styleModule; }
    /**
     * Returns an extension that can be used to add DOM event handlers. The value should be an object
     * mapping event names to handler functions. For any given event, such functions are ordered by
     * extension precedence, and the first handler to return true will be assumed to have handled that
     * event, and no other handlers or built-in behavior will be activated for it. These are registered
     * on the [content element]{@link contentDOM}, except for `scroll` handlers, which will be called
     * any time the editor's [scroll element]{@link scrollDOM} or one of its parent nodes is scrolled.
     */
    static domEventHandlers(handlers) {
        return ViewPlugin.define(() => ({}), { eventHandlers: handlers });
    }
    /**
     * An input handler can override the way changes to the editable DOM content are handled. Handlers
     * are passed the document positions between which the change was found, and the new content. When
     * one returns true, no further input handlers are called and the default behavior is prevented.
     */
    static { this.inputHandler = inputHandler; }
    /**
     * By default, the editor assumes all its content has the same [text direction]{@link Direction}.
     * Configure this with a `true` value to make it read the text direction of every (rendered)
     * line separately.
     */
    static { this.perLineTextDirection = perLineTextDirection; }
    /**
     * Allows you to provide a function that should be called when the library catches an exception
     * from an extension (mostly from view plugins, but may be used by other extensions to route
     * exceptions from user-code-provided callbacks). This is mostly useful for debugging and logging.
     * See {@link logException}.
     */
    static { this.exceptionSink = exceptionSink; }
    /** A facet that can be used to register a function to be called every time the view updates. */
    static { this.updateListener = updateListener; }
    /**
     * Facet that controls whether the editor content DOM is editable. When its highest-precedence
     * value is `false`, the element will not have its `contenteditable` attribute set. (Note that
     * this doesn't affect API calls that change the editor content, even when those are bound to keys
     * or buttons. See the {@link readOnly} facet for that.)
     */
    static { this.editable = editable; }
    /**
     * Allows you to influence the way mouse selection happens. The functions in this facet will be
     * called for a `mousedown` event on the editor, and can return an object that overrides the way a
     * selection is computed from that mouse click or drag.
     */
    static { this.mouseSelectionStyle = mouseSelectionStyle; }
    /**
     * Facet used to configure whether a given selection drag event should move or copy the selection.
     * The given predicate will be called with the `mousedown` event, and can return `true` when the
     * drag should move the content.
     */
    static { this.dragMovesSelection = dragMovesSelection; }
    /**
     * Facet used to configure whether a given selecting click adds a new range to the existing
     * selection or replaces it entirely. The default behavior is to check `event.metaKey` on macOS,
     * and `event.ctrlKey` elsewhere.
     */
    static { this.clickAddsSelectionRange = clickAddsSelectionRange; }
    /**
     * A facet that determines which [decorations](#view.Decoration) are shown in the view.
     * Decorations can be provided in two ways—directly, or via a function that takes an editor view.
     *
     * Only decoration sets provided directly are allowed to influence the editor's vertical
     * layout structure. The ones provided as functions are called _after_ the new viewport
     * has been computed, and thus **must not** introduce block widgets or replacing decorations
     * that cover line breaks.
     */
    static { this.decorations = decorations; }
    /**
     * Used to provide ranges that should be treated as atoms as far as cursor motion is concerned.
     * This causes methods like [`moveByChar`]{@link moveByChar} and [`moveVertically`]{@link moveVertically}
     * (and the commands built on top of them) to skip across such regions when a selection endpoint
     * would enter them. This does _not_ prevent direct programmatic
     * [selection updates]{@link TransactionSpec.selection} from moving into such regions.
     */
    static { this.atomicRanges = atomicRanges; }
    /**
     * Facet that allows extensions to provide additional scroll margins (space around the sides of
     * the scrolling element that should be considered invisible). This can be useful when the plugin
     * introduces elements that cover part of that element (for example a horizontally fixed gutter).
     */
    static { this.scrollMargins = scrollMargins; }
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
    static theme(spec, options) {
        let prefix = StyleModule.newName();
        let result = [theme.of(prefix), styleModule.of(buildTheme(`.${prefix}`, spec))];
        if (options && options.dark)
            result.push(darkTheme.of(true));
        return result;
    }
    /**
     * This facet records whether a dark theme is active. The extension returned by [`theme`]{@link theme}
     * automatically includes an instance of this when the `dark` option is set to true.
     */
    static { this.darkTheme = darkTheme; }
    /**
     * Create an extension that adds styles to the base theme. Like with [`theme`]{@link theme}, use `&`
     * to indicate the place of the editor wrapper element when directly targeting that. You can also use
     * `&dark` or `&light` instead to only target editors with a dark or light theme.
     */
    static baseTheme(spec) {
        return Prec.lowest(styleModule.of(buildTheme("." + baseThemeID, spec, lightDarkIDs)));
    }
    /** Facet that provides additional DOM attributes for the editor's editable DOM element. */
    static { this.contentAttributes = contentAttributes; }
    /** Facet that provides DOM attributes for the editor's outer element. */
    static { this.editorAttributes = editorAttributes; }
    /** An extension that enables line wrapping in the editor (by setting CSS `white-space` to `pre-wrap` in the content). */
    static { this.lineWrapping = EditorView.contentAttributes.of({ "class": "cm-lineWrapping" }); }
    /**
     * State effect used to include screen reader announcements in a transaction. These will be added to
     * the DOM in a visually hidden element with `aria-live="polite"` set, and should be used to describe
     * effects that are visually obvious but may not be noticed by screen reader users (such as moving to
     * the next search match).
     */
    static { this.announce = StateEffect.define(); }
    /** Retrieve an editor view instance from the view's DOM representation. */
    static findFromDOM(dom) {
        let content = dom.querySelector(".cm-content");
        let cView = content && ContentView.get(content) || ContentView.get(dom);
        return cView?.rootView?.view || null;
    }
}
// Maximum line length for which we compute accurate bidi info
const MaxBidiLine = 4096;
const BadMeasure = {};
class CachedOrder {
    constructor(from, to, dir, order) {
        this.from = from;
        this.to = to;
        this.dir = dir;
        this.order = order;
    }
    static update(cache, changes) {
        if (changes.empty)
            return cache;
        let result = [], lastDir = cache.length ? cache[cache.length - 1].dir : Direction.LTR;
        for (let i = Math.max(0, cache.length - 10); i < cache.length; i++) {
            let entry = cache[i];
            if (entry.dir == lastDir && !changes.touchesRange(entry.from, entry.to))
                result.push(new CachedOrder(changes.mapPos(entry.from, 1), changes.mapPos(entry.to, -1), entry.dir, entry.order));
        }
        return result;
    }
}
function attrsFromFacet(view, facet, base) {
    for (let sources = view.state.facet(facet), i = sources.length - 1; i >= 0; i--) {
        let source = sources[i], value = typeof source == "function" ? source(view) : source;
        if (value)
            combineAttrs(value, base);
    }
    return base;
}

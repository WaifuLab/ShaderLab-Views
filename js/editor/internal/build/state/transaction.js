import { ChangeSet } from "./change.js";
import { EditorSelection, checkSelection } from "./selection.js";
import { changeFilter, transactionFilter, transactionExtender, lineSeparator } from "./extension.js";
/**
 * Annotations are tagged values that are used to add metadata to transactions in an
 * extensible way. They should be used to model things that effect the entire transaction
 * (such as its [time stamp]{@link Transaction.time} or information about its
 * [origin]{@link Transaction.userEvent}). For effects that happen _alongside_ the other
 * changes made by the transaction, [state effects]{@link StateEffect} are more appropriate.
 */
export class Annotation {
    // @internal
    constructor(
    /** The annotation type. */
    type, 
    /** The value of this annotation. */
    value) {
        this.type = type;
        this.value = value;
    }
    /** Define a new type of annotation. */
    static define() { return new AnnotationType(); }
}
/** Marker that identifies a type of [annotation]{@link Annotation}. */
export class AnnotationType {
    /** Create an instance of this annotation. */
    of(value) { return new Annotation(this, value); }
}
/** Representation of a type of state effect. Defined with {@link StateEffect.define}. */
export class StateEffectType {
    // @internal
    constructor(
    // The `any` types in these function types are there to work
    // around TypeScript issue #37631, where the type guard on
    // `StateEffect.is` mysteriously stops working when these properly
    // have type `Value`.
    // @internal
    map) {
        this.map = map;
    }
    /** Create a [state effect](#state.StateEffect) instance of this type. */
    of(value) { return new StateEffect(this, value); }
}
/**
 * State effects can be used to represent additional effects associated with a
 * [transaction]{@link Transaction.effects}. They are often useful to model changes
 * to custom [state fields]{@link StateField}, when those changes aren't implicit
 * in document or selection changes.
 */
export class StateEffect {
    // @internal
    constructor(
    // @internal
    type, 
    /** The value of this effect. */
    value) {
        this.type = type;
        this.value = value;
    }
    /** Map this effect through a position mapping. Will return `undefined` when that ends up deleting the effect. */
    map(mapping) {
        let mapped = this.type.map(this.value, mapping);
        return mapped === undefined ? undefined : mapped == this.value ? this : new StateEffect(this.type, mapped);
    }
    /** Tells you whether this effect object is of a given [type]{@link StateEffectType}. */
    is(type) { return this.type == type; }
    /** Define a new effect type. The type parameter indicates the type of values that his effect holds. */
    static define(spec = {}) {
        return new StateEffectType(spec.map || (v => v));
    }
    /** Map an array of effects through a change set. */
    static mapEffects(effects, mapping) {
        if (!effects.length)
            return effects;
        let result = [];
        for (let effect of effects) {
            let mapped = effect.map(mapping);
            if (mapped)
                result.push(mapped);
        }
        return result;
    }
    /**
     * This effect can be used to reconfigure the root extensions of the editor. Doing this will
     * discard any extensions [appended]{@link StateEffect.appendConfig}, but does not reset the
     * content of [reconfigured]{@link Compartment.reconfigure} compartments.
     */
    static { this.reconfigure = StateEffect.define(); }
    /** Append extensions to the top-level configuration of the editor. */
    static { this.appendConfig = StateEffect.define(); }
}
/**
 * Changes to the editor state are grouped into transactions. Typically, a user action creates a single
 * transaction, which may contain any number of document changes, may change the selection, or have other
 * effects. Create a transaction by calling {@link EditorState.update}, or immediately dispatch one by
 * calling {@link EditorView.dispatch}.
 */
export class Transaction {
    constructor(
    /** The state from which the transaction starts. */
    startState, 
    /** The document changes made by this transaction. */
    changes, 
    /** The selection set by this transaction, or undefined if it doesn't explicitly set a selection. */
    selection, 
    /** The effects added to the transaction. */
    effects, 
    // @internal
    annotations, 
    /** Whether the selection should be scrolled into view after this transaction is dispatched. */
    scrollIntoView) {
        this.startState = startState;
        this.changes = changes;
        this.selection = selection;
        this.effects = effects;
        this.annotations = annotations;
        this.scrollIntoView = scrollIntoView;
        // @internal
        this._doc = null;
        // @internal
        this._state = null;
        if (selection)
            checkSelection(selection, changes.newLength);
        if (!annotations.some((a) => a.type == Transaction.time))
            this.annotations = annotations.concat(Transaction.time.of(Date.now()));
    }
    // @internal
    static create(startState, changes, selection, effects, annotations, scrollIntoView) {
        return new Transaction(startState, changes, selection, effects, annotations, scrollIntoView);
    }
    /**
     * The new document produced by the transaction. Contrary to [`.state`]{@link Transaction.state}`.doc`,
     * accessing this won't force the entire new state to be computed right away, so it is recommended that
     * [transaction filters]{@link EditorState.transactionFilter} use this getter when they need to look at
     * the new document.
     */
    get newDoc() {
        return this._doc || (this._doc = this.changes.apply(this.startState.doc));
    }
    /**
     * The new selection produced by the transaction. If [`this.selection`]{@link Transaction.selection}
     * is undefined, this will [map]{@link EditorSelection.map} the start state's current selection
     * through the changes made by the transaction.
     */
    get newSelection() {
        return this.selection || this.startState.selection.map(this.changes);
    }
    /**
     * The new state created by the transaction. Computed on demand (but retained for subsequent
     * access), so it is recommended not to access it in [transaction filters]{@link transactionFilter}
     * when possible.
     */
    get state() {
        if (!this._state)
            this.startState.applyTransaction(this);
        return this._state;
    }
    /** Get the value of the given annotation type, if any. */
    annotation(type) {
        for (let ann of this.annotations)
            if (ann.type == type)
                return ann.value;
        return undefined;
    }
    /** Indicates whether the transaction changed the document. */
    get docChanged() { return !this.changes.empty; }
    /**
     * Indicates whether this transaction reconfigures the state (through a
     * [configuration compartment]{@link Compartment} or with a top-level configuration
     * [effect]{@link StateEffect.reconfigure}.
     */
    get reconfigured() { return this.startState.config != this.state.config; }
    /**
     * Returns true if the transaction has a [user event]{@link Transaction.userEvent} annotation
     * that is equal to or more specific than `event`. For example, if the transaction has
     * `"select.pointer"` as user event, `"select"` and `"select.pointer"` will match it.
     */
    isUserEvent(event) {
        let e = this.annotation(Transaction.userEvent);
        return !!(e && (e == event || e.length > event.length && e.slice(0, event.length) == event && e[event.length] == "."));
    }
    /** Annotation used to store transaction timestamps. Automatically added to every transaction, holding `Date.now()`. */
    static { this.time = Annotation.define(); }
    /**
     * Annotation used to associate a transaction with a user interface event. Holds a string
     * identifying the event, using a dot-separated format to support attaching more specific
     * information. The events used by the core libraries are:
     *  - `"input"` when content is entered
     *    - `"input.type"` for typed input
     *      - `"input.type.compose"` for composition
     *    - `"input.paste"` for pasted input
     *    - `"input.drop"` when adding content with drag-and-drop
     *    - `"input.complete"` when autocompleting
     *  - `"delete"` when the user deletes content
     *    - `"delete.selection"` when deleting the selection
     *    - `"delete.forward"` when deleting forward from the selection
     *    - `"delete.backward"` when deleting backward from the selection
     *    - `"delete.cut"` when cutting to the clipboard
     *  - `"move"` when content is moved
     *    - `"move.drop"` when content is moved within the editor through drag-and-drop
     *  - `"select"` when explicitly changing the selection
     *    - `"select.pointer"` when selecting with a mouse or other pointing device
     *  - `"undo"` and `"redo"` for history actions
     * Use [`isUserEvent`](#state.Transaction.isUserEvent) to check whether the annotation
     * matches a given event.
     */
    static { this.userEvent = Annotation.define(); }
    /** Annotation indicating whether a transaction should be added to the undo history or not. */
    static { this.addToHistory = Annotation.define(); }
    /**
     * Annotation indicating (when present and true) that a transaction represents a change made
     * by some other actor, not the user. This is used, for example, to tag other people's changes
     * in collaborative editing.
     */
    static { this.remote = Annotation.define(); }
}
function joinRanges(a, b) {
    let result = [];
    for (let iA = 0, iB = 0;;) {
        let from, to;
        if (iA < a.length && (iB == b.length || b[iB] >= a[iA])) {
            from = a[iA++];
            to = a[iA++];
        }
        else if (iB < b.length) {
            from = b[iB++];
            to = b[iB++];
        }
        else
            return result;
        if (!result.length || result[result.length - 1] < from)
            result.push(from, to);
        else if (result[result.length - 1] < to)
            result[result.length - 1] = to;
    }
}
function mergeTransaction(a, b, sequential) {
    let mapForA, mapForB, changes;
    if (sequential) {
        mapForA = b.changes;
        mapForB = ChangeSet.empty(b.changes.length);
        changes = a.changes.compose(b.changes);
    }
    else {
        mapForA = b.changes.map(a.changes);
        mapForB = a.changes.mapDesc(b.changes, true);
        changes = a.changes.compose(mapForA);
    }
    return {
        changes,
        selection: b.selection ? b.selection.map(mapForB) : a.selection?.map(mapForA),
        effects: StateEffect.mapEffects(a.effects, mapForA).concat(StateEffect.mapEffects(b.effects, mapForB)),
        annotations: a.annotations.length ? a.annotations.concat(b.annotations) : b.annotations,
        scrollIntoView: a.scrollIntoView || b.scrollIntoView
    };
}
function resolveTransactionInner(state, spec, docSize) {
    let sel = spec.selection, annotations = asArray(spec.annotations);
    if (spec.userEvent)
        annotations = annotations.concat(Transaction.userEvent.of(spec.userEvent));
    return {
        changes: spec.changes instanceof ChangeSet ? spec.changes
            : ChangeSet.of(spec.changes || [], docSize, state.facet(lineSeparator)),
        selection: sel && (sel instanceof EditorSelection ? sel : EditorSelection.single(sel.anchor, sel.head)),
        effects: asArray(spec.effects),
        annotations,
        scrollIntoView: !!spec.scrollIntoView
    };
}
export function resolveTransaction(state, specs, filter) {
    let s = resolveTransactionInner(state, specs.length ? specs[0] : {}, state.doc.length);
    if (specs.length && specs[0].filter === false)
        filter = false;
    for (let i = 1; i < specs.length; i++) {
        if (specs[i].filter === false)
            filter = false;
        let seq = !!specs[i].sequential;
        s = mergeTransaction(s, resolveTransactionInner(state, specs[i], seq ? s.changes.newLength : state.doc.length), seq);
    }
    let tr = Transaction.create(state, s.changes, s.selection, s.effects, s.annotations, s.scrollIntoView);
    return extendTransaction(filter ? filterTransaction(tr) : tr);
}
// Finish a transaction by applying filters if necessary.
function filterTransaction(tr) {
    let state = tr.startState;
    // Change filters
    let result = true;
    for (let filter of state.facet(changeFilter)) {
        let value = filter(tr);
        if (value === false) {
            result = false;
            break;
        }
        if (Array.isArray(value))
            result = result === true ? value : joinRanges(result, value);
    }
    if (result !== true) {
        let changes, back;
        if (result === false) {
            back = tr.changes.invertedDesc;
            changes = ChangeSet.empty(state.doc.length);
        }
        else {
            let filtered = tr.changes.filter(result);
            changes = filtered.changes;
            back = filtered.filtered.mapDesc(filtered.changes).invertedDesc;
        }
        tr = Transaction.create(state, changes, tr.selection && tr.selection.map(back), StateEffect.mapEffects(tr.effects, back), tr.annotations, tr.scrollIntoView);
    }
    // Transaction filters
    let filters = state.facet(transactionFilter);
    for (let i = filters.length - 1; i >= 0; i--) {
        let filtered = filters[i](tr);
        if (filtered instanceof Transaction)
            tr = filtered;
        else if (Array.isArray(filtered) && filtered.length == 1 && filtered[0] instanceof Transaction)
            tr = filtered[0];
        else
            tr = resolveTransaction(state, asArray(filtered), false);
    }
    return tr;
}
function extendTransaction(tr) {
    let state = tr.startState, extenders = state.facet(transactionExtender), spec = tr;
    for (let i = extenders.length - 1; i >= 0; i--) {
        let extension = extenders[i](tr);
        if (extension && Object.keys(extension).length)
            spec = mergeTransaction(spec, resolveTransactionInner(state, extension, tr.changes.newLength), true);
    }
    return spec == tr ? tr : Transaction.create(state, tr.changes, tr.selection, spec.effects, spec.annotations, spec.scrollIntoView);
}
const none = [];
export function asArray(value) {
    return value == null ? none : Array.isArray(value) ? value : [value];
}

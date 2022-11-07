import { ChangeSet, ChangeDesc, ChangeSpec } from "./change.js";
import { EditorState } from "./state.js";
import { EditorSelection } from "./selection.js";
import { Extension } from "./facet.js";
import { Text } from "./text.js";
/**
 * Annotations are tagged values that are used to add metadata to transactions in an
 * extensible way. They should be used to model things that effect the entire transaction
 * (such as its [time stamp]{@link Transaction.time} or information about its
 * [origin]{@link Transaction.userEvent}). For effects that happen _alongside_ the other
 * changes made by the transaction, [state effects]{@link StateEffect} are more appropriate.
 */
export declare class Annotation<T> {
    /** The annotation type. */
    readonly type: AnnotationType<T>;
    /** The value of this annotation. */
    readonly value: T;
    constructor(
    /** The annotation type. */
    type: AnnotationType<T>, 
    /** The value of this annotation. */
    value: T);
    /** Define a new type of annotation. */
    static define<T>(): AnnotationType<T>;
    private _isAnnotation;
}
/** Marker that identifies a type of [annotation]{@link Annotation}. */
export declare class AnnotationType<T> {
    /** Create an instance of this annotation. */
    of(value: T): Annotation<T>;
}
interface StateEffectSpec<Value> {
    /**
     * Provides a way to map an effect like this through a position mapping.
     * When not given, the effects will simply not be mapped.
     * When the function returns `undefined`, that means the mapping deletes the effect.
     */
    map?: (value: Value, mapping: ChangeDesc) => Value | undefined;
}
/** Representation of a type of state effect. Defined with {@link StateEffect.define}. */
export declare class StateEffectType<Value> {
    readonly map: (value: any, mapping: ChangeDesc) => any | undefined;
    constructor(map: (value: any, mapping: ChangeDesc) => any | undefined);
    /** Create a [state effect](#state.StateEffect) instance of this type. */
    of(value: Value): StateEffect<Value>;
}
/**
 * State effects can be used to represent additional effects associated with a
 * [transaction]{@link Transaction.effects}. They are often useful to model changes
 * to custom [state fields]{@link StateField}, when those changes aren't implicit
 * in document or selection changes.
 */
export declare class StateEffect<Value> {
    readonly type: StateEffectType<Value>;
    /** The value of this effect. */
    readonly value: Value;
    constructor(type: StateEffectType<Value>, 
    /** The value of this effect. */
    value: Value);
    /** Map this effect through a position mapping. Will return `undefined` when that ends up deleting the effect. */
    map(mapping: ChangeDesc): StateEffect<Value> | undefined;
    /** Tells you whether this effect object is of a given [type]{@link StateEffectType}. */
    is<T>(type: StateEffectType<T>): this is StateEffect<T>;
    /** Define a new effect type. The type parameter indicates the type of values that his effect holds. */
    static define<Value = null>(spec?: StateEffectSpec<Value>): StateEffectType<Value>;
    /** Map an array of effects through a change set. */
    static mapEffects(effects: readonly StateEffect<any>[], mapping: ChangeDesc): readonly StateEffect<any>[];
    /**
     * This effect can be used to reconfigure the root extensions of the editor. Doing this will
     * discard any extensions [appended]{@link StateEffect.appendConfig}, but does not reset the
     * content of [reconfigured]{@link Compartment.reconfigure} compartments.
     */
    static reconfigure: StateEffectType<Extension>;
    /** Append extensions to the top-level configuration of the editor. */
    static appendConfig: StateEffectType<Extension>;
}
/** Describes a [transaction]{@link Transaction} when calling the {@link EditorState.update} method. */
export interface TransactionSpec {
    /** The changes to the document made by this transaction. */
    changes?: ChangeSpec;
    /**
     * When set, this transaction explicitly updates the selection. Offsets in this selection should
     * refer to the document as it is _after_ the transaction.
     */
    selection?: EditorSelection | {
        anchor: number;
        head?: number;
    };
    /**
     * Attach [state effects](#state.StateEffect) to this transaction. Again, when they contain positions
     * and this same spec makes changes, those positions should refer to positions in the updated document.
     */
    effects?: StateEffect<any> | readonly StateEffect<any>[];
    /** Set [annotations](#state.Annotation) for this transaction. */
    annotations?: Annotation<any> | readonly Annotation<any>[];
    /** Shorthand for `annotations:` [`Transaction.userEvent`](#state.Transaction^userEvent)`.of(...)`. */
    userEvent?: string;
    /** When set to `true`, the transaction is marked as needing to scroll the current selection into view. */
    scrollIntoView?: boolean;
    /**
     * By default, transactions can be modified by [change filters]{@link EditorState.changeFilter} and
     * [transaction filters]{@link EditorState.transactionFilter}. You can set this to `false` to disable
     * that. This can be necessary for transactions that, for example, include annotations that must be
     * kept consistent with their changes.
     */
    filter?: boolean;
    /**
     * Normally, when multiple specs are combined (for example by {@link EditorState.update}), the
     * positions in `changes` are taken to refer to the document
     */
    sequential?: boolean;
}
/**
 * Changes to the editor state are grouped into transactions. Typically, a user action creates a single
 * transaction, which may contain any number of document changes, may change the selection, or have other
 * effects. Create a transaction by calling {@link EditorState.update}, or immediately dispatch one by
 * calling {@link EditorView.dispatch}.
 */
export declare class Transaction {
    /** The state from which the transaction starts. */
    readonly startState: EditorState;
    /** The document changes made by this transaction. */
    readonly changes: ChangeSet;
    /** The selection set by this transaction, or undefined if it doesn't explicitly set a selection. */
    readonly selection: EditorSelection | undefined;
    /** The effects added to the transaction. */
    readonly effects: readonly StateEffect<any>[];
    readonly annotations: readonly Annotation<any>[];
    /** Whether the selection should be scrolled into view after this transaction is dispatched. */
    readonly scrollIntoView: boolean;
    _doc: Text | null;
    _state: EditorState | null;
    private constructor();
    static create(startState: EditorState, changes: ChangeSet, selection: EditorSelection | undefined, effects: readonly StateEffect<any>[], annotations: readonly Annotation<any>[], scrollIntoView: boolean): Transaction;
    /**
     * The new document produced by the transaction. Contrary to [`.state`]{@link Transaction.state}`.doc`,
     * accessing this won't force the entire new state to be computed right away, so it is recommended that
     * [transaction filters]{@link EditorState.transactionFilter} use this getter when they need to look at
     * the new document.
     */
    get newDoc(): Text;
    /**
     * The new selection produced by the transaction. If [`this.selection`]{@link Transaction.selection}
     * is undefined, this will [map]{@link EditorSelection.map} the start state's current selection
     * through the changes made by the transaction.
     */
    get newSelection(): EditorSelection;
    /**
     * The new state created by the transaction. Computed on demand (but retained for subsequent
     * access), so it is recommended not to access it in [transaction filters]{@link transactionFilter}
     * when possible.
     */
    get state(): EditorState;
    /** Get the value of the given annotation type, if any. */
    annotation<T>(type: AnnotationType<T>): T | undefined;
    /** Indicates whether the transaction changed the document. */
    get docChanged(): boolean;
    /**
     * Indicates whether this transaction reconfigures the state (through a
     * [configuration compartment]{@link Compartment} or with a top-level configuration
     * [effect]{@link StateEffect.reconfigure}.
     */
    get reconfigured(): boolean;
    /**
     * Returns true if the transaction has a [user event]{@link Transaction.userEvent} annotation
     * that is equal to or more specific than `event`. For example, if the transaction has
     * `"select.pointer"` as user event, `"select"` and `"select.pointer"` will match it.
     */
    isUserEvent(event: string): boolean;
    /** Annotation used to store transaction timestamps. Automatically added to every transaction, holding `Date.now()`. */
    static time: AnnotationType<number>;
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
    static userEvent: AnnotationType<string>;
    /** Annotation indicating whether a transaction should be added to the undo history or not. */
    static addToHistory: AnnotationType<boolean>;
    /**
     * Annotation indicating (when present and true) that a transaction represents a change made
     * by some other actor, not the user. This is used, for example, to tag other people's changes
     * in collaborative editing.
     */
    static remote: AnnotationType<boolean>;
}
export declare function resolveTransaction(state: EditorState, specs: readonly TransactionSpec[], filter: boolean): Transaction;
export declare function asArray<T>(value: undefined | T | readonly T[]): readonly T[];
export {};

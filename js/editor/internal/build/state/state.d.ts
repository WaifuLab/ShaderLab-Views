import { Text } from "./text.js";
import { ChangeSet, ChangeSpec } from "./change.js";
import { EditorSelection, SelectionRange } from "./selection.js";
import { Transaction, TransactionSpec, StateEffect } from "./transaction.js";
import { Configuration, Facet, Extension, StateField, SlotStatus, DynamicSlot } from "./facet.js";
import { CharCategory } from "./charcategory.js";
/** Options passed when [creating]{@link EditorState.create} an editor state. */
export interface EditorStateConfig {
    /**
     * The initial document. Defaults to an empty document. Can be provided either as a plain string
     * (which will be split into lines according to the value of the {@link lineSeparator}), or an
     * instance of the {@link Text} class (which is what the state will use to represent the document).
     */
    doc?: string | Text;
    /** The starting selection. Defaults to a cursor at the very start of the document. */
    selection?: EditorSelection | {
        anchor: number;
        head?: number;
    };
    /** [Extension(s)](#state.Extension) to associate with this state. */
    extensions?: Extension;
}
/**
 * The editor state class is a persistent (immutable) data structure. To update a state, you
 * [create]{@link EditorState.update} a [transaction]{@link Transaction}, which produces a _new_ state
 * instance, without modifying the original object.
 *
 * As such, _never_ mutate properties of a state directly. That'll just break things.
 */
export declare class EditorState {
    readonly config: Configuration;
    /** The current document. */
    readonly doc: Text;
    /** The current selection. */
    readonly selection: EditorSelection;
    readonly values: any[];
    readonly status: SlotStatus[];
    computeSlot: null | ((state: EditorState, slot: DynamicSlot) => SlotStatus);
    private constructor();
    /**
     * Retrieve the value of a [state field]{@link StateField}. Throws an error when the state doesn't
     * have that field, unless you pass `false` as second parameter.
     */
    field<T>(field: StateField<T>): T;
    field<T>(field: StateField<T>, require: false): T | undefined;
    /**
     * Create a [transaction]{@link Transaction} that updates this state. Any number of
     * [transaction specs]{@link TransactionSpec} can be passed
     */
    update(...specs: readonly TransactionSpec[]): Transaction;
    applyTransaction(tr: Transaction): void;
    /** Create a [transaction spec](#state.TransactionSpec) that replaces every selection range with the given content. */
    replaceSelection(text: string | Text): TransactionSpec;
    /**
     * Create a set of changes and a new selection by running the given function for each range in
     * the active selection. The function can return an optional set of changes (in the coordinate
     * space of the start document), plus an updated range (in the coordinate space of the document
     * produced by the call's own changes). This method will merge all the changes and ranges into
     * a single changeset and selection, and return it as a [transaction spec]{@link TransactionSpec},
     * which can be passed to {@link update}.
     */
    changeByRange(f: (range: SelectionRange) => {
        range: SelectionRange;
        changes?: ChangeSpec;
        effects?: StateEffect<any> | readonly StateEffect<any>[];
    }): {
        changes: ChangeSet;
        selection: EditorSelection;
        effects: readonly StateEffect<any>[];
    };
    /**
     * Create a [change set]{@link ChangeSet} from the given change description, taking the state's
     * document length and line separator into account.
     */
    changes(spec?: ChangeSpec): ChangeSet;
    /**
     * Using the state's [line separator]{@link EditorState.lineSeparator}, create a {@link Text}
     * instance from the given string.
     */
    toText(string: string): Text;
    /** Return the given range of the document as a string. */
    sliceDoc(from?: number, to?: number): string;
    /** Get the value of a state [facet]{@link Facet}. */
    facet<Output>(facet: Facet<any, Output>): Output;
    /**
     * Convert this state to a JSON-serializable object. When custom fields should be serialized,
     * you can pass them in as an object mapping property names (in the resulting object, which should
     * not use `doc` or `selection`) to fields.
     */
    toJSON(fields?: {
        [prop: string]: StateField<any>;
    }): any;
    /**
     * Deserialize a state from its JSON representation. When custom fields should be deserialized,
     * pass the same object you passed to {@link toJSON} when serializing as third argument.
     */
    static fromJSON(json: any, config?: EditorStateConfig, fields?: {
        [prop: string]: StateField<any>;
    }): EditorState;
    /**
     * Create a new state. You'll usually only need this when initializing an editor—updated states
     * are created by applying transactions.
     */
    static create(config?: EditorStateConfig): EditorState;
    /**
     * A facet that, when enabled, causes the editor to allow multiple ranges to be selected. Be
     * careful though, because by default the editor relies on the native DOM selection,  which
     * cannot handle multiple selections. An extension like {@link drawSelection} can be used to
     * make secondary selections visible to the user.
     */
    static allowMultipleSelections: Facet<boolean, boolean>;
    /**
     * Configures the tab size to use in this state. The first (highest-precedence) value of the
     * facet is used. If no value is given, this defaults to 4.
     */
    static tabSize: Facet<number, number>;
    /** The size (in columns) of a tab in the document, determined by the {@link tabSize} facet. */
    get tabSize(): number;
    /**
     * The line separator to use. By default, any of `"\n"`, `"\r\n"` and `"\r"` is treated as a
     * separator when splitting lines, and lines are joined with `"\n"`. When you configure a value
     * here, only that precise separator will be used, allowing you to round-trip documents through
     * the editor without normalizing line separators.
     */
    static lineSeparator: Facet<string, string | undefined>;
    /** Get the proper [line-break]{@link lineSeparator} string for this state. */
    get lineBreak(): string;
    /**
     * This facet controls the value of the {@link readOnly} getter, which is consulted by commands
     * and extensions that implement editing functionality to determine whether they should apply. It
     * defaults to false, but when its highest-precedence value is `true`, such functionality disables
     * itself.
     *
     * Not to be confused with {@link EditorView.editable}, which controls whether the editor's DOM is
     * set to be editable (and thus focusable).
     */
    static readOnly: Facet<boolean, boolean>;
    /** Returns true when the editor is [configured]{@link EditorState.readOnly} to be read-only. */
    get readOnly(): boolean;
    /**
     * Registers translation phrases. The {@link phrase} method will look through all objects
     * registered with this facet to find translations for its argument.
     */
    static phrases: Facet<{
        [key: string]: string;
    }, readonly {
        [key: string]: string;
    }[]>;
    /**
     * Look up a translation for the given phrase (via the {@link phrases} facet), or return the
     * original string if no translation is found.
     */
    phrase(phrase: string, ...insert: any[]): string;
    /** A facet used to register [language data]{@link languageDataAt} providers. */
    static languageData: Facet<(state: EditorState, pos: number, side: 0 | 1 | -1) => readonly {
        [name: string]: any;
    }[], readonly ((state: EditorState, pos: number, side: 0 | 1 | -1) => readonly {
        [name: string]: any;
    }[])[]>;
    /** Find the values for a given language data field, provided by the the [`languageData`](#state.EditorState^languageData) facet. */
    languageDataAt<T>(name: string, pos: number, side?: -1 | 0 | 1): readonly T[];
    /**
     * Return a function that can categorize strings (expected to represent a single
     * [grapheme cluster]{@link findClusterBreak}) into one of:
     *  - Word (contains an alphanumeric character or a character explicitly listed
     *    in the local language's `"wordChars"` language data, which should be a string)
     *  - Space (contains only whitespace)
     *  - Other (anything else)
     */
    charCategorizer(at: number): (char: string) => CharCategory;
    /**
     * Find the word at the given position, meaning the range containing all [word]{@link CharCategory.Word}
     * characters around it. If no word characters are adjacent to the position, this returns null.
     */
    wordAt(pos: number): SelectionRange | null;
    /**
     * Facet used to register change filters, which are called for each transaction (unless explicitly
     * [disabled]{@link TransactionSpec.filter}), and can suppress part of the transaction's changes.
     *
     * Such a function can return `true` to indicate that it doesn't want to do anything, `false` to
     * completely stop the changes in the transaction, or a set of ranges in which changes should be
     * suppressed. Such ranges are represented as an array of numbers, with each pair of two numbers
     * indicating the start and end of a range. So for example `[10, 20, 100, 110]` suppresses changes
     * between 10 and 20, and between 100 and 110.
     */
    static changeFilter: Facet<(tr: Transaction) => boolean | readonly number[], readonly ((tr: Transaction) => boolean | readonly number[])[]>;
    /**
     * Facet used to register a hook that gets a chance to update or replace transaction specs
     * before they are applied. This will only be applied for transactions that don't have
     * [`filter`]{@link TransactionSpec.filter} set to `false`. You can either return a single
     * transaction spec (possibly the input transaction), or an array of specs (which will be
     * combined in the same way as the arguments to {@link EditorState.update}).
     *
     * When possible, it is recommended to avoid accessing {@link Transaction.state} in a filter,
     * since it will force creation of a state that will then be discarded again, if the
     * transaction is actually filtered.
     */
    static transactionFilter: Facet<(tr: Transaction) => TransactionSpec | readonly TransactionSpec[], readonly ((tr: Transaction) => TransactionSpec | readonly TransactionSpec[])[]>;
    /**
     * This is a more limited form of {@link transactionFilter}, which can only add
     * [annotations]{@link TransactionSpec.annotations} and [effects]{@link TransactionSpec.effects}.
     * _But_, this type of filter runs even if the transaction has disabled regular
     * [filtering]{@link TransactionSpec.filter}, making it suitable for effects that don't need to
     * touch the changes or selection, but do want to process every transaction.
     *
     * Extenders run _after_ filters, when both are present.
     */
    static transactionExtender: Facet<(tr: Transaction) => Pick<TransactionSpec, "effects" | "annotations"> | null, readonly ((tr: Transaction) => Pick<TransactionSpec, "effects" | "annotations"> | null)[]>;
}

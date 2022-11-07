import { EditorState, Transaction, StateField, StateCommand, StateEffect, Facet, Extension } from "../state/index.js";
import { KeyBinding } from "../view/index.js";
/**
 * Transaction annotation that will prevent that transaction from being combined with other transactions
 * in the undo history.
 *
 * With `"before"`, it'll prevent merging with previous transactions.
 * With `"after"`, subsequent transactions won't be combined with this one.
 * With `"full"`, the transaction is isolated on both sides.
 */
export declare const isolateHistory: import("../state/transaction").AnnotationType<"after" | "before" | "full">;
/**
 * This facet provides a way to register functions that, given a transaction, provide a set of effects
 * that the history should store when inverting the transaction. This can be used to integrate some kinds
 * of effects in the history, so that they can be undone (and redone again).
 */
export declare const invertedEffects: Facet<(tr: Transaction) => readonly StateEffect<any>[], readonly ((tr: Transaction) => readonly StateEffect<any>[])[]>;
interface HistoryConfig {
    /** The minimum depth (amount of events) to store. Defaults to 100. */
    minDepth?: number;
    /** The maximum time (in milliseconds) that adjacent events can be apart and still be grouped together. Defaults to 500. */
    newGroupDelay?: number;
}
/** Create a history extension with the given configuration. */
export declare function history(config?: HistoryConfig): Extension;
/**
 * The state field used to store the history data. Should probably only be used when you want to
 * [serialize]{@link EditorState.toJSON} or [deserialize]{@link EditorState.fromJSON} state objects in
 * a way that preserves history.
 */
export declare const historyField: StateField<unknown>;
/** Undo a single group of history events. Returns false if no group was available. */
export declare const undo: StateCommand;
/** Redo a group of history events. Returns false if no group was available. */
export declare const redo: StateCommand;
/** Undo a change or selection change. */
export declare const undoSelection: StateCommand;
/** Redo a change or selection change. */
export declare const redoSelection: StateCommand;
/** The amount of undoable change events available in a given state. */
export declare const undoDepth: (state: EditorState) => number;
/** The amount of redoable change events available in a given state. */
export declare const redoDepth: (state: EditorState) => number;
/**
 * Default key bindings for the undo history.
 *
 *  - Mod-z: {@link undo}.
 *  - Mod-y (Mod-Shift-z on macOS): {@link redo}.
 *  - Mod-u: {@link undoSelection}.
 *  - Alt-u (Mod-Shift-u on macOS): {@link redoSelection}.
 */
export declare const historyKeymap: readonly KeyBinding[];
export {};

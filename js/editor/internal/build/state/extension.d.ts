import { EditorState } from "./state.js";
import { Transaction, TransactionSpec } from "./transaction.js";
import { Facet } from "./facet.js";
export declare const languageData: Facet<(state: EditorState, pos: number, side: -1 | 0 | 1) => readonly {
    [name: string]: any;
}[], readonly ((state: EditorState, pos: number, side: -1 | 0 | 1) => readonly {
    [name: string]: any;
}[])[]>;
/**
 * Subtype of {@link Command} that doesn't require access to the actual editor view. Mostly useful
 * to define commands that can be run and tested outside of a browser environment.
 */
export declare type StateCommand = (target: {
    state: EditorState;
    dispatch: (transaction: Transaction) => void;
}) => boolean;
export declare const allowMultipleSelections: Facet<boolean, boolean>;
export declare const lineSeparator: Facet<string, string | undefined>;
export declare const changeFilter: Facet<(tr: Transaction) => boolean | readonly number[], readonly ((tr: Transaction) => boolean | readonly number[])[]>;
export declare const transactionFilter: Facet<(tr: Transaction) => TransactionSpec | readonly TransactionSpec[], readonly ((tr: Transaction) => TransactionSpec | readonly TransactionSpec[])[]>;
export declare const transactionExtender: Facet<(tr: Transaction) => Pick<TransactionSpec, "effects" | "annotations"> | null, readonly ((tr: Transaction) => Pick<TransactionSpec, "effects" | "annotations"> | null)[]>;
export declare const readOnly: Facet<boolean, boolean>;

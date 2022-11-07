import { Tooltip } from "../view/index.js";
import { Transaction, StateField, EditorState, ChangeDesc } from "../state/index.js";
import { Option, CompletionSource, CompletionResult } from "./completion.js";
import { CompletionConfig } from "./config.js";
declare class CompletionDialog {
    readonly options: readonly Option[];
    readonly attrs: {
        [name: string]: string;
    };
    readonly tooltip: Tooltip;
    readonly timestamp: number;
    readonly selected: number;
    constructor(options: readonly Option[], attrs: {
        [name: string]: string;
    }, tooltip: Tooltip, timestamp: number, selected: number);
    setSelected(selected: number, id: string): CompletionDialog;
    static build(active: readonly ActiveSource[], state: EditorState, id: string, prev: CompletionDialog | null, conf: Required<CompletionConfig>): CompletionDialog | null;
    map(changes: ChangeDesc): CompletionDialog;
}
export declare class CompletionState {
    readonly active: readonly ActiveSource[];
    readonly id: string;
    readonly open: CompletionDialog | null;
    constructor(active: readonly ActiveSource[], id: string, open: CompletionDialog | null);
    static start(): CompletionState;
    update(tr: Transaction): CompletionState;
    get tooltip(): Tooltip | null;
    get attrs(): {
        [name: string]: string;
    };
}
export declare const enum State {
    Inactive = 0,
    Pending = 1,
    Result = 2
}
export declare function getUserEvent(tr: Transaction): "input" | "delete" | null;
export declare class ActiveSource {
    readonly source: CompletionSource;
    readonly state: State;
    readonly explicitPos: number;
    constructor(source: CompletionSource, state: State, explicitPos?: number);
    hasResult(): this is ActiveResult;
    update(tr: Transaction, conf: Required<CompletionConfig>): ActiveSource;
    handleUserEvent(tr: Transaction, type: "input" | "delete", conf: Required<CompletionConfig>): ActiveSource;
    handleChange(tr: Transaction): ActiveSource;
    map(changes: ChangeDesc): ActiveSource;
}
export declare class ActiveResult extends ActiveSource {
    readonly result: CompletionResult;
    readonly from: number;
    readonly to: number;
    constructor(source: CompletionSource, explicitPos: number, result: CompletionResult, from: number, to: number);
    hasResult(): this is ActiveResult;
    handleUserEvent(tr: Transaction, type: "input" | "delete", conf: Required<CompletionConfig>): ActiveSource;
    handleChange(tr: Transaction): ActiveSource;
    map(mapping: ChangeDesc): ActiveResult;
}
export declare const startCompletionEffect: import("../state/transaction").StateEffectType<boolean>;
export declare const closeCompletionEffect: import("../state/transaction").StateEffectType<null>;
export declare const setActiveEffect: import("../state/transaction").StateEffectType<readonly ActiveSource[]>;
export declare const setSelectedEffect: import("../state/transaction").StateEffectType<number>;
export declare const completionState: StateField<CompletionState>;
export {};

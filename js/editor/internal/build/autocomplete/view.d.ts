import { EditorView, Command, ViewPlugin, ViewUpdate } from "../view/index.js";
import { Transaction } from "../state/index.js";
import { ActiveSource } from "./state.js";
import { CompletionResult, CompletionContext } from "./completion.js";
/** Returns a command that moves the completion selection forward or backward by the given amount. */
export declare function moveCompletionSelection(forward: boolean, by?: "option" | "page"): Command;
/** Accept the current completion. */
export declare const acceptCompletion: Command;
/** Explicitly start autocompletion. */
export declare const startCompletion: Command;
/** Close the currently active completion. */
export declare const closeCompletion: Command;
declare class RunningQuery {
    readonly active: ActiveSource;
    readonly context: CompletionContext;
    time: number;
    updates: Transaction[];
    done: undefined | CompletionResult | null;
    constructor(active: ActiveSource, context: CompletionContext);
}
declare const enum CompositionState {
    None = 0,
    Started = 1,
    Changed = 2,
    ChangedAndMoved = 3
}
export declare const completionPlugin: ViewPlugin<{
    debounceUpdate: number;
    running: RunningQuery[];
    debounceAccept: number;
    composing: CompositionState;
    readonly view: EditorView;
    update(update: ViewUpdate): void;
    startUpdate(): void;
    startQuery(active: ActiveSource): void;
    scheduleAccept(): void;
    accept(): void;
}>;
export {};

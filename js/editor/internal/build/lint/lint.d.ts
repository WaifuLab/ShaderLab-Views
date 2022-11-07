import { EditorView, Command, KeyBinding } from "../view/index.js";
import { Extension, TransactionSpec, EditorState } from "../state/index.js";
/** Describes a problem or hint for a piece of code. */
export interface Diagnostic {
    /** The start position of the relevant text. */
    from: number;
    /** The end position. May be equal to `from`, though actually covering text is preferable. */
    to: number;
    /** The severity of the problem. This will influence how it is displayed. */
    severity: "info" | "warning" | "error";
    /**
     * An optional source string indicating where the diagnostic is coming from. You can put the name
     * of your linter here, if applicable.
     */
    source?: string;
    /** The message associated with this diagnostic. */
    message: string;
    /** An optional custom rendering function that displays the message as a DOM node. */
    renderMessage?: () => Node;
    /** An optional array of actions that can be taken on this diagnostic. */
    actions?: readonly Action[];
}
/** An action associated with a diagnostic. */
export interface Action {
    /** The label to show to the user. Should be relatively short. */
    name: string;
    /**
     * The function to call when the user activates this action. Is given the diagnostic's
     * _current_ position, which may have changed since the creation of the diagnostic, due to editing.
     */
    apply: (view: EditorView, from: number, to: number) => void;
}
declare type DiagnosticFilter = (diagnostics: readonly Diagnostic[]) => Diagnostic[];
interface LintConfig {
    /** Time to wait (in milliseconds) after a change before running the linter. Defaults to 750ms. */
    delay?: number;
    /** Optional filter to determine which diagnostics produce markers in the content. */
    markerFilter?: null | DiagnosticFilter;
    /** Filter applied to a set of diagnostics shown in a tooltip. No tooltip will appear if the empty set is returned. */
    tooltipFilter?: null | DiagnosticFilter;
}
interface LintGutterConfig {
    /** The delay before showing a tooltip when hovering over a lint gutter marker. */
    hoverTime?: number;
    /** Optional filter determining which diagnostics show a marker in the gutter. */
    markerFilter?: null | DiagnosticFilter;
    /** Optional filter for diagnostics displayed in a tooltip, which can also be used to prevent a tooltip appearing. */
    tooltipFilter?: null | DiagnosticFilter;
}
/**
 * Returns a transaction spec which updates the current set of diagnostics, and enables the lint
 * extension if if wasn't already active.
 */
export declare function setDiagnostics(state: EditorState, diagnostics: readonly Diagnostic[]): TransactionSpec;
/**
 * The state effect that updates the set of active diagnostics. Can be useful when writing an
 * extension that needs to track these.
 */
export declare const setDiagnosticsEffect: import("../state/transaction").StateEffectType<readonly Diagnostic[]>;
/** Returns the number of active lint diagnostics in the given state. */
export declare function diagnosticCount(state: EditorState): number;
/** Command to open and focus the lint panel. */
export declare const openLintPanel: Command;
/** Command to close the lint panel, when open. */
export declare const closeLintPanel: Command;
/** Move the selection to the next diagnostic. */
export declare const nextDiagnostic: Command;
/**
 *  A set of default key bindings for the lint functionality.
 *
 * - Ctrl-Shift-m (Cmd-Shift-m on macOS): {@link openLintPanel}
 * - F8: {@link nextDiagnostic}
 */
export declare const lintKeymap: readonly KeyBinding[];
/** The type of a function that produces diagnostics. */
export declare type LintSource = (view: EditorView) => readonly Diagnostic[] | Promise<readonly Diagnostic[]>;
/**
 * Given a diagnostic source, this function returns an extension that enables linting with that source.
 * It will be called whenever the editor is idle (after its content changed).
 */
export declare function linter(source: LintSource, config?: LintConfig): Extension;
/** Forces any linters [configured]{@link linter} to run when the editor is idle to run right away. */
export declare function forceLinting(view: EditorView): void;
/**
 * Returns an extension that installs a gutter showing markers for each line that has diagnostics,
 * which can be hovered over to see the diagnostics.
 */
export declare function lintGutter(config?: LintGutterConfig): Extension;
export {};

import { Extension, StateCommand } from "../state/index.js";
declare type HighlightOptions = {
    /** Determines whether, when nothing is selected, the word around the cursor is matched instead. Defaults to false. */
    highlightWordAroundCursor?: boolean;
    /** The minimum length of the selection before it is highlighted. Defaults to 1 (always highlight non-cursor selections). */
    minSelectionLength?: number;
    /** The amount of matches (in the viewport) at which to disable highlighting. Defaults to 100. */
    maxMatches?: number;
    /** Whether to only highlight whole words. */
    wholeWords?: boolean;
};
/**
 * This extension highlights text that matches the selection. It uses the `"cm-selectionMatch"` class for the highlighting.
 * When `highlightWordAroundCursor` is enabled, the word at the cursor itself will be highlighted with `"cm-selectionMatch-main"`.
 */
export declare function highlightSelectionMatches(options?: HighlightOptions): Extension;
/** Select next occurrence of the current selection. Expand selection to the surrounding word when the selection is empty. */
export declare const selectNextOccurrence: StateCommand;
export {};

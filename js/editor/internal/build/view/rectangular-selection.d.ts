import { Extension } from "../state/index.js";
/**
 * Create an extension that enables rectangular selections. By default, it will react to left mouse
 * drag with the Alt key held down. When such a selection occurs, the text within the rectangle
 * that was dragged over will be selected, as one selection [range]{@link SelectionRange} per line.
 * @param options.eventFilter A custom predicate function, which takes a `mousedown` event and
 *                            returns true if it should be used for rectangular selection.
 */
export declare function rectangularSelection(options?: {
    eventFilter?: (event: MouseEvent) => boolean;
}): Extension;
/**
 * Returns an extension that turns the pointer cursor into a crosshair when a given modifier key,
 * defaulting to Alt, is held down. Can serve as a visual hint that rectangular selection is going
 * to happen when paired with {@link rectangularSelection}.
 */
export declare function crosshairCursor(options?: {
    key?: "Alt" | "Control" | "Shift" | "Meta";
}): Extension;

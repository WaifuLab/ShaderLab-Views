import { Extension } from "../state/index.js";
declare type SelectionConfig = {
    /** The length of a full cursor blink cycle, in milliseconds. Defaults to 1200. Can be set to 0 to disable blinking. */
    cursorBlinkRate?: number;
    /** Whether to show a cursor for non-empty ranges. Defaults to true. */
    drawRangeCursor?: boolean;
};
/**
 * Returns an extension that hides the browser's native selection and cursor, replacing the selection
 * with a background behind the text (with the `cm-selectionBackground` class), and the cursors with
 * elements overlaid over the code (using `cm-cursor-primary` and `cm-cursor-secondary`).
 *
 * This allows the editor to display secondary selection ranges, and tends to produce a type of
 * selection more in line with that users expect in a text editor (the native selection styling will
 * often leave gaps between lines and won't fill the horizontal space after a line when the selection
 * continues past it).
 *
 * It does have a performance cost, in that it requires an extra DOM layout cycle for many updates
 * (the selection is drawn based on DOM layout information that's only available after laying out the
 * content).
 */
export declare function drawSelection(config?: SelectionConfig): Extension;
export {};

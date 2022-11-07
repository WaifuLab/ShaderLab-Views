import { Extension } from "../state/index.js";
/**
 * Returns an extension that makes sure the content has a bottom margin equivalent to the height of the
 * editor, minus one line height, so that every line in the document can be scrolled to the top of the
 * editor.
 *
 * This is only meaningful when the editor is scrollable, and should not be enabled in editors that take
 * the size of their content.
 */
export declare function scrollPastEnd(): Extension;

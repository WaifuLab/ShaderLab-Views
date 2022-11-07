import { Command } from "../view/index.js";
/**
 * Command that shows a dialog asking the user for a line number, and when a valid position is provided,
 * moves the cursor to that line.
 *
 * Supports line numbers, relative line offsets prefixed with `+` or `-`, document percentages suffixed
 * with `%`, and an optional column position by adding `:` and a second number after the line number.
 *
 * The dialog can be styled with the `panel.gotoLine` theme selector.
 */
export declare const gotoLine: Command;

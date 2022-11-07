import { StateCommand } from "../state/index.js";
import { Command, KeyBinding } from "../view/index.js";
/** Move the selection one character to the left (which is backward in left-to-right text, forward in right-to-left text). */
export declare const cursorCharLeft: Command;
/** Move the selection one character to the right. */
export declare const cursorCharRight: Command;
/** Move the selection one character forward. */
export declare const cursorCharForward: Command;
/** Move the selection one character backward. */
export declare const cursorCharBackward: Command;
/** Move the selection to the left across one group of word or non-word (but also non-space) characters. */
export declare const cursorGroupLeft: Command;
/** Move the selection one group to the right. */
export declare const cursorGroupRight: Command;
/** Move the selection one group forward. */
export declare const cursorGroupForward: Command;
/** Move the selection one group backward. */
export declare const cursorGroupBackward: Command;
/** Move the selection one group or camel-case subword forward. */
export declare const cursorSubwordForward: Command;
/** Move the selection one group or camel-case subword backward. */
export declare const cursorSubwordBackward: Command;
/** Move the cursor over the next syntactic element to the left. */
export declare const cursorSyntaxLeft: Command;
/** Move the cursor over the next syntactic element to the right. */
export declare const cursorSyntaxRight: Command;
/** Move the selection one line up. */
export declare const cursorLineUp: Command;
/** Move the selection one line down. */
export declare const cursorLineDown: Command;
/** Move the selection one page up. */
export declare const cursorPageUp: Command;
/** Move the selection one page down. */
export declare const cursorPageDown: Command;
/** Move the selection to the next line wrap point, or to the end of the line if there isn't one left on this line. */
export declare const cursorLineBoundaryForward: Command;
/** Move the selection to previous line wrap point, or failing that to the start of the line. */
export declare const cursorLineBoundaryBackward: Command;
/** Move the selection one line wrap point to the left. */
export declare const cursorLineBoundaryLeft: Command;
/** Move the selection one line wrap point to the right. */
export declare const cursorLineBoundaryRight: Command;
/** Move the selection to the start of the line. */
export declare const cursorLineStart: Command;
/** Move the selection to the end of the line. */
export declare const cursorLineEnd: Command;
/** Move the selection to the bracket matching the one it is currently on, if any. */
export declare const cursorMatchingBracket: StateCommand;
/** Extend the selection to the bracket matching the one the selection head is currently on, if any. */
export declare const selectMatchingBracket: StateCommand;
/** Move the selection head one character to the left, while leaving the anchor in place. */
export declare const selectCharLeft: Command;
/** Move the selection head one character to the right. */
export declare const selectCharRight: Command;
/** Move the selection head one character forward. */
export declare const selectCharForward: Command;
/** Move the selection head one character backward. */
export declare const selectCharBackward: Command;
/** Move the selection head one [group](#commands.cursorGroupLeft) to the left. */
export declare const selectGroupLeft: Command;
/** Move the selection head one group to the right. */
export declare const selectGroupRight: Command;
/** Move the selection head one group forward. */
export declare const selectGroupForward: Command;
/** Move the selection head one group backward. */
export declare const selectGroupBackward: Command;
/** Move the selection head one group or camel-case subword forward. */
export declare const selectSubwordForward: Command;
/** Move the selection head one group or subword backward. */
export declare const selectSubwordBackward: Command;
/** Move the selection head over the next syntactic element to the left. */
export declare const selectSyntaxLeft: Command;
/** Move the selection head over the next syntactic element to the right. */
export declare const selectSyntaxRight: Command;
/** Move the selection head one line up. */
export declare const selectLineUp: Command;
/** Move the selection head one line down. */
export declare const selectLineDown: Command;
/** Move the selection head one page up. */
export declare const selectPageUp: Command;
/** Move the selection head one page down. */
export declare const selectPageDown: Command;
/** Move the selection head to the next line boundary. */
export declare const selectLineBoundaryForward: Command;
/** Move the selection head to the previous line boundary. */
export declare const selectLineBoundaryBackward: Command;
/** Move the selection head one line boundary to the left. */
export declare const selectLineBoundaryLeft: Command;
/** Move the selection head one line boundary to the right. */
export declare const selectLineBoundaryRight: Command;
/** Move the selection head to the start of the line. */
export declare const selectLineStart: Command;
/** Move the selection head to the end of the line. */
export declare const selectLineEnd: Command;
/** Move the selection to the start of the document. */
export declare const cursorDocStart: StateCommand;
/** Move the selection to the end of the document. */
export declare const cursorDocEnd: StateCommand;
/** Move the selection head to the start of the document. */
export declare const selectDocStart: StateCommand;
/** Move the selection head to the end of the document. */
export declare const selectDocEnd: StateCommand;
/** Select the entire document. */
export declare const selectAll: StateCommand;
/** Expand the selection to cover entire lines. */
export declare const selectLine: StateCommand;
/** Select the next syntactic construct that is larger than the selection. */
export declare const selectParentSyntax: StateCommand;
/**
 * Simplify the current selection. When multiple ranges are selected, reduce it to its main range.
 * Otherwise, if the selection is non-empty, convert it to a cursor selection.
 */
export declare const simplifySelection: StateCommand;
/** Delete the selection, or, for cursor selections, the character before the cursor. */
export declare const deleteCharBackward: Command;
/** Delete the selection or the character after the cursor. */
export declare const deleteCharForward: Command;
/**
 * Delete the selection or backward until the end of the next [group]{@link moveByGroup}, only skipping
 * groups of whitespace when they consist of a single space.
 */
export declare const deleteGroupBackward: StateCommand;
/** Delete the selection or forward until the end of the next group. */
export declare const deleteGroupForward: StateCommand;
/**
 * Delete the selection, or, if it is a cursor selection, delete to the end of the line. If the cursor
 * is directly at the end of the line, delete the line break after it.
 */
export declare const deleteToLineEnd: Command;
/**
 * Delete the selection, or, if it is a cursor selection, delete to the start of the line.
 * If the cursor is directly at the start of the line, delete the line break before it.
 */
export declare const deleteToLineStart: Command;
/** Delete all whitespace directly before a line end from the document. */
export declare const deleteTrailingWhitespace: StateCommand;
/** Replace each selection range with a line break, leaving the cursor on the line before the break. */
export declare const splitLine: StateCommand;
/** Flip the characters before and after the cursor(s). */
export declare const transposeChars: StateCommand;
/** Move the selected lines up one line. */
export declare const moveLineUp: StateCommand;
/** Move the selected lines down one line. */
export declare const moveLineDown: StateCommand;
/** Create a copy of the selected lines. Keep the selection in the top copy. */
export declare const copyLineUp: StateCommand;
/** Create a copy of the selected lines. Keep the selection in the bottom copy. */
export declare const copyLineDown: StateCommand;
/** Delete selected lines. */
export declare const deleteLine: Command;
/** Replace the selection with a newline. */
export declare const insertNewline: StateCommand;
/** Replace the selection with a newline and indent the newly created line(s). */
export declare const insertNewlineAndIndent: StateCommand;
/** Create a blank, indented line below the current line. */
export declare const insertBlankLine: StateCommand;
/**
 * Auto-indent the selected lines. This uses the [indentation service facet]{@link indentService} as
 * source for auto-indent information.
 */
export declare const indentSelection: StateCommand;
/** Add a [unit]{@link indentUnit} of indentation to all selected lines. */
export declare const indentMore: StateCommand;
/** Remove a [unit]{@link indentUnit} of indentation from all selected lines. */
export declare const indentLess: StateCommand;
/** Insert a tab character at the cursor or, if something is selected, use {@link indentMore} to indent the entire selection. */
export declare const insertTab: StateCommand;
/**
 * Array of key bindings containing the Emacs-style bindings that are available
 * on macOS by default.
 *
 *  - Ctrl-b: {@link cursorCharLeft} ({@link selectCharLeft} with Shift)
 *  - Ctrl-f: {@link cursorCharRight} ({@link selectCharRight} with Shift)
 *  - Ctrl-p: {@link cursorLineUp} ({@link selectLineUp} with Shift)
 *  - Ctrl-n: {@link cursorLineDown} ({@link selectLineDown} with Shift)
 *  - Ctrl-a: {@link cursorLineStart} ({@link selectLineStart} with Shift)
 *  - Ctrl-e: {@link cursorLineEnd} ({@link selectLineEnd} with Shift)
 *  - Ctrl-d: {@link deleteCharForward}.
 *  - Ctrl-h: {@link deleteCharBackward}.
 *  - Ctrl-k: {@link deleteToLineEnd}.
 *  - Ctrl-Alt-h: {@link deleteGroupBackward}
 *  - Ctrl-o: {@link splitLine}
 *  - Ctrl-t: {@link transposeChars}
 *  - Ctrl-v: {@link cursorPageDown}
 *  - Alt-v: {@link cursorPageUp}
 */
export declare const emacsStyleKeymap: readonly KeyBinding[];
/**
 * An array of key bindings closely sticking to platform-standard or widely used bindings.
 * (This includes the bindings from {@link emacsStyleKeymap}, with their `key` property
 * changed to `mac`.)
 *
 *  - ArrowLeft: {@link cursorCharLeft} ({@link selectCharLeft} with Shift)
 *  - ArrowRight: {@link cursorCharRight} ({@link selectCharRight} with Shift)
 *  - Ctrl-ArrowLeft (Alt-ArrowLeft on macOS): {@link cursorGroupLeft} ({@link selectGroupLeft} with Shift)
 *  - Ctrl-ArrowRight (Alt-ArrowRight on macOS): {@link cursorGroupRight} ({@link selectGroupRight} with Shift)
 *  - Cmd-ArrowLeft (on macOS): {@link cursorLineStart} ({@link selectLineStart} with Shift)
 *  - Cmd-ArrowRight (on macOS): {@link cursorLineEnd} ({@link selectLineEnd} with Shift)
 *  - ArrowUp: {@link cursorLineUp} ({@link selectLineUp} with Shift)
 *  - ArrowDown: {@link cursorLineDown} ({@link selectLineDown} with Shift)
 *  - Cmd-ArrowUp (on macOS): {@link cursorDocStart} ({@link selectDocStart} with Shift)
 *  - Cmd-ArrowDown (on macOS): {@link cursorDocEnd} ({@link selectDocEnd} with Shift)
 *  - Ctrl-ArrowUp (on macOS): {@link cursorPageUp} ({@link selectPageUp} with Shift)
 *  - Ctrl-ArrowDown (on macOS): {@link cursorPageDown} ({@link selectPageDown} with Shift)
 *  - PageUp: {@link cursorPageUp} ({@link selectPageUp} with Shift)
 *  - PageDown: {@link cursorPageDown} ({@link selectPageDown} with Shift)
 *  - Home: {@link cursorLineBoundaryBackward} ({@link selectLineBoundaryBackward} with Shift)
 *  - End: {@link cursorLineBoundaryForward} ({@link selectLineBoundaryForward} with Shift)
 *  - Ctrl-Home (Cmd-Home on macOS): {@link cursorDocStart} ({@link selectDocStart} with Shift)
 *  - Ctrl-End (Cmd-Home on macOS): {@link cursorDocEnd}) ({@link selectDocEnd} with Shift)
 *  - Enter: {@link insertNewlineAndIndent}
 *  - Ctrl-a (Cmd-a on macOS): {@link selectAll}
 *  - Backspace: {@link deleteCharBackward}
 *  - Delete: {@link deleteCharForward}
 *  - Ctrl-Backspace (Alt-Backspace on macOS): {@link deleteGroupBackward}
 *  - Ctrl-Delete (Alt-Delete on macOS): {@link deleteGroupForward}
 *  - Cmd-Backspace (macOS): {@link deleteToLineStart}.
 *  - Cmd-Delete (macOS): {@link deleteToLineEnd}.
 */
export declare const standardKeymap: readonly KeyBinding[];
/**
 * The default keymap. Includes all bindings from {@link standardKeymap} plus the following:
 *
 *  - Alt-ArrowLeft (Ctrl-ArrowLeft on macOS): {@link cursorSyntaxLeft} ({@link selectSyntaxLeft} with Shift)
 *  - Alt-ArrowRight (Ctrl-ArrowRight on macOS): {@link cursorSyntaxRight} ({@link selectSyntaxRight} with Shift)
 *  - Alt-ArrowUp: {@link moveLineUp}.
 *  - Alt-ArrowDown: {@link moveLineDown}.
 *  - Shift-Alt-ArrowUp: {@link copyLineUp}.
 *  - Shift-Alt-ArrowDown: {@link copyLineDown}.
 *  - Escape: {@link simplifySelection}.
 *  - Ctrl-Enter (Comd-Enter on macOS): {@link insertBlankLine}.
 *  - Alt-l (Ctrl-l on macOS): {@link selectLine}.
 *  - Ctrl-i (Cmd-i on macOS): {@link selectParentSyntax}.
 *  - Ctrl-[ (Cmd-[ on macOS): {@link indentLess}.
 *  - Ctrl-] (Cmd-] on macOS): {@link indentMore}.
 *  - Ctrl-Alt-\\ (Cmd-Alt-\\ on macOS): {@link indentSelection}.
 *  - Shift-Ctrl-k (Shift-Cmd-k on macOS): {@link deleteLine}.
 *  - Shift-Ctrl-\\ (Shift-Cmd-\\ on macOS): {@link cursorMatchingBracket}.
 *  - Ctrl-/ (Cmd-/ on macOS): {@link toggleComment}.
 *  - Shift-Alt-a: {@link toggleBlockComment}.
 */
export declare const defaultKeymap: readonly KeyBinding[];
/** A binding that binds Tab to {@link indentMore} and Shift-Tab to {@link indentLess}. */
export declare const indentWithTab: KeyBinding;

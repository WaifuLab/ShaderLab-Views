import { keymap, highlightSpecialChars, drawSelection, highlightActiveLine, dropCursor, rectangularSelection,
         crosshairCursor, lineNumbers, highlightActiveLineGutter } from "./build/view/index.js";
import { EditorState } from "./build/state/index.js";
import { defaultHighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching, foldGutter, foldKeymap } from "./build/language/index.js";
import { defaultKeymap, history, historyKeymap } from "./build/commands/index.js";
import { searchKeymap, highlightSelectionMatches } from "./build/search/index.js";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "./build/autocomplete/index.js";
import { lintKeymap } from "./build/lint/index.js";

export const defaultConfig = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap
    ])
];

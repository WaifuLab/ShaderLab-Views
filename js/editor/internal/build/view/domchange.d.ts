import { EditorView } from "./editorview.js";
import { EditorSelection } from "../state/index.js";
export declare class DOMChange {
    readonly typeOver: boolean;
    bounds: {
        startDOM: Node | null;
        endDOM: Node | null;
        from: number;
        to: number;
    } | null;
    text: string;
    newSel: EditorSelection | null;
    constructor(view: EditorView, start: number, end: number, typeOver: boolean);
}
export declare function applyDOMChange(view: EditorView, domChange: DOMChange): boolean;

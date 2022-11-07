import { EditorState, SelectionRange } from "../state/index.js";
import { EditorView } from "./editorview.js";
declare global {
    interface Selection {
        modify(action: string, direction: string, granularity: string): void;
    }
    interface Document {
        caretPositionFromPoint(x: number, y: number): {
            offsetNode: Node;
            offset: number;
        };
    }
}
export declare function groupAt(state: EditorState, pos: number, bias?: 1 | -1): SelectionRange;
export declare function posAtCoords(view: EditorView, { x, y }: {
    x: number;
    y: number;
}, precise: boolean, bias?: -1 | 1): number | null;
export declare function moveToLineBoundary(view: EditorView, start: SelectionRange, forward: boolean, includeWrap: boolean): SelectionRange;
export declare function moveByChar(view: EditorView, start: SelectionRange, forward: boolean, by?: (initial: string) => (next: string) => boolean): SelectionRange;
export declare function byGroup(view: EditorView, pos: number, start: string): (next: string) => boolean;
export declare function moveVertically(view: EditorView, start: SelectionRange, forward: boolean, distance?: number): SelectionRange;
export declare function skipAtoms(view: EditorView, oldPos: SelectionRange, pos: SelectionRange): SelectionRange;

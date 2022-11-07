import { EditorState } from "../state/index.js";
export declare const LineBreakPlaceholder = "\uFFFF";
export declare class DOMReader {
    private points;
    text: string;
    lineSeparator: string | undefined;
    constructor(points: DOMPoint[], state: EditorState);
    append(text: string): void;
    lineBreak(): void;
    readRange(start: Node | null, end: Node | null): this;
    readTextNode(node: Text): void;
    readNode(node: Node): void;
    findPointBefore(node: Node, next: Node | null): void;
    findPointInside(node: Node, maxLen: number): void;
}
export declare class DOMPoint {
    readonly node: Node;
    readonly offset: number;
    pos: number;
    constructor(node: Node, offset: number);
}

import { SpanIterator, Text, TextIterator } from "../state/index.js";
import { DecorationSet, Decoration, MarkDecoration } from "./decoration.js";
import { BlockView, LineView, BlockWidgetView } from "./blockview.js";
declare const enum Buf {
    No = 0,
    Yes = 1,
    IfCursor = 2
}
export declare class ContentBuilder implements SpanIterator<Decoration> {
    private doc;
    pos: number;
    end: number;
    readonly disallowBlockEffectsFor: boolean[];
    content: BlockView[];
    curLine: LineView | null;
    breakAtStart: number;
    pendingBuffer: Buf;
    atCursorPos: boolean;
    openStart: number;
    openEnd: number;
    cursor: TextIterator;
    text: string;
    skip: number;
    textOff: number;
    constructor(doc: Text, pos: number, end: number, disallowBlockEffectsFor: boolean[]);
    posCovered(): boolean;
    getLine(): LineView;
    flushBuffer(active: readonly MarkDecoration[]): void;
    addBlockWidget(view: BlockWidgetView): void;
    finish(openEnd: number): void;
    buildText(length: number, active: readonly MarkDecoration[], openStart: number): void;
    span(from: number, to: number, active: MarkDecoration[], openStart: number): void;
    point(from: number, to: number, deco: Decoration, active: MarkDecoration[], openStart: number, index: number): void;
    static build(text: Text, from: number, to: number, decorations: readonly DecorationSet[], dynamicDecorationMap: boolean[]): {
        content: BlockView[];
        breakAtStart: number;
        openStart: number;
        openEnd: number;
    };
}
export {};

import { ContentView, DOMPos } from "./contentview.js";
import { DocView } from "./docview.js";
import { Rect } from "./dom.js";
import { LineDecoration, WidgetType, BlockType } from "./decoration.js";
import { Attrs } from "./attributes.js";
import { Text } from "../state/index.js";
export interface BlockView extends ContentView {
    type: BlockType;
    dom: HTMLElement | null;
}
export declare class LineView extends ContentView implements BlockView {
    children: ContentView[];
    length: number;
    dom: HTMLElement | null;
    prevAttrs: Attrs | null | undefined;
    attrs: Attrs | null;
    breakAfter: number;
    merge(from: number, to: number, source: BlockView | null, hasStart: boolean, openStart: number, openEnd: number): boolean;
    split(at: number): LineView;
    transferDOM(other: LineView): void;
    setDeco(attrs: Attrs | null): void;
    append(child: ContentView, openStart: number): void;
    addLineDeco(deco: LineDecoration): void;
    domAtPos(pos: number): DOMPos;
    reuseDOM(node: Node): void;
    sync(track?: {
        node: Node;
        written: boolean;
    }): void;
    measureTextSize(): {
        lineHeight: number;
        charWidth: number;
    } | null;
    coordsAt(pos: number, side: number): Rect | null;
    become(_other: ContentView): boolean;
    get type(): BlockType;
    static find(docView: DocView, pos: number): LineView | null;
}
export declare class BlockWidgetView extends ContentView implements BlockView {
    widget: WidgetType;
    length: number;
    type: BlockType;
    dom: HTMLElement | null;
    parent: DocView | null;
    breakAfter: number;
    prevWidget: WidgetType | null;
    constructor(widget: WidgetType, length: number, type: BlockType);
    merge(from: number, to: number, source: ContentView | null, _takeDeco: boolean, openStart: number, openEnd: number): boolean;
    domAtPos(pos: number): DOMPos;
    split(at: number): BlockWidgetView;
    get children(): ContentView[];
    sync(): void;
    get overrideDOMText(): Text;
    domBoundsAround(): null;
    become(other: ContentView): boolean;
    ignoreMutation(): boolean;
    ignoreEvent(event: Event): boolean;
    destroy(): void;
}
